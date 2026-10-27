package com.redishost;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * Framework client test - Spring Boot
 * Transport: RestTemplate (Spring's dedicated blocking HTTP client), Jackson for JSON.
 * Built and run inside docker (see run-docker.mjs): mvn package -DskipTests, then
 * java -jar target/fw-client.jar --spring.main.web-application-type=none
 * Shared scenario with the other clients: see tests/clients/README.md.
 * Expiry idiom for this client: SET key value EX <seconds> (one request).
 * Output note: log lines are ASCII-only.
 */
@SpringBootApplication
public class SpringClient implements CommandLineRunner {

    static final String BASE = env("RH_BASE_URL", "http://127.0.0.1:3000");
    static final String EMAIL = "qa-review@redishost.test";
    static final String PASSWORD = "review-pass-77";

    static final String LANG = "spring";
    static final long EPOCH = System.currentTimeMillis();
    static final String DB_NAME = "fw-lab-" + LANG + "-" + EPOCH;
    static final String KEY = "fw:" + LANG + ":session";
    static final String HITS_KEY = "fw:" + LANG + ":hits";
    static final String PAYLOAD_TMPL = "{\"lang\":\"" + LANG + "\",\"saved\":\"%s\",\"note\":\"framework TTL test\"}";

    static final ObjectMapper OM = new ObjectMapper();

    static int checks = 0;
    static int failures = 0;
    static int exitCode = 0;
    static final Map<String, String> ids = new HashMap<>();

    static RestTemplate rest;

    static String env(String name, String fallback) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) return fallback;
        return v.replaceAll("/+$", "");
    }

    record Out(int status, String raw, long ms) {}

    static void log(String line) {
        System.out.println(line);
        System.out.flush();
    }

    static void check(String name, boolean ok, String detail) {
        checks++;
        if (!ok) failures++;
        log("  " + (ok ? "PASS" : "FAIL") + "  " + name + (detail.isEmpty() ? "" : " -- " + detail));
    }

    static Out call(String method, String path, String token, Object bodyObj) {
        long started = System.currentTimeMillis();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "application/json");
        if (token != null) headers.set("Authorization", "Bearer " + token);
        String body = null;
        if (bodyObj != null) {
            try { body = OM.writeValueAsString(bodyObj); } catch (Exception ignored) { }
        }
        HttpEntity<String> entity = new HttpEntity<>(body, headers);
        int status = 0;
        String raw = "";
        try {
            ResponseEntityExchange res = exchange(method, path, entity);
            status = res.status;
            raw = res.body;
        } catch (HttpStatusCodeException e) {
            status = e.getStatusCode().value();
            raw = e.getResponseBodyAsString();
        } catch (Exception e) {
            raw = "{\"error\":{\"message\":\"" + e.getClass().getSimpleName() + "\"}}";
        }
        long ms = System.currentTimeMillis() - started;
        return new Out(status, raw, ms);
    }

    record ResponseEntityExchange(int status, String body) {}

    static ResponseEntityExchange exchange(String method, String path, HttpEntity<String> entity) throws Exception {
        var res = rest.exchange(BASE + path, HttpMethod.valueOf(method), entity, String.class);
        return new ResponseEntityExchange(res.getStatusCode().value(), res.getBody());
    }

    static void trace(String method, String path, Out o) {
        log("> " + method + " " + path);
        String shown = o.raw() == null ? "" : o.raw();
        String tail = shown.isEmpty() ? "" : " | " + shown.substring(0, Math.min(72, shown.length()));
        log("< " + o.status() + " | " + o.ms() + " ms" + tail);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> dataOf(Out o) {
        try {
            Map<String, Object> env = OM.readValue(o.raw() == null ? "" : o.raw(), Map.class);
            if (!Boolean.TRUE.equals(env.get("success"))) return null;
            return (Map<String, Object>) env.get("data");
        } catch (Exception e) {
            return null;
        }
    }

    static Map<String, Object> expectOk(Out o, String what) {
        Map<String, Object> data = dataOf(o);
        if (data == null) {
            check(what, false, "status " + o.status());
            return null;
        }
        return data;
    }

    public static void main(String[] args) {
        System.exit(SpringApplication.exit(
                SpringApplication.run(SpringClient.class, args),
                () -> SpringClient.exitCode));
    }

    @Override
    public void run(String... args) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(10_000);
        f.setReadTimeout(25_000);
        rest = new RestTemplate(f);

        log("client    : Spring Boot 3 -- transport: RestTemplate (Spring dedicated HTTP client) + Jackson");
        log("identity  : default User-Agent: Java-http-client/17 (RestTemplate uses the JDK engine)");
        log("auth live : " + EMAIL);
        try {
            scenario();
        } catch (Exception e) {
            log("FAIL  transport error: " + e);
            failures++;
        } finally {
            if (ids.get("databaseId") != null) {
                Out gone = call("DELETE", "/api/databases/" + ids.get("databaseId"), ids.get("token"), null);
                trace("DELETE", "/api/databases/" + ids.get("databaseId") + " (teardown)", gone);
                check("lab database deleted with scoped keys", gone.status() == 200, "status " + gone.status());
            }
            log((failures == 0 ? "ALL PASS" : "FAILURES") + " -- " + (checks - failures) + "/" + checks + " checks");
            log("");
        }
        if (failures > 0) exitCode = 1;
    }

    @SuppressWarnings("unchecked")
    void scenario() throws Exception {
        String payload = String.format(PAYLOAD_TMPL, Instant.now());

        /* Step 0: login -> session token */
        Out login = call("POST", "/api/auth/login", null, Map.of("email", EMAIL, "password", PASSWORD));
        trace("POST", "/api/auth/login", login);
        Map<String, Object> session = expectOk(login, "login");
        if (session == null) return;
        String token = (String) session.get("token");
        ids.put("token", token);

        /* Self-heal: labs left behind by crashed runs of this lang */
        Out listed = call("GET", "/api/databases", token, null);
        trace("GET", "/api/databases", listed);
        Map<String, Object> listData = dataOf(listed);
        if (listData != null && listData.get("databases") instanceof List) {
            List<Map<String, Object>> stale = new ArrayList<>();
            for (Map<String, Object> db : (List<Map<String, Object>>) listData.get("databases")) {
                if (String.valueOf(db.getOrDefault("name", "")).startsWith("fw-lab-" + LANG + "-")) stale.add(db);
            }
            for (Map<String, Object> db : stale) {
                Out gone = call("DELETE", "/api/databases/" + db.get("id"), token, null);
                trace("DELETE", "/api/databases/" + db.get("id") + " (stale lab)", gone);
            }
        }

        /* Step 1: dedicated lab database (deleted at teardown, cascade) */
        Out created = call("POST", "/api/databases", token, Map.of("name", DB_NAME));
        trace("POST", "/api/databases", created);
        Map<String, Object> dbWrapper = expectOk(created, "create lab database");
        Map<String, Object> database = dbWrapper == null ? null : (Map<String, Object>) dbWrapper.get("database");
        if (database != null) ids.put("databaseId", String.valueOf(database.get("id")));

        /* Step 2: scoped read-write API key (plaintext returned exactly once) */
        Out keyRes = call("POST", "/api/api-keys", token, Map.of(
                "name", "fw-" + LANG + "-" + EPOCH,
                "databaseId", ids.get("databaseId"),
                "permission", "read-write"));
        trace("POST", "/api/api-keys", keyRes);
        Map<String, Object> keyData = expectOk(keyRes, "create scoped api key");
        if (keyData != null) {
            Map<String, Object> apiKey = (Map<String, Object>) keyData.get("apiKey");
            if (apiKey != null) ids.put("keyId", String.valueOf(apiKey.get("id")));
            Object plaintext = keyData.get("plaintext");
            if (plaintext != null) log("  plaintext token issued once: rk......");
        }

        String apiToken = (String) keyData.get("plaintext");
        String cmdPath = "/api/data/" + ids.get("databaseId") + "/command";

        /* Step 3: SET with inline EX (Spring chose the same single-request idiom) */
        Out setRes = call("POST", cmdPath, apiToken, Map.of("command", "SET", "args", List.of(KEY, payload, "EX", 5)));
        trace("POST", cmdPath + " (SET ... EX 5)", setRes);
        Map<String, Object> setData = expectOk(setRes, "SET with EX 5");
        Object setResult = setData == null ? null : setData.get("result");
        check("SET returns OK", "OK".equals(setResult), String.valueOf(setResult));

        /* Step 4 (bonus): pipeline - atomic batch */
        Map<String, Object> incr = Map.of("command", "INCR", "args", List.of(HITS_KEY));
        Out pipe = call("POST", "/api/data/" + ids.get("databaseId") + "/pipeline", apiToken, Map.of("commands", List.of(incr, incr, incr)));
        trace("POST", "/api/data/" + ids.get("databaseId") + "/pipeline (INCR x3)", pipe);
        Map<String, Object> pipeData = expectOk(pipe, "pipeline executes");
        List<Object> pipeResults = new ArrayList<>();
        if (pipeData != null && pipeData.get("results") instanceof List) {
            for (Map<String, Object> entry : (List<Map<String, Object>>) pipeData.get("results")) {
                pipeResults.add(entry.get("result"));
            }
        }
        boolean pipeOk = pipeResults.size() == 3
                && num(pipeResults.get(0)) == 1 && num(pipeResults.get(1)) == 2 && num(pipeResults.get(2)) == 3;
        check("pipeline INCR x3 -> [1,2,3]", pipeOk, String.valueOf(pipeResults));

        /* Step 5: round trip */
        Out get = call("POST", cmdPath, apiToken, Map.of("command", "GET", "args", List.of(KEY)));
        trace("POST", cmdPath + " (GET)", get);
        Map<String, Object> getData = expectOk(get, "GET round trip");
        Object saved = getData == null ? null : getData.get("result");
        check("value round-trips byte-for-byte", payload.equals(saved), String.valueOf(saved));

        /* Step 6/7: TTL + EXISTS while alive */
        Out ttl = call("POST", cmdPath, apiToken, Map.of("command", "TTL", "args", List.of(KEY)));
        trace("POST", cmdPath + " (TTL)", ttl);
        Map<String, Object> ttlData = expectOk(ttl, "TTL probe");
        int ttlValue = ttlData == null ? -99 : num(ttlData.get("result"));
        check("TTL counts down 5->1", ttlValue >= 1 && ttlValue <= 5, "TTL " + ttlValue);

        Out exists = call("POST", cmdPath, apiToken, Map.of("command", "EXISTS", "args", List.of(KEY)));
        trace("POST", cmdPath + " (EXISTS)", exists);
        Map<String, Object> existsData = expectOk(exists, "EXISTS probe");
        int existsValue = existsData == null ? -99 : num(existsData.get("result"));
        check("EXISTS is 1 before expiry", existsValue == 1, "EXISTS " + existsValue);

        /* Step 8: wait past expiry */
        log("...waiting 6.5 s for the key to expire...");
        Thread.sleep(6500);

        /* Step 9/10: proof of expiry */
        Out after = call("POST", cmdPath, apiToken, Map.of("command", "GET", "args", List.of(KEY)));
        trace("POST", cmdPath + " (GET after expiry)", after);
        Map<String, Object> afterData = expectOk(after, "GET after expiry");
        check("expired key reads as Redis nil (JSON null)",
                afterData != null && afterData.get("result") == null,
                String.valueOf(afterData == null ? "!" : afterData.get("result")));

        Out ttlAfter = call("POST", cmdPath, apiToken, Map.of("command", "TTL", "args", List.of(KEY)));
        trace("POST", cmdPath + " (TTL after expiry)", ttlAfter);
        Map<String, Object> ttlAfterData = expectOk(ttlAfter, "TTL after expiry");
        int ttlAfterValue = ttlAfterData == null ? -99 : num(ttlAfterData.get("result"));
        check("TTL on expired key is -2 (no such key)", ttlAfterValue == -2, "TTL " + ttlAfterValue);

        /* Step 11: revoke, prove rejection */
        Out revoke = call("DELETE", "/api/api-keys/" + ids.get("keyId"), token, null);
        trace("DELETE", "/api/api-keys/" + ids.get("keyId") + " (revoke)", revoke);
        expectOk(revoke, "revoke api key");
        Out rejected = call("POST", cmdPath, apiToken, Map.of("command", "GET", "args", List.of(KEY)));
        trace("POST", cmdPath + " (revoked token)", rejected);
        check("revoked key is rejected 401", rejected.status() == 401, "status " + rejected.status());
    }

    static int num(Object v) {
        if (v instanceof Number) return ((Number) v).intValue();
        return -99;
    }
}

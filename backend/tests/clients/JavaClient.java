import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Framework client test - Java
 * Transport: the JDK's own java.net.http.HttpClient (built in since Java 11).
 * Runs standalone with the source-file launcher: java JavaClient.java
 * (or inside a docker temurin image -- see run-docker.mjs).
 * Shared scenario with the other clients: see tests/clients/README.md.
 * Expiry idiom for this client: SET key value EX <seconds> (one request).
 *
 * Observation note: the JDK ships no JSON parser, so this file hand-rolls a
 * minimal one (class Json). Node/Python/Spring all come with JSON support
 * for free -- a nice contrast to include in the comparison.
 * Output note: log lines are ASCII-only.
 */
public class JavaClient {

    static final String BASE = env("RH_BASE_URL", "http://127.0.0.1:3000");
    static final String EMAIL = "qa-review@redishost.test";
    static final String PASSWORD = "review-pass-77";

    static final String LANG = "java";
    static final long EPOCH = System.currentTimeMillis();
    static final String DB_NAME = "fw-lab-" + LANG + "-" + EPOCH;
    static final String KEY = "fw:" + LANG + ":session";
    static final String HITS_KEY = "fw:" + LANG + ":hits";
    static final String PAYLOAD = "{\"lang\":\"" + LANG + "\",\"saved\":\"" + Instant.now() + "\",\"note\":\"framework TTL test\"}";

    static int checks = 0;
    static int failures = 0;
    static final Map<String, String> ids = new LinkedHashMap<>();

    record Out(int status, String body, long ms) {}

    static String env(String name, String fallback) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) return fallback;
        return v.replaceAll("/+$", "");
    }

    static void log(String line) { System.out.println(line); }

    static void check(String name, boolean ok, String detail) {
        checks++;
        if (!ok) failures++;
        log("  " + (ok ? "PASS" : "FAIL") + "  " + name + (detail.isEmpty() ? "" : " -- " + detail));
    }

    static final HttpClient HC = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    static Out call(String method, String path, String token, String bodyJson) throws Exception {
        long started = System.nanoTime();
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(BASE + path))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(25));
        if (token != null) b.header("Authorization", "Bearer " + token);
        if (bodyJson != null) b.method(method, HttpRequest.BodyPublishers.ofString(bodyJson));
        else b.method(method, HttpRequest.BodyPublishers.noBody());
        HttpResponse<String> res = HC.send(b.build(), HttpResponse.BodyHandlers.ofString());
        long ms = (System.nanoTime() - started) / 1_000_000L;
        return new Out(res.statusCode(), res.body(), ms);
    }

    static void trace(String method, String path, Out o) {
        log("> " + method + " " + path);
        String shown = o.body() == null ? "" : o.body();
        String tail = shown.isEmpty() ? "" : " | " + shown.substring(0, Math.min(72, shown.length()));
        log("< " + o.status() + " | " + o.ms() + " ms" + tail);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> dataOf(Out o) {
        Object parsed = Json.parse(o.body());
        if (!(parsed instanceof Map)) return null;
        Object success = ((Map<String, Object>) parsed).get("success");
        if (!Boolean.TRUE.equals(success)) return null;
        return (Map<String, Object>) ((Map<String, Object>) parsed).get("data");
    }

    static Map<String, Object> expectOk(Out o, String what) {
        Map<String, Object> data = dataOf(o);
        if (data == null) {
            check(what, false, "status " + o.status());
            return null;
        }
        return data;
    }

    /* Java has no JSON serializer either when stdlib-only: escape by hand. */
    static String esc(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '\\' || c == '"') b.append('\\');
            b.append(c);
        }
        return b.toString();
    }

    static String cmdBody(String command, Object... args) {
        StringBuilder b = new StringBuilder("{\"command\":\"").append(command).append("\",\"args\":[");
        for (int i = 0; i < args.length; i++) {
            if (i > 0) b.append(',');
            if (args[i] instanceof Number) b.append(args[i]);
            else b.append('"').append(esc(String.valueOf(args[i]))).append('"');
        }
        return b.append("]}").toString();
    }

    public static void main(String[] args) throws Exception {
        log("client    : Java " + System.getProperty("java.version") + " -- transport: java.net.http.HttpClient (JDK built-in)");
        log("identity  : default User-Agent: Java-http-client/" + System.getProperty("java.version"));
        log("auth live : " + EMAIL);
        try {
            scenario();
        } finally {
            if (ids.get("databaseId") != null) {
                Out gone = call("DELETE", "/api/databases/" + ids.get("databaseId"), ids.get("token"), null);
                trace("DELETE", "/api/databases/" + ids.get("databaseId") + " (teardown)", gone);
                check("lab database deleted with scoped keys", gone.status() == 200, "status " + gone.status());
            }
            log((failures == 0 ? "ALL PASS" : "FAILURES") + " -- " + (checks - failures) + "/" + checks + " checks");
            log("");
        }
        if (failures > 0) System.exit(1);
    }

    static void scenario() throws Exception {
        /* Step 0: login -> session token */
        Out login = call("POST", "/api/auth/login", null,
                "{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}");
        trace("POST", "/api/auth/login", login);
        Map<String, Object> session = expectOk(login, "login");
        if (session == null) return;
        String token = (String) session.get("token");
        ids.put("token", token);

        /* Self-heal: labs left behind by crashed runs of this lang */
        Out listed = call("GET", "/api/databases", token, null);
        trace("GET", "/api/databases", listed);
        Map<String, Object> listData = dataOf(listed);
        if (listData != null) {
            List<Map<String, Object>> staleDbs = new ArrayList<>();
            for (Map<String, Object> db : (List<Map<String, Object>>) (List<?>) listData.getOrDefault("databases", List.of())) {
                if (String.valueOf(db.get("name")).startsWith("fw-lab-" + LANG + "-")) staleDbs.add(db);
            }
            for (Map<String, Object> db : staleDbs) {
                Out gone = call("DELETE", "/api/databases/" + db.get("id"), token, null);
                trace("DELETE", "/api/databases/" + db.get("id") + " (stale lab)", gone);
            }
        }

        /* Step 1: dedicated lab database (deleted at teardown, cascade) */
        Out created = call("POST", "/api/databases", token, "{\"name\":\"" + DB_NAME + "\"}");
        trace("POST", "/api/databases", created);
        Map<String, Object> dbWrapper = expectOk(created, "create lab database");
        Map<String, Object> database = dbWrapper == null ? null : (Map<String, Object>) dbWrapper.get("database");
        if (database != null) ids.put("databaseId", String.valueOf(database.get("id")));

        /* Step 2: scoped read-write API key (plaintext returned exactly once) */
        Out keyRes = call("POST", "/api/api-keys", token,
                "{\"name\":\"fw-" + LANG + "-" + EPOCH + "\",\"databaseId\":\"" + ids.get("databaseId") + "\",\"permission\":\"read-write\"}");
        trace("POST", "/api/api-keys", keyRes);
        Map<String, Object> keyData = expectOk(keyRes, "create scoped api key");
        if (keyData != null) {
            Map<String, Object> apiKey = (Map<String, Object>) keyData.get("apiKey");
            if (apiKey != null) ids.put("keyId", String.valueOf(apiKey.get("id")));
            log("  plaintext token issued once: rk......");
        }

        String apiToken = (String) keyData.get("plaintext");
        String cmdPath = "/api/data/" + ids.get("databaseId") + "/command";

        /* Data plane from here on: API key only. Log the outgoing request shape. */
        Out r0 = call("POST", cmdPath, apiToken, cmdBody("SET", KEY, PAYLOAD, "EX", 5));
        log("^ {\"command\":\"SET\",\"args\":[\"fw:java:session\",\"{...}\",\"EX\",5]} | Bearer rk......");
        trace("POST", cmdPath + " (SET ... EX 5)", r0);
        Map<String, Object> setData = expectOk(r0, "SET with EX 5");
        Object setResult = setData == null ? null : setData.get("result");
        check("SET returns OK", "OK".equals(setResult), String.valueOf(setResult));

        /* Step 4 (bonus): pipeline - atomic batch */
        String pipeBody = "{\"commands\":[" + cmdBody("INCR", HITS_KEY) + "," + cmdBody("INCR", HITS_KEY) + "," + cmdBody("INCR", HITS_KEY) + "]}";
        Out pipe = call("POST", "/api/data/" + ids.get("databaseId") + "/pipeline", apiToken, pipeBody);
        trace("POST", "/api/data/" + ids.get("databaseId") + "/pipeline (INCR x3)", pipe);
        Map<String, Object> pipeData = expectOk(pipe, "pipeline executes");
        List<Object> pipeResults = new ArrayList<>();
        if (pipeData != null && pipeData.get("results") instanceof List) {
            for (Map<String, Object> entry : (List<Map<String, Object>>) (List<?>) pipeData.get("results")) {
                pipeResults.add(entry.get("result"));
            }
        }
        boolean pipeOk = pipeResults.size() == 3
                && num(pipeResults.get(0)) == 1 && num(pipeResults.get(1)) == 2 && num(pipeResults.get(2)) == 3;
        check("pipeline INCR x3 -> [1,2,3]", pipeOk, String.valueOf(pipeResults));

        /* Step 5: round trip */
        Out get = call("POST", cmdPath, apiToken, cmdBody("GET", KEY));
        trace("POST", cmdPath + " (GET)", get);
        Map<String, Object> getData = expectOk(get, "GET round trip");
        Object saved = getData == null ? null : getData.get("result");
        check("value round-trips byte-for-byte", PAYLOAD.equals(saved), String.valueOf(saved));

        /* Step 6/7: TTL + EXISTS while alive */
        Out ttl = call("POST", cmdPath, apiToken, cmdBody("TTL", KEY));
        trace("POST", cmdPath + " (TTL)", ttl);
        Map<String, Object> ttlData = expectOk(ttl, "TTL probe");
        int ttlValue = ttlData == null ? -99 : num(ttlData.get("result"));
        check("TTL counts down 5->1", ttlValue >= 1 && ttlValue <= 5, "TTL " + ttlValue);

        Out exists = call("POST", cmdPath, apiToken, cmdBody("EXISTS", KEY));
        trace("POST", cmdPath + " (EXISTS)", exists);
        Map<String, Object> existsData = expectOk(exists, "EXISTS probe");
        int existsValue = existsData == null ? -99 : num(existsData.get("result"));
        check("EXISTS is 1 before expiry", existsValue == 1, "EXISTS " + existsValue);

        /* Step 8: wait past expiry */
        log("...waiting 6.5 s for the key to expire...");
        Thread.sleep(6500);

        /* Step 9/10: proof of expiry */
        Out after = call("POST", cmdPath, apiToken, cmdBody("GET", KEY));
        trace("POST", cmdPath + " (GET after expiry)", after);
        Map<String, Object> afterData = expectOk(after, "GET after expiry");
        check("expired key reads as Redis nil (JSON null)", afterData != null && afterData.get("result") == null, String.valueOf(afterData == null ? "!" : afterData.get("result")));

        Out ttlAfter = call("POST", cmdPath, apiToken, cmdBody("TTL", KEY));
        trace("POST", cmdPath + " (TTL after expiry)", ttlAfter);
        Map<String, Object> ttlAfterData = expectOk(ttlAfter, "TTL after expiry");
        int ttlAfterValue = ttlAfterData == null ? -99 : num(ttlAfterData.get("result"));
        check("TTL on expired key is -2 (no such key)", ttlAfterValue == -2, "TTL " + ttlAfterValue);

        /* Step 11: revoke, prove rejection */
        Out revoke = call("DELETE", "/api/api-keys/" + ids.get("keyId"), token, null);
        trace("DELETE", "/api/api-keys/" + ids.get("keyId") + " (revoke)", revoke);
        expectOk(revoke, "revoke api key");
        Out rejected = call("POST", cmdPath, apiToken, cmdBody("GET", KEY));
        trace("POST", cmdPath + " (revoked token)", rejected);
        check("revoked key is rejected 401", rejected.status() == 401, "status " + rejected.status());
    }

    static int num(Object v) {
        if (v instanceof Number) return ((Number) v).intValue();
        return -99;
    }
}

/* Minimal JSON parser: stdlib-only Java needs one to read the API's envelopes. */
class Json {

    static Object parse(String s) {
        try {
            P p = new P(s);
            Object v = p.val();
            if (v == null && s != null && s.isBlank()) return null;
            return v;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static final class P {
        final String s;
        int i = 0;

        P(String s) { this.s = s; }

        void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }

        Object val() {
            ws();
            char c = s.charAt(i);
            switch (c) {
                case '{': return obj();
                case '[': return arr();
                case '"': return str();
                case 't': i += 4; return Boolean.TRUE;
                case 'f': i += 5; return Boolean.FALSE;
                case 'n': i += 4; return null;
                default: return num();
            }
        }

        Map<String, Object> obj() {
            Map<String, Object> m = new LinkedHashMap<>();
            i++;
            ws();
            if (s.charAt(i) == '}') { i++; return m; }
            while (true) {
                ws();
                String k = str();
                ws();
                i++; /* : */
                m.put(k, val());
                ws();
                char d = s.charAt(i++);
                if (d == '}') return m;
            }
        }

        List<Object> arr() {
            List<Object> l = new ArrayList<>();
            i++;
            ws();
            if (s.charAt(i) == ']') { i++; return l; }
            while (true) {
                l.add(val());
                ws();
                char d = s.charAt(i++);
                if (d == ']') return l;
            }
        }

        String str() {
            StringBuilder b = new StringBuilder();
            i++; /* opening quote */
            while (true) {
                char c = s.charAt(i++);
                if (c == '\\') {
                    char e = s.charAt(i++);
                    if (e == 'n') b.append('\n');
                    else if (e == 't') b.append('\t');
                    else if (e == 'r') b.append('\r');
                    else if (e == 'u') { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                    else b.append(e);
                } else if (c == '"') {
                    return b.toString();
                } else {
                    b.append(c);
                }
            }
        }

        Object num() {
            int start = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            if (start == i) throw new IllegalStateException("bad json at " + i);
            return Double.parseDouble(s.substring(start, i));
        }
    }
}

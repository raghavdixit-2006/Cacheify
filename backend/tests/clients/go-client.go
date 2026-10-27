///
/// Framework client test - Go
/// Transport: net/http from the standard library (Go's dedicated HTTP module).
/// Runs standalone: go run go-client.go (or inside a docker golang image -- see run-docker.mjs).
/// Shared scenario with the other clients: see tests/clients/README.md.
/// Expiry idiom for this client: SET key value EX <seconds> (one request).
/// Output note: log lines are ASCII-only.
///
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func envDefault(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return strings.TrimRight(v, "/")
	}
	return fallback
}

const (
	LANG = "go"
	// NOTE: epoch/dbName are computed in main() via a shared var, not consts.
)

var (
	BASE     = envDefault("RH_BASE_URL", "http://127.0.0.1:3000")
	EMAIL    = "qa-review@redishost.test"
	PASSWORD = "review-pass-77"

	epoch   = time.Now().UnixMilli()
	dbName  = fmt.Sprintf("fw-lab-%s-%d", LANG, epoch)
	key     = fmt.Sprintf("fw:%s:session", LANG)
	hitsKey = fmt.Sprintf("fw:%s:hits", LANG)
	payload = fmt.Sprintf(`{"lang":"%s","saved":"%s","note":"framework TTL test"}`, LANG, time.Now().UTC().Format(time.RFC3339Nano))

	client = &http.Client{Timeout: 25 * time.Second}

	checks   int
	failures int
	ids      = map[string]string{}
)

type envelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type out struct {
	status int
	body   []byte
	ms     int64
	env    envelope
}

func log(line string) { fmt.Println(line) }

func check(name string, ok bool, detail string) {
	checks++
	if !ok {
		failures++
	}
	mark := "PASS"
	if !ok {
		mark = "FAIL"
	}
	if detail != "" {
		detail = " -- " + detail
	}
	log(fmt.Sprintf("  %s  %s%s", mark, name, detail))
}

func call(method, path, token string, body []byte) (out, error) {
	started := time.Now()
	req, err := http.NewRequest(method, BASE+path, func() io.Reader {
		if body == nil {
			return nil
		}
		return bytes.NewReader(body)
	}())
	if err != nil {
		return out{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := client.Do(req)
	ms := time.Since(started).Milliseconds()
	if err != nil {
		return out{ms: ms}, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return out{status: res.StatusCode, ms: ms}, err
	}
	var env envelope
	_ = json.Unmarshal(raw, &env)
	return out{status: res.StatusCode, body: raw, ms: ms, env: env}, nil
}

func trace(method, path string, o out) {
	log(fmt.Sprintf("> %s %s", method, path))
	tail := ""
	if len(o.body) > 0 {
		s := string(o.body)
		if len(s) > 72 {
			s = s[:72]
		}
		tail = " | " + s
	}
	log(fmt.Sprintf("< %d | %d ms%s", o.status, o.ms, tail))
}

func expectOk(o out, what string) json.RawMessage {
	if o.status >= 400 || !o.env.Success {
		code := ""
		if o.env.Error != nil {
			code = o.env.Error.Code
		}
		check(what, false, fmt.Sprintf("status %d %s", o.status, code))
		return nil
	}
	return o.env.Data
}

type loginData struct {
	Token string `json:"token"`
}

type databasesData struct {
	Databases []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"databases"`
}

type createdDatabaseData struct {
	Database struct {
		ID string `json:"id"`
	} `json:"database"`
}

type apiKeyData struct {
	APIKey struct {
		ID string `json:"id"`
	} `json:"apiKey"`
	Plaintext string `json:"plaintext"`
}

type commandData struct {
	Result any `json:"result"`
}

type pipelineData struct {
	Results []struct {
		Result any `json:"result"`
	} `json:"results"`
}

func mask(t string) string {
	if len(t) < 8 {
		return t
	}
	return t[:8] + "..."
}

func num(v any) float64 {
	f, _ := v.(float64)
	return f
}

func main() {
	log(fmt.Sprintf("client    : Go (stdlib net/http) -- transport: net/http"))
	log(fmt.Sprintf("identity  : default User-Agent: Go-http-client/2.0"))
	log(fmt.Sprintf("auth live : %s", EMAIL))

	defer func() {
		if id, ok := ids["databaseId"]; ok {
			o, _ := call("DELETE", "/api/databases/"+id, ids["token"], nil)
			trace("DELETE", "/api/databases/"+id+" (teardown)", o)
			check("lab database deleted with scoped keys", o.status == 200, fmt.Sprintf("status %d", o.status))
		}
		verdict := "ALL PASS"
		if failures > 0 {
			verdict = "FAILURES"
		}
		log(fmt.Sprintf("%s -- %d/%d checks", verdict, checks-failures, checks))
		log("")
		if failures > 0 {
			os.Exit(1)
		}
	}()

	/* Step 0: login -> session token */
	loginBody, _ := json.Marshal(map[string]string{"email": EMAIL, "password": PASSWORD})
	o, err := call("POST", "/api/auth/login", "", loginBody)
	if err != nil {
		log(fmt.Sprintf("FAIL  transport error: %v", err))
		return
	}
	trace("POST", "/api/auth/login", o)
	var session loginData
	if raw := expectOk(o, "login"); raw != nil {
		_ = json.Unmarshal(raw, &session)
	}
	if session.Token == "" {
		return
	}
	ids["token"] = session.Token

	/* Self-heal: labs left behind by crashed runs of this lang */
	o, _ = call("GET", "/api/databases", session.Token, nil)
	trace("GET", "/api/databases", o)
	if raw := expectOk(o, "list databases"); raw != nil {
		var listing databasesData
		_ = json.Unmarshal(raw, &listing)
		for _, db := range listing.Databases {
			if strings.HasPrefix(db.Name, fmt.Sprintf("fw-lab-%s-", LANG)) {
				o2, _ := call("DELETE", "/api/databases/"+db.ID, session.Token, nil)
				trace("DELETE", "/api/databases/"+db.ID+" (stale lab)", o2)
			}
		}
	}

	/* Step 1: dedicated lab database (deleted at teardown, cascade) */
	dbBody, _ := json.Marshal(map[string]string{"name": dbName})
	o, _ = call("POST", "/api/databases", session.Token, dbBody)
	trace("POST", "/api/databases", o)
	var created createdDatabaseData
	if raw := expectOk(o, "create lab database"); raw != nil {
		_ = json.Unmarshal(raw, &created)
	}
	ids["databaseId"] = created.Database.ID

	/* Step 2: scoped read-write API key (plaintext returned exactly once) */
	keyBody, _ := json.Marshal(map[string]string{
		"name":       fmt.Sprintf("fw-%s-%d", LANG, epoch),
		"databaseId": ids["databaseId"],
		"permission": "read-write",
	})
	o, _ = call("POST", "/api/api-keys", session.Token, keyBody)
	trace("POST", "/api/api-keys", o)
	var keyData apiKeyData
	if raw := expectOk(o, "create scoped api key"); raw != nil {
		_ = json.Unmarshal(raw, &keyData)
		ids["keyId"] = keyData.APIKey.ID
		log(fmt.Sprintf("  plaintext token issued once: %s", mask(keyData.Plaintext)))
	}

	apiToken := keyData.Plaintext
	cmdPath := fmt.Sprintf("/api/data/%s/command", ids["databaseId"])

	send := func(name string, args ...any) (out, commandData) {
		cmdJSON, _ := json.Marshal(map[string]any{"command": name, "args": args})
		log(fmt.Sprintf("^ %s | Bearer %s", string(cmdJSON), mask(apiToken)))
		o, err := call("POST", cmdPath, apiToken, cmdJSON)
		if err != nil {
			log(fmt.Sprintf("FAIL  transport error: %v", err))
		}
		var cd commandData
		if o.env.Data != nil {
			_ = json.Unmarshal(o.env.Data, &cd)
		}
		return o, cd
	}

	/* Step 3: SET with inline EX (Go idiom choice) */
	o, cd := send("SET", key, payload, "EX", 5)
	trace("POST", cmdPath+" (SET ... EX 5)", o)
	check("SET with EX 5 returns OK", fmt.Sprintf("%v", cd.Result) == "OK", fmt.Sprintf("%v", cd.Result))

	/* Step 4 (bonus): pipeline - atomic batch */
	incr := map[string]any{"command": "INCR", "args": []any{hitsKey}}
	pipeBody, _ := json.Marshal(map[string]any{"commands": []any{incr, incr, incr}})
	o, _ = call("POST", fmt.Sprintf("/api/data/%s/pipeline", ids["databaseId"]), apiToken, pipeBody)
	trace("POST", fmt.Sprintf("/api/data/%s/pipeline (INCR x3)", ids["databaseId"]), o)
	pd := pipelineData{}
	if raw := expectOk(o, "pipeline executes"); raw != nil {
		_ = json.Unmarshal(raw, &pd)
	}
	results := []float64{}
	for _, entry := range pd.Results {
		results = append(results, num(entry.Result))
	}
	check("pipeline INCR x3 -> [1,2,3]",
		len(results) == 3 && results[0] == 1 && results[1] == 2 && results[2] == 3,
		fmt.Sprintf("%v", results))

	/* Step 5: round trip */
	o, cd = send("GET", key)
	trace("POST", cmdPath+" (GET)", o)
	saved, _ := cd.Result.(string)
	check("value round-trips byte-for-byte", saved == payload, saved)

	/* Step 6/7: TTL + EXISTS while alive */
	o, cd = send("TTL", key)
	trace("POST", cmdPath+" (TTL)", o)
	ttl := num(cd.Result)
	check("TTL counts down 5->1", ttl >= 1 && ttl <= 5, fmt.Sprintf("TTL %v", cd.Result))

	o, cd = send("EXISTS", key)
	trace("POST", cmdPath+" (EXISTS)", o)
	exists := num(cd.Result)
	check("EXISTS is 1 before expiry", exists == 1, fmt.Sprintf("EXISTS %v", cd.Result))

	/* Step 8: wait past expiry */
	log("...waiting 6.5 s for the key to expire...")
	time.Sleep(6500 * time.Millisecond)

	/* Step 9/10: proof of expiry */
	o, cd = send("GET", key)
	trace("POST", cmdPath+" (GET after expiry)", o)
	check("expired key reads as Redis nil (JSON null)", cd.Result == nil, fmt.Sprintf("%v", cd.Result))

	o, cd = send("TTL", key)
	trace("POST", cmdPath+" (TTL after expiry)", o)
	check("TTL on expired key is -2 (no such key)", num(cd.Result) == -2, fmt.Sprintf("TTL %v", cd.Result))

	/* Step 11: revoke, prove rejection */
	o, _ = call("DELETE", "/api/api-keys/"+ids["keyId"], session.Token, nil)
	trace("DELETE", "/api/api-keys/"+ids["keyId"]+" (revoke)", o)
	expectOk(o, "revoke api key")
	o, cd = send("GET", key)
	trace("POST", cmdPath+" (revoked token)", o)
	check("revoked key is rejected 401", o.status == 401, fmt.Sprintf("status %d", o.status))
}

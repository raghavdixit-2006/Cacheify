#!/usr/bin/env python3
"""
Framework client test - Python
Transport: the `requests` module (Python's dedicated HTTP client).
Shared scenario with the other clients: see tests/clients/README.md.
Expiry idiom for this client: SETEX key <seconds> value (the classic set-with-TTL).
Output note: log lines are ASCII-only so any Windows console codepage can print them.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

BASE = (os.getenv("RH_BASE_URL") or "http://127.0.0.1:3000").rstrip("/")
EMAIL = "qa-review@redishost.test"
PASSWORD = "review-pass-77"

LANG = "python"
EPOCH = int(time.time() * 1000)
DB_NAME = f"fw-lab-{LANG}-{EPOCH}"
KEY = f"fw:{LANG}:session"
HITS_KEY = f"fw:{LANG}:hits"
PAYLOAD = json.dumps({"lang": LANG, "saved": datetime.now(timezone.utc).isoformat(), "note": "framework TTL test"})

checks = 0
failures = 0
ids = {}
session = requests.Session()


def log(line):
    print(line, flush=True)


def mask(token):
    return f"{token[:8]}..."


def check(name, ok, detail=""):
    global checks, failures
    checks += 1
    if not ok:
        failures += 1
    mark = "PASS" if ok else "FAIL"
    print(f"  {mark}  {name}" + (f" -- {detail}" if detail else ""), flush=True)


def call(method, path, token=None, body=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    started = time.perf_counter()
    res = session.request(method, BASE + path, headers=headers, json=body, timeout=25)
    ms = round((time.perf_counter() - started) * 1000)
    try:
        parsed = res.json()
    except ValueError:
        parsed = None
    return res, parsed, ms


def trace(method, path, res, parsed, ms):
    data = parsed.get("data") if isinstance(parsed, dict) and "data" in parsed else ""
    print(f"> {method} {path}", flush=True)
    shown = json.dumps(data) if data is not None else ""
    print(f"< {res.status_code} | {ms} ms" + (f" | {shown[:72]}" if shown else ""), flush=True)


def expect_ok(res, parsed, what):
    if res.status_code >= 400 or not isinstance(parsed, dict) or parsed.get("success") is not True:
        err = (parsed or {}).get("error") if isinstance(parsed, dict) else None
        check(what, False, f"status {res.status_code} {(err or {}).get('code', '')}")
        return None
    return parsed.get("data")


def main():
    print(f"client    : Python 3.{sys.version_info.minor} -- transport: requests/{requests.__version__}", flush=True)
    print(f"identity  : default User-Agent: {requests.utils.default_user_agent()}", flush=True)
    print(f"auth live : {EMAIL}", flush=True)

    # Step 0: login -> session token
    res, parsed, ms = call("POST", "/api/auth/login", body={"email": EMAIL, "password": PASSWORD})
    trace("POST", "/api/auth/login", res, parsed, ms)
    data = expect_ok(res, parsed, "login")
    if data is None:
        return
    token = data["token"]
    ids["token"] = token

    # Self-heal: labs left behind by crashed runs of this lang
    res, parsed, ms = call("GET", "/api/databases", token)
    trace("GET", "/api/databases", res, parsed, ms)
    for db in ((parsed or {}).get("data") or {}).get("databases", []):
        if (db.get("name") or "").startswith(f"fw-lab-{LANG}-"):
            res2, parsed2, ms2 = call("DELETE", f"/api/databases/{db['id']}", token)
            trace("DELETE", f"/api/databases/{db['id']} (stale lab)", res2, parsed2, ms2)

    # Step 1: lab database
    res, parsed, ms = call("POST", "/api/databases", token, body={"name": DB_NAME})
    trace("POST", "/api/databases", res, parsed, ms)
    wrapper = expect_ok(res, parsed, "create lab database") or {}
    database = (wrapper or {}).get("database") or {}
    ids["databaseId"] = database.get("id")

    # Step 2: scoped read-write API key (plaintext returned exactly once)
    res, parsed, ms = call("POST", "/api/api-keys", token, body={
        "name": f"fw-{LANG}-{EPOCH}", "databaseId": ids["databaseId"], "permission": "read-write",
    })
    trace("POST", "/api/api-keys", res, parsed, ms)
    key_data = expect_ok(res, parsed, "create scoped api key") or {}
    ids["keyId"] = (key_data.get("apiKey") or {}).get("id")
    print(f"  plaintext token issued once: {mask(key_data.get('plaintext', ''))}", flush=True)

    api_token = key_data["plaintext"]
    prefix = f"/api/data/{ids['databaseId']}/command"

    def send(cmd, args):
        body = {"command": cmd, "args": args}
        print(f"^ {cmd} {json.dumps(args)} | Bearer {mask(api_token)}", flush=True)
        res2, parsed2, ms2 = call("POST", prefix, api_token, body=body)
        return res2, parsed2, ms2, (parsed2 or {}).get("data", {}).get("result") if isinstance((parsed2 or {}).get("data"), dict) else None

    # Step 3: SETEX (Python idiom)
    res, parsed, ms, result = send("SETEX", [KEY, 5, PAYLOAD])
    trace("POST", f"{prefix} (SETEX ... 5 <json>)", res, parsed, ms)
    expect_ok(res, parsed, "SETEX with 5s TTL")
    check("SETEX returns OK", result == "OK", json.dumps(result))

    # Step 4 (bonus): pipeline, atomic batch
    res, parsed, ms = call("POST", f"/api/data/{ids['databaseId']}/pipeline", api_token, body={
        "commands": [
            {"command": "INCR", "args": [HITS_KEY]},
            {"command": "INCR", "args": [HITS_KEY]},
            {"command": "INCR", "args": [HITS_KEY]},
        ]
    })
    trace("POST", f"/api/data/{ids['databaseId']}/pipeline (INCR x3)", res, parsed, ms)
    pipe_data = expect_ok(res, parsed, "pipeline executes")
    results = [entry.get("result") for entry in ((pipe_data or {}).get("results") or [])]
    check("pipeline INCR x3 -> [1,2,3]", results == [1, 2, 3], json.dumps(results))

    # Step 5: round trip
    res, parsed, ms, saved = send("GET", [KEY])
    trace("POST", f"{prefix} (GET)", res, parsed, ms)
    check("value round-trips byte-for-byte", saved == PAYLOAD, f"{saved!r} vs {PAYLOAD[:24]}...")

    # Step 6/7: TTL + EXISTS while alive
    res, parsed, ms, ttl = send("TTL", [KEY])
    trace("POST", f"{prefix} (TTL)", res, parsed, ms)
    check("TTL counts down 5->1", isinstance(ttl, int) and 1 <= ttl <= 5, f"TTL {ttl}")

    res, parsed, ms, exists = send("EXISTS", [KEY])
    trace("POST", f"{prefix} (EXISTS)", res, parsed, ms)
    check("EXISTS is 1 before expiry", exists == 1, f"EXISTS {exists}")

    # Step 8: wait past expiry
    print("...waiting 6.5 s for the key to expire...", flush=True)
    time.sleep(6.5)

    # Step 9/10: proof of expiry
    res, parsed, ms, after = send("GET", [KEY])
    trace("POST", f"{prefix} (GET after expiry)", res, parsed, ms)
    check("expired key reads as Redis nil (JSON null)", after is None, repr(after))

    res, parsed, ms, ttl_after = send("TTL", [KEY])
    trace("POST", f"{prefix} (TTL after expiry)", res, parsed, ms)
    check("TTL on expired key is -2 (no such key)", ttl_after == -2, f"TTL {ttl_after}")

    # Step 11: revoke, prove rejection
    res, parsed, ms = call("DELETE", f"/api/api-keys/{ids['keyId']}", token)
    trace("DELETE", f"/api/api-keys/{ids['keyId']} (revoke)", res, parsed, ms)
    expect_ok(res, parsed, "revoke api key")
    res, parsed, ms, _ = send("GET", [KEY])
    trace("POST", f"{prefix} (revoked token)", res, parsed, ms)
    check("revoked key is rejected 401", res.status_code == 401 and isinstance(parsed, dict) and parsed.get("success") is False, f"status {res.status_code}")


try:
    main()
finally:
    if ids.get("databaseId"):
        res, parsed, _ms = call("DELETE", f"/api/databases/{ids['databaseId']}", ids.get("token"))
        trace("DELETE", f"/api/databases/{ids['databaseId']} (teardown)", res, parsed, _ms)
        check("lab database deleted with scoped keys", res.status_code == 200, f"status {res.status_code}")
    print(("ALL PASS" if failures == 0 else "FAILURES") + f" -- {checks - failures}/{checks} checks", flush=True)
    print("", flush=True)

# Exit code: only reached when main() completed (any unhandled exception
# above propagates and exits 1 with the traceback visible on stderr).
if failures > 0:
    sys.exit(1)

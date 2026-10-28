'use client';

/**
 * Developer console section for the marketing page.
 *
 * Left: the four supported integration snippets with a copy action.
 * Right: an explicitly labelled in-browser demo sandbox. No API key is
 * available in browser code, so the real command console lives behind auth;
 * this demo implements a small Redis-like command subset locally so visitors
 * can feel the workflow without pretending to be connected to the API.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../common/Icon.jsx';
import CopyButton from './CopyButton.jsx';
import { parseCommandLine } from '../../../utils/format.js';
import { API_EXAMPLE_ORIGIN } from '../../../utils/config.js';

const SNIPPETS = [
  {
    id: 'ts',
    label: 'TypeScript',
    code: `const res = await fetch("${API_EXAMPLE_ORIGIN}/api/data/<dbId>/command", {
  method: "POST",
  headers: {
    "authorization": "Bearer <rk_token>",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    command: "SET",
    args: ["session:9942", "active", "EX", "3600"],
  }),
});

const { data } = await res.json();
console.log(data.result); // "OK"`,
  },
  {
    id: 'py',
    label: 'Python',
    code: `import requests

res = requests.post(
    "${API_EXAMPLE_ORIGIN}/api/data/<dbId>/pipeline",
    headers={"Authorization": "Bearer <rk_token>"},
    json={"commands": [
        {"command": "HSET", "args": ["cart:7719", "sku-1", "2"]},
        {"command": "HGETALL", "args": ["cart:7719"]},
    ]},
)

print(res.json()["data"]["results"])`,
  },
  {
    id: 'go',
    label: 'Go',
    code: `package main

import (
    "bytes"
    "net/http"
)

func main() {
    body := []byte(\`{"command":"GET","args":["session:9942"]}\`)
    req, _ := http.NewRequest("POST",
        "${API_EXAMPLE_ORIGIN}/api/data/<dbId>/command",
        bytes.NewReader(body))
    req.Header.Set("Authorization", "Bearer <rk_token>")
    req.Header.Set("Content-Type", "application/json")
    http.DefaultClient.Do(req)
}`,
  },
  {
    id: 'curl',
    label: 'cURL',
    code: `curl -X POST ${API_EXAMPLE_ORIGIN}/api/data/$DB_ID/command \\
  -H "Authorization: Bearer $RK_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"command":"PING","args":[]}'`,
  },
];

const QUICK_COMMANDS = [
  'PING',
  'SET greeting "hello world"',
  'GET greeting',
  'INCR counter',
  'TTL greeting',
  'KEYS *',
];

const HELP = `PING
SET key value [EX seconds]
GET key
INCR key · DECR key
TTL key · EXPIRE key seconds
TYPE key · DEL key
KEYS pattern · DBSIZE
HSET key field value · HGETALL key
LPUSH key value · LRANGE key 0 -1
SADD key member · SMEMBERS key
ZADD key score member · ZRANGE key 0 -1
PERSIST is rejected by design.`;

const DEFAULT_TTL = 86400;

const INITIAL_STORE = () => ({
  greeting: { type: 'string', value: 'hello world', ttl: DEFAULT_TTL },
  counter: { type: 'string', value: '41', ttl: DEFAULT_TTL },
});

const ERROR = (message) => ({ text: `(error) ${message}`, kind: 'error' });
const OK = (text) => ({ text, kind: 'ok' });

function quoted(value) {
  return `"${String(value)}"`;
}

function bulkList(values) {
  if (!values.length) return '(empty array)';
  return values.map((value, index) => `${index + 1}) ${quoted(value)}`).join('\n');
}

function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

function runDemoCommand(raw, store) {
  const parsed = parseCommandLine(raw);
  if (!parsed) return null;

  const { command, args } = parsed;
  const keyName = args[0];

  if (command === 'PING') return OK('PONG');
  if (command === 'HELP') return OK(HELP);
  if (command === 'DBSIZE') return OK(`(integer) ${Object.keys(store).length}`);

  if (command === 'SET') {
    if (args.length < 2) return ERROR('ERR wrong number of arguments for SET');
    let ttl = DEFAULT_TTL;
    const optionIndex = args.findIndex((arg) => ['EX', 'PX'].includes(arg.toUpperCase()));
    if (optionIndex !== -1) {
      const option = args[optionIndex].toUpperCase();
      const amount = Number(args[optionIndex + 1]);
      if (!Number.isFinite(amount) || amount <= 0) return ERROR('ERR invalid expire time in SET');
      ttl = option === 'EX' ? Math.round(amount) : Math.round(amount / 1000);
    }
    store[keyName] = { type: 'string', value: args[1], ttl };
    return OK('OK');
  }

  if (command === 'GET') {
    const entry = store[keyName];
    if (!entry) return OK('(nil)');
    if (entry.type !== 'string') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    return OK(quoted(entry.value));
  }

  if (command === 'INCR' || command === 'DECR') {
    const entry = store[keyName];
    if (entry && entry.type !== 'string') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const current = entry ? Number(entry.value) : 0;
    if (!Number.isInteger(current)) return ERROR('ERR value is not an integer or out of range');
    const next = command === 'INCR' ? current + 1 : current - 1;
    store[keyName] = {
      type: 'string',
      value: String(next),
      ttl: entry ? entry.ttl : DEFAULT_TTL,
    };
    return OK(`(integer) ${next}`);
  }

  if (command === 'TTL') {
    const entry = store[keyName];
    if (!entry) return OK('(integer) -2');
    return OK(`(integer) ${entry.ttl}`);
  }

  if (command === 'EXPIRE') {
    const entry = store[keyName];
    if (!entry) return OK('(integer) 0');
    const seconds = Number(args[1]);
    if (!Number.isFinite(seconds) || seconds <= 0) return ERROR('ERR invalid expire time in EXPIRE');
    entry.ttl = Math.round(seconds);
    return OK('(integer) 1');
  }

  if (command === 'PERSIST') {
    return ERROR('ERR_VALIDATION Every key must expire; PERSIST is not supported.');
  }

  if (command === 'TYPE') {
    const entry = store[keyName];
    return OK(entry ? entry.type : 'none');
  }

  if (command === 'DEL' || command === 'UNLINK') {
    let removed = 0;
    args.forEach((key) => {
      if (store[key]) {
        delete store[key];
        removed += 1;
      }
    });
    return OK(`(integer) ${removed}`);
  }

  if (command === 'EXISTS') {
    return OK(`(integer) ${args.filter((key) => Boolean(store[key])).length}`);
  }

  if (command === 'KEYS') {
    const pattern = args[0] || '*';
    const matcher = patternToRegExp(pattern);
    return OK(bulkList(Object.keys(store).filter((key) => matcher.test(key)).sort()));
  }

  if (command === 'HSET') {
    if (args.length < 3 || args.length % 2 === 0) return ERROR('ERR wrong number of arguments for HSET');
    const entry = store[keyName];
    if (entry && entry.type !== 'hash') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const hash = entry || { type: 'hash', value: {}, ttl: DEFAULT_TTL };
    let added = 0;
    for (let index = 1; index < args.length; index += 2) {
      if (!(args[index] in hash.value)) added += 1;
      hash.value[args[index]] = args[index + 1];
    }
    store[keyName] = hash;
    return OK(`(integer) ${added}`);
  }

  if (command === 'HGET' || command === 'HGETALL') {
    const entry = store[keyName];
    if (!entry) return OK(command === 'HGET' ? '(nil)' : '(empty hash)');
    if (entry.type !== 'hash') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    if (command === 'HGET') {
      return entry.value[args[1]] === undefined ? OK('(nil)') : OK(quoted(entry.value[args[1]]));
    }
    const pairs = Object.entries(entry.value);
    return OK(pairs.length ? pairs.map(([field, value]) => `${field}: ${value}`).join('\n') : '(empty hash)');
  }

  if (command === 'LPUSH' || command === 'RPUSH') {
    if (args.length < 2) return ERROR(`ERR wrong number of arguments for ${command}`);
    const entry = store[keyName];
    if (entry && entry.type !== 'list') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const list = entry || { type: 'list', value: [], ttl: DEFAULT_TTL };
    if (command === 'LPUSH') list.value.unshift(...args.slice(1));
    else list.value.push(...args.slice(1));
    store[keyName] = list;
    return OK(`(integer) ${list.value.length}`);
  }

  if (command === 'LRANGE' || command === 'LLEN') {
    const entry = store[keyName];
    if (!entry) return OK(command === 'LLEN' ? '(integer) 0' : '(empty array)');
    if (entry.type !== 'list') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    if (command === 'LLEN') return OK(`(integer) ${entry.value.length}`);
    const start = Number(args[1] ?? 0);
    const stop = Number(args[2] ?? -1);
    const from = start < 0 ? Math.max(entry.value.length + start, 0) : start;
    const to = stop < 0 ? entry.value.length + stop : Math.min(stop, entry.value.length - 1);
    return OK(bulkList(entry.value.slice(from, to + 1)));
  }

  if (command === 'SADD') {
    if (args.length < 2) return ERROR('ERR wrong number of arguments for SADD');
    const entry = store[keyName];
    if (entry && entry.type !== 'set') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const set = entry || { type: 'set', value: [], ttl: DEFAULT_TTL };
    let added = 0;
    args.slice(1).forEach((member) => {
      if (!set.value.includes(member)) {
        set.value.push(member);
        added += 1;
      }
    });
    store[keyName] = set;
    return OK(`(integer) ${added}`);
  }

  if (command === 'SMEMBERS') {
    const entry = store[keyName];
    if (!entry) return OK('(empty array)');
    if (entry.type !== 'set') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    return OK(bulkList(entry.value));
  }

  if (command === 'ZADD') {
    if (args.length < 3 || args.length % 2 === 0) return ERROR('ERR wrong number of arguments for ZADD');
    const entry = store[keyName];
    if (entry && entry.type !== 'zset') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const zset = entry || { type: 'zset', value: [], ttl: DEFAULT_TTL };
    let added = 0;
    for (let index = 1; index < args.length; index += 2) {
      const score = Number(args[index]);
      const member = args[index + 1];
      if (!Number.isFinite(score)) return ERROR('ERR value is not a valid float');
      const existing = zset.value.find((item) => item.member === member);
      if (existing) existing.score = score;
      else {
        zset.value.push({ member, score });
        added += 1;
      }
    }
    zset.value.sort((left, right) => left.score - right.score);
    store[keyName] = zset;
    return OK(`(integer) ${added}`);
  }

  if (command === 'ZRANGE') {
    const entry = store[keyName];
    if (!entry) return OK('(empty array)');
    if (entry.type !== 'zset') return ERROR('WRONGTYPE Operation against a key holding the wrong kind of value');
    const withScores = args.some((arg) => arg.toUpperCase() === 'WITHSCORES');
    const start = Number(args[1] ?? 0);
    const stop = Number(args[2] ?? -1);
    const from = start < 0 ? Math.max(entry.value.length + start, 0) : start;
    const to = stop < 0 ? entry.value.length + stop : Math.min(stop, entry.value.length - 1);
    const slice = entry.value.slice(from, to + 1);
    if (!slice.length) return OK('(empty array)');
    return OK(slice.map((item, index) => (
      withScores ? `${index + 1}) ${quoted(item.member)} ${item.score}` : `${index + 1}) ${quoted(item.member)}`
    )).join('\n'));
  }

  return ERROR(`ERR unknown command '${command}'`);
}

const TOKEN_PATTERN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|await|async|import|from|func|package|return|print|def|new|if|for)\b|(\$[A-Z_][A-Z0-9_]*)/g;

function highlightCode(code) {
  return code.split('\n').map((line, lineIndex) => {
    if (/^\s*(#|\/\/)/.test(line)) {
      return (
        <span className="tok-comment" key={`line-${lineIndex}`}>
          {line || ' '}
          {'\n'}
        </span>
      );
    }

    const parts = [];
    let cursor = 0;
    let match = TOKEN_PATTERN.exec(line);
    while (match) {
      if (match.index > cursor) parts.push(line.slice(cursor, match.index));
      const className = match[1] ? 'tok-string' : match[2] ? 'tok-keyword' : 'tok-var';
      parts.push(<span className={className} key={`${lineIndex}-${match.index}`}>{match[0]}</span>);
      cursor = match.index + match[0].length;
      match = TOKEN_PATTERN.exec(line);
    }
    if (cursor < line.length) parts.push(line.slice(cursor));
    TOKEN_PATTERN.lastIndex = 0;
    return (
      <span key={`line-${lineIndex}`}>
        {parts}
        {'\n'}
      </span>
    );
  });
}

export default function LandingConsole() {
  const [activeTab, setActiveTab] = useState('ts');
  const [entries, setEntries] = useState([
    { id: 1, command: 'PING', result: 'PONG', kind: 'ok' },
    { id: 2, command: 'GET greeting', result: '"hello world"', kind: 'ok' },
  ]);
  const [input, setInput] = useState('');
  const storeRef = useRef(INITIAL_STORE());
  const logRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const nextIdRef = useRef(3);
  const activeSnippet = SNIPPETS.find((snippet) => snippet.id === activeTab) || SNIPPETS[0];

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries]);

  function execute(raw) {
    const command = raw.trim();
    if (!command) return;
    const outcome = runDemoCommand(command, storeRef.current);
    if (!outcome) return;

    historyRef.current = [...historyRef.current.slice(-30), command];
    historyIndexRef.current = -1;
    setEntries((current) => [
      ...current.slice(-60),
      { id: nextIdRef.current++, command, result: outcome.text, kind: outcome.kind },
    ]);
    setInput('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    execute(input);
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowUp' && historyRef.current.length) {
      event.preventDefault();
      const nextIndex = historyIndexRef.current < 0
        ? historyRef.current.length - 1
        : Math.max(historyIndexRef.current - 1, 0);
      historyIndexRef.current = nextIndex;
      setInput(historyRef.current[nextIndex]);
    }
    if (event.key === 'ArrowDown' && historyRef.current.length) {
      event.preventDefault();
      const nextIndex = historyIndexRef.current + 1;
      if (nextIndex >= historyRef.current.length) {
        historyIndexRef.current = -1;
        setInput('');
      } else {
        historyIndexRef.current = nextIndex;
        setInput(historyRef.current[nextIndex]);
      }
    }
  }

  function handleTabKeyDown(event, index) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % SNIPPETS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + SNIPPETS.length) % SNIPPETS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = SNIPPETS.length - 1;
    setActiveTab(SNIPPETS[nextIndex].id);
    document.getElementById(`console-tab-${SNIPPETS[nextIndex].id}`)?.focus();
  }

  return (
    <div className="console-shell" id="console">
      <div className="console-shell-head">
        <div>
          <p className="landing-eyebrow">
            <span className="dot" />
            Developer console
          </p>
          <h2>Write a command. See the contract.</h2>
          <p>
            The same JSON envelope whether you call it from a service, a cron job,
            a container or an AI agent.
          </p>
        </div>
        <span className="console-demo-badge">
          <Icon name="play-circle" />
          Interactive demo
        </span>
      </div>

      <div className="console-grid">
        <div className="console-panel console-panel-code">
          <div className="console-panel-head">
            <span className="console-panel-label">
              <Icon name="braces" />
              Integration
            </span>
            <CopyButton
              text={activeSnippet.code}
              label="Copy snippet"
              copiedLabel="Copied"
              className="console-copy"
              iconName="clipboard"
            />
          </div>

          <div className="console-tabs" role="tablist" aria-label="Integration examples">
            {SNIPPETS.map((snippet, index) => (
              <button
                key={snippet.id}
                type="button"
                id={`console-tab-${snippet.id}`}
                role="tab"
                aria-selected={activeTab === snippet.id}
                aria-controls={`console-panel-${snippet.id}`}
                tabIndex={activeTab === snippet.id ? 0 : -1}
                className={`console-tab${activeTab === snippet.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(snippet.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {snippet.label}
              </button>
            ))}
          </div>

          <div
            className="console-code-wrap"
            id={`console-panel-${activeSnippet.id}`}
            role="tabpanel"
            aria-labelledby={`console-tab-${activeSnippet.id}`}
            tabIndex={0}
          >
            <pre className="console-code"><code>{highlightCode(activeSnippet.code)}</code></pre>
          </div>

          <div className="console-panel-foot">
            <span>
              <Icon name="shield-check" />
              Server-side permission checks
            </span>
            <code>{'{ success, data, meta }'}</code>
          </div>
        </div>

        <div className="console-panel console-panel-repl">
          <div className="console-panel-head">
            <span className="console-panel-label">
              <Icon name="terminal" />
              Demo REPL
            </span>
            <span className="console-sandbox-label">Local sandbox</span>
          </div>

          <p className="console-demo-note">
            <Icon name="info-circle" />
            <span>
              Not connected to the API. Data lives in this tab and resets on refresh.
              <a href="/login"> Open the real console</a> to run commands against a database.
            </span>
          </p>

          <div className="console-log" ref={logRef} role="log" aria-live="polite" aria-label="Demo command output">
            {entries.map((entry) => (
              <div className={`console-entry${entry.kind === 'error' ? ' is-error' : ''}`} key={entry.id}>
                <div className="console-entry-command">
                  <span className="console-entry-prompt">&gt;</span>
                  <span>{entry.command}</span>
                </div>
                <pre className="console-entry-result">{entry.result}</pre>
              </div>
            ))}
          </div>

          <form className="console-input-row" onSubmit={handleSubmit}>
            <span className="console-input-prompt" aria-hidden="true">&gt;</span>
            <label className="sr-only" htmlFor="demo-command">Demo command</label>
            <input
              id="demo-command"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Try PING, GET greeting, INCR counter..."
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" className="console-run-btn">
              Run
            </button>
          </form>

          <div className="console-quick">
            <span>Quick:</span>
            {QUICK_COMMANDS.map((command) => (
              <button key={command} type="button" onClick={() => execute(command)}>
                {command}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

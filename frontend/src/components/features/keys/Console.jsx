'use client';

/**
 * Command console: forgiving format (quoted tokens accepted), Redis-style
 * command language against the platform's /command endpoint. Output renders
 * newest-first to match the original region.prepend() behavior.
 */

import { useRef, useState } from 'react';
import { Icon } from '../../common/Icon.jsx';
import { Button } from '../../common/atoms.jsx';
import { runCommand } from '../../../services/databaseService.js';
import { parseCommandLine } from '../../../utils/format.js';
import { errorToMessage } from '../../../utils/validators.js';

const HELP_TEXT =
  'Examples:\n' +
  '  SET greeting "hello world"\n' +
  '  GET greeting\n' +
  '  INCR counter\n' +
  '  LPUSH queue alpha beta\n' +
  '  LRANGE queue 0 -1\n' +
  '  HSET user:1 name Ada email ada@example.dev\n' +
  '  ZADD board 10 ada 5 bob\n' +
  '  TTL greeting\n' +
  '  KEYS *';

export default function Console({ dbId }) {
  const [entries, setEntries] = useState([]); // { id, command, result, error }
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const sequenceRef = useRef(0);

  function prepend(entry) {
    setEntries((current) => [entry, ...current]);
  }

  async function execute() {
    const parsed = parseCommandLine(inputRef.current.value);
    if (!parsed) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    sequenceRef.current += 1;
    const entryId = sequenceRef.current;
    prepend({ id: entryId, command: `> ${inputRef.current.value.trim()}`, result: null, error: null });

    try {
      const { data } = await runCommand(dbId, parsed.command, parsed.args);
      setEntries((current) => current.map(
        (entry) => (entry.id === entryId ? { ...entry, result: JSON.stringify(data.result, null, 2) } : entry),
      ));
      inputRef.current.value = '';
      inputRef.current.focus();
    } catch (err) {
      setEntries((current) => current.map(
        (entry) => (entry.id === entryId ? { ...entry, error: `error: ${errorToMessage(err)}` } : entry),
      ));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="console">
      <div className="console-label">
        <Icon name="terminal" />
        {' '}
        Command console
      </div>

      <pre className="key-preview" aria-label="Command examples">{HELP_TEXT}</pre>

      <div className="command-row">
        <input
          type="text"
          id="console-command"
          placeholder="Command, e.g. SET greeting &quot;hello world&quot;"
          aria-label="Redis command"
          data-agent-action="console-command"
          ref={inputRef}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void execute();
            }
          }}
        />
        <Button label="Run" iconName="terminal" variant="primary" onClick={() => void execute()} disabled={busy} />
      </div>

      <div
        role="region"
        aria-live="polite"
        aria-label="Command output"
        style={{ marginTop: '12px' }}
      >
        {entries.map((entry) => (
          <div key={entry.id}>
            <pre className="key-preview console-command">{entry.command}</pre>
            {entry.result !== null ? (
              <pre className="key-preview">{entry.result}</pre>
            ) : null}
            {entry.error !== null ? (
              <pre className="key-preview console-error" style={{ color: 'var(--color-danger-on-dark)' }}>{entry.error}</pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

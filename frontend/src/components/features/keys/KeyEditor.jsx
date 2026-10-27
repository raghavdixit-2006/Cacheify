'use client';

/**
 * Key editor panel: typed value editing, TTL controls, destructive actions.
 * All business logic (read/write commands) goes through the service layer.
 */

import { useState } from 'react';
import { Icon } from '../../common/Icon.jsx';
import { Badge, Button } from '../../common/atoms.jsx';
import Modal from '../../common/Modal.jsx';
import { showToast, showErrorToast } from '../../common/toasts.js';
import { runPipeline, runCommand, getKey } from '../../../services/databaseService.js';
import { errorToMessage } from '../../../utils/validators.js';
import { formatTtl } from '../../../utils/format.js';

const TYPE_ICONS = { string: 'font', list: 'list-ul', set: 'diagram-3', hash: 'table', zset: 'sort-numeric-down' };

/** Draft for the value input appropriate for the key type. */
function buildDraft(type, value) {
  if (type === 'string') {
    return { kind: 'lines', text: value == null ? '' : String(value) };
  }
  if (type === 'list' || type === 'set') {
    return { kind: 'lines', text: (value || []).join('\n') };
  }
  if (type === 'hash') {
    return { kind: 'pairs', rows: Object.entries(value || {}).map(([key, val]) => ({ key, value: String(val) })) };
  }
  if (type === 'zset') {
    return { kind: 'pairs', rows: (value || []).map((entry) => ({ key: entry.member, value: String(entry.score) })) };
  }
  return { kind: 'lines', text: '' };
}

const PAIR_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '280px',
  overflow: 'auto',
};
const PAIR_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto',
  gap: '8px',
  alignItems: 'end',
};
const PAIR_INPUT_STYLE = {
  padding: '8px',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  fontFamily: 'var(--font-mono)',
  fontSize: '14px',
  minHeight: '44px',
};

export default function KeyEditor({ dbId, detail, mode = null, onDeleted = null }) {
  /* detail = null -> placeholder; mode 'cleared' -> deleted note (from page);
     mode 'editor' -> an editable key detail. The parent remounts the editor
     per selection (version key), so each mount initializes its drafts from
     the detail it receives. */
  const [current, setCurrent] = useState(mode === 'editor' ? detail : null);
  const [draft, setDraft] = useState(() => (mode === 'editor' && detail ? buildDraft(detail.type, detail.value) : null));
  const [ttl, setTtl] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (mode === 'cleared') {
    return (
      <div className="empty-state">
        <p className="muted" style={{ margin: '0' }}>Key deleted. Select another key or type a new command in the console.</p>
      </div>
    );
  }

  if (!current || mode !== 'editor') {
    return (
      <div className="empty-state">
        <Icon name="hand-index" />
        <p style={{ margin: '0' }}>Select a key from the list, or add a new one with the console below.</p>
      </div>
    );
  }

  /* ----------------------------- Post-write -------------------------------- */

  async function refresh() {
    if (!current) return;
    const exists = await runCommand(dbId, 'EXISTS', [current.name]);
    if (exists.data.result === 1) {
      const { data } = await getKey(dbId, current.name);
      const next = { name: current.name, ...data.key };
      setCurrent(next);
      setDraft(buildDraft(next.type, next.value));
    } else {
      setCurrent(null);
      setDraft(null);
    }
  }

  async function saveValue() {
    try {
      const commands = [];
      if (draft.kind === 'lines') {
        const lines = draft.text.split('\n').filter((line) => line !== '');
        commands.push({ command: 'DEL', args: [current.name] });
        if (current.type === 'string') {
          if (lines.length > 0) commands.push({ command: 'SET', args: [current.name, lines[0]] });
        } else {
          commands.push({ command: current.type === 'list' ? 'RPUSH' : 'SADD', args: [current.name, ...lines] });
        }
      } else {
        commands.push({ command: 'DEL', args: [current.name] });
        const rows = draft.rows.filter((row) => row.key.trim() !== '');
        if (rows.length > 0) {
          const args = rows.flatMap((row) => [row.key, row.value]);
          commands.push({ command: current.type === 'hash' ? 'HSET' : 'ZADD', args: [current.name, ...args] });
        }
      }
      await runPipeline(dbId, commands);
      showToast('Value saved');
      await refresh();
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not save value'));
    }
  }

  async function deleteCurrent() {
    try {
      await runCommand(dbId, 'DEL', [current.name]);
      showToast(`Key "${current.name}" deleted`);
      if (onDeleted) onDeleted();
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not delete key'));
    }
  }

  async function confirmDeleteCurrent() {
    setConfirmOpen(false);
    await deleteCurrent();
  }

  async function setExpiry() {
    const seconds = Number(ttl);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      showErrorToast('Enter a positive number of seconds');
      return;
    }
    try {
      await runCommand(dbId, 'PEXPIRE', [current.name, String(Math.round(seconds * 1000))]);
      showToast('Expiry set');
      await refresh();
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not set expiry'));
    }
  }

  async function removeExpiry() {
    try {
      await runCommand(dbId, 'PERSIST', [current.name]);
      showToast('Expiry removed');
      await refresh();
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not remove expiry'));
    }
  }

  /* ------------------------------- Rendering -------------------------------- */

  const meta = (
    <p className="muted" style={{ fontSize: '13px', margin: '0 0 12px' }}>
      {`Size: ${(current.bytes / 1024).toFixed(1)} KB | TTL: ${formatTtl(current.ttlMs)}`}
    </p>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h2 style={{ margin: '0', fontSize: '17px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', flex: 1 }}>
          <Icon name={TYPE_ICONS[current.type] || 'braces'} />
          {` ${current.name}`}
        </h2>
        <Badge text={current.type} kind="type" />
      </div>

      {meta}

      {draft.kind === 'lines' ? (
        <textarea
          rows={8}
          placeholder="one value per line"
          aria-label="Key value"
          value={draft.text}
          onChange={(event) => setDraft({ ...draft, text: event.target.value })}
        />
      ) : (
        <div style={PAIR_CONTAINER_STYLE}>
          <div style={PAIR_GRID_STYLE}>
            {draft.rows.map((row, index) => (
              <div key={index} data-role="pair-row" style={{ display: 'contents' }}>
                <input
                  type="text"
                  data-role="pair-key"
                  aria-label={current.type === 'hash' ? 'Field' : 'Member'}
                  placeholder={current.type === 'hash' ? 'Field' : 'Member'}
                  value={row.key}
                  style={PAIR_INPUT_STYLE}
                  onChange={(event) => {
                    const rows = [...draft.rows];
                    rows[index] = { ...rows[index], key: event.target.value };
                    setDraft({ ...draft, rows });
                  }}
                />
                <input
                  type="text"
                  data-role="pair-value"
                  aria-label={current.type === 'hash' ? 'Value' : 'Score'}
                  placeholder={current.type === 'hash' ? 'Value' : 'Score'}
                  value={row.value}
                  style={PAIR_INPUT_STYLE}
                  onChange={(event) => {
                    const rows = [...draft.rows];
                    rows[index] = { ...rows[index], value: event.target.value };
                    setDraft({ ...draft, rows });
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={`Remove ${current.type === 'hash' ? 'Field' : 'Member'} row`}
                  onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== index) })}
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
          <Button
            label="Add row"
            iconName="plus"
            onClick={() => setDraft({ ...draft, rows: [...draft.rows, { key: '', value: '' }] })}
          />
        </div>
      )}

      {/* TTL controls (seconds, Redis EXPIRE semantics). */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'end', marginTop: '16px', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: '0' }}>
          <label htmlFor="ttl-input">Set expiry (seconds)</label>
          <input
            type="number"
            id="ttl-input"
            min="1"
            placeholder="e.g. 3600"
            style={{ minHeight: '44px' }}
            value={ttl}
            onChange={(event) => setTtl(event.target.value)}
          />
        </div>
        <Button label="Set expiry" iconName="clock" onClick={() => void setExpiry()} />
        <Button label="Remove expiry" iconName="infinity" onClick={() => void removeExpiry()} />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button label="Save value" iconName="save" variant="primary" onClick={() => void saveValue()} />
        <Button label="Delete key" iconName="trash" variant="danger" onClick={() => setConfirmOpen(true)} />
      </div>

      <Modal
        open={confirmOpen}
        title="Delete key"
        onClose={() => setConfirmOpen(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setConfirmOpen(false)} />
            <Button label="Delete" variant="danger" onClick={() => void confirmDeleteCurrent()} />
          </>
        )}
      >
        <p>{`Delete key "${current.name}" permanently?`}</p>
      </Modal>
    </>
  );
}

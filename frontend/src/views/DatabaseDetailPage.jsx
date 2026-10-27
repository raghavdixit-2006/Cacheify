'use client';

/**
 * Database detail page (screen archetype: Focus + Do).
 * Top: database identity + dedicated connection string + the database's
 * single API key (exactly one active key per database, managed in place).
 * Below: the key browser split view and the command console.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, Spinner, Badge } from '../components/common/atoms.jsx';
import Field from '../components/common/Field.jsx';
import Modal from '../components/common/Modal.jsx';
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx';
import KeyList from '../components/features/keys/KeyList.jsx';
import KeyEditor from '../components/features/keys/KeyEditor.jsx';
import Console from '../components/features/keys/Console.jsx';
import PlaintextReveal, { copyToClipboard } from '../components/features/keys/PlaintextReveal.jsx';
import { getDatabase, deleteDatabase } from '../services/databaseService.js';
import { getKey } from '../services/databaseService.js';
import {
  getDatabaseApiKey, createDatabaseApiKey, revokeApiKey,
} from '../services/adminService.js';
import { errorToMessage, validateRequired } from '../utils/validators.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import { navigate } from '../router/navigate.js';
import { apiOrigin } from '../utils/config.js';

const PERMISSIONS = [
  { value: 'read-write', label: 'Read and write', hint: 'Full data access: get, set, delete, TTL.' },
  { value: 'read-only', label: 'Read only', hint: 'Can read values and keys. Writes are denied server-side.' },
];

/** Label + mono value + copy chip, stacked. */
function connectionRow(label, value, monoLarge) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '10.5px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: '700', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' }}>
        <div className="mono" style={{ flex: '1', minWidth: '0', overflowWrap: 'anywhere', fontSize: monoLarge ? '13px' : '12px', color: 'var(--color-text)' }}>
          {value}
        </div>
        <Button
          label="Copy"
          iconName="clipboard"
          variant="ghost"
          ariaLabel={`Copy ${label.toLowerCase()}`}
          onClick={() => copyToClipboard(value, 'Copied to clipboard', 'Copy failed. Select the value and copy manually.')}
        />
      </div>
    </div>
  );
}

export default function DatabaseDetailPage({ dbId }) {
  const [database, setDatabase] = useState(null);
  const [loadError, setLoadError] = useState(null);

  /* Key column state: 'loading' | 'error' | 'none' | 'ready' */
  const [keyPhase, setKeyPhase] = useState('loading');
  const [keyError, setKeyError] = useState(null);
  const [activeKey, setActiveKey] = useState(null);

  /* Split view selection */
  const [selectedKey, setSelectedKey] = useState(null);
  const [editorMode, setEditorMode] = useState(null); // null | 'ready' | 'cleared'
  const [editorDetail, setEditorDetail] = useState(null);
  const [editorSeq, setEditorSeq] = useState(0);

  /* Create key modal */
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [permission, setPermission] = useState('read-write');
  const [createKeyError, setCreateKeyError] = useState(null);
  const [createKeyBusy, setCreateKeyBusy] = useState(false);
  const keyNameFieldRef = useRef(null);

  /* Plaintext-once reveal */
  const [reveal, setReveal] = useState({ open: false, plaintext: '' });

  /* Confirmations */
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDatabase(dbId)
      .then(({ data }) => {
        if (!cancelled) setDatabase(data.database);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorToMessage(err, 'Could not load this database'));
      });
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  async function refreshKeySection() {
    setKeyPhase('loading');
    try {
      const { data } = await getDatabaseApiKey(dbId);
      const apiKey = data.apiKey;
      setActiveKey(apiKey);
      setKeyPhase(apiKey ? 'ready' : 'none');
    } catch (err) {
      setKeyError(errorToMessage(err, 'Could not load the key state'));
      setKeyPhase('error');
    }
  }

  useEffect(() => {
    if (!database) return undefined;
    void refreshKeySection();
    return () => {
      /* no cleanup needed; state swapped per render */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database]);

  /* --------------------------- Key selection ------------------------------- */

  async function handleSelect(keyRow) {
    setSelectedKey(keyRow.name);
    try {
      const { data } = await getKey(dbId, keyRow.name);
      setEditorDetail({ name: keyRow.name, ...data.key });
      setEditorMode('ready');
      setEditorSeq((seq) => seq + 1);
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not load key'));
    }
  }

  /* ----------------------------- Create key -------------------------------- */

  function openCreateKey() {
    setKeyName('');
    setPermission('read-write');
    setCreateKeyError(null);
    setCreateKeyBusy(false);
    setCreateKeyOpen(true);
  }

  async function submitCreateKey() {
    if (!keyNameFieldRef.current.validate()) return;
    setCreateKeyBusy(true);
    try {
      const { data } = await createDatabaseApiKey(dbId, {
        name: keyName.trim(),
        permission,
      });
      setCreateKeyOpen(false);
      void refreshKeySection();
      setReveal({ open: true, plaintext: data.plaintext });
    } catch (err) {
      setCreateKeyError(errorToMessage(err, 'Could not create the key'));
      setCreateKeyBusy(false);
    }
  }

  /* ------------------------------ Revoke key -------------------------------- */

  async function submitRevoke() {
    try {
      await revokeApiKey(activeKey.id);
      showToast(`Key "${activeKey.name}" revoked`);
      void refreshKeySection();
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not revoke the key'));
    }
  }

  /* --------------------------- Delete database ------------------------------ */

  async function confirmDeleteDatabase() {
    try {
      await deleteDatabase(dbId);
      showToast('Database deleted');
      navigate('/databases');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not delete database'));
    }
  }

  /* -------------------------------- Loader ---------------------------------- */

  if (loadError) {
    return (
      <div>
        <p className="inline-error" role="alert">{loadError}</p>
        <Button label="Back to overview" iconName="arrow-left" onClick={() => navigate('/databases')} />
      </div>
    );
  }

  if (!database) {
    return <Spinner label="Loading database" />;
  }

  /* --------------------------- Key column body ------------------------------ */

  function keyColumn() {
    if (keyPhase === 'loading') {
      return <Spinner label="Loading key state" />;
    }
    if (keyPhase === 'error') {
      return <p className="inline-error" role="alert">{keyError}</p>;
    }

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>API key</div>
          <Badge
            text={activeKey ? '1 key active' : 'no key yet'}
            kind={activeKey ? 'status-active' : 'status-archived'}
          />
        </div>

        {!activeKey ? (
          <>
            <p style={{ margin: '0 0 12px', color: 'var(--color-muted)', fontSize: '13px', lineHeight: 1.5 }}>
              No API key yet. This database allows exactly one active key - mint it here and use its plaintext as the bearer token above.
            </p>
            <Button label="Create API key" iconName="key" variant="primary" onClick={openCreateKey} />
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '13px', marginBottom: '12px' }}>
              <span style={{ color: 'var(--color-muted)' }}>Name</span>
              <span>{activeKey.name}</span>
              <span style={{ color: 'var(--color-muted)' }}>Token prefix</span>
              <span className="mono">{`${activeKey.prefix}\u2026`}</span>
              <span style={{ color: 'var(--color-muted)' }}>Created</span>
              <span>{formatDate(activeKey.createdAt)}</span>
              <span style={{ color: 'var(--color-muted)' }}>Last used</span>
              <span>{activeKey.lastUsedAt ? formatDate(activeKey.lastUsedAt) : 'Never'}</span>
              <span style={{ color: 'var(--color-muted)' }}>Permission</span>
              <span>
                <Badge
                  text={activeKey.permission === 'read-only' ? 'Read only' : 'Read + write'}
                  kind={activeKey.permission === 'read-only' ? 'perm-read-only' : 'perm-read-write'}
                  iconName={activeKey.permission === 'read-only' ? 'eye' : 'pencil'}
                />
              </span>
            </div>
            <p className="hint">One active key per database. To rotate: revoke first, then mint a replacement.</p>
            <Button
              label="Revoke key"
              iconName="slash-circle"
              variant="danger"
              ariaLabel={`Revoke ${activeKey.name}`}
              onClick={() => setRevokeConfirm(true)}
            />
          </>
        )}
      </>
    );
  }

  /* ------------------------------ Full view --------------------------------- */

  const statChips = [
    ['Keys', database.stats ? database.stats.totalKeys : '-'],
    ['Size', database.stats ? formatBytes(database.stats.totalBytes) : '-'],
    ['Created', formatDate(database.createdAt)],
  ];

  return (
    <div>
      <Breadcrumbs
        trail={[
          { label: 'Databases', href: '/databases' },
          { label: database.name, current: true },
        ]}
      />

      {/* ------------------------------ Heading ------------------------------ */}
      <div className="page-toolbar" style={{ margin: '12px 0 16px' }}>
        <div className="page-heading" style={{ margin: '0' }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            <span aria-hidden="true">
              <Icon name={database.status === 'active' ? 'database' : 'lock'} />
            </span>
            {` ${database.name} `}
            <Badge text={database.status} kind={`status-${database.status}`} />
          </h1>
          {database.description ? <p>{database.description}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {statChips.map(([label, value]) => (
            <span className="stat" style={{ padding: '8px 14px' }} key={label}>
              <span className="label">{label}</span>
              <span className="value">{value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------- Connect card ---------------------------- */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">Connect your app</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px' }}>
          <div>
            {connectionRow('Database ID', database.id, false)}
            {connectionRow('Connection string', `${apiOrigin()}/api/data/${dbId}`, true)}
            {connectionRow('Auth header', 'Authorization: Bearer <your API key>', false)}
            <p className="hint">
              Every data call goes under the connection string (strings/, keys/, expire, command). Keep the key on your server - it is full access to this database within its permission.
            </p>
          </div>
          <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '20px', minWidth: '0' }}>
            {keyColumn()}
          </div>
        </div>
      </div>

      {/* -------------------- Archived notice + split view ------------------- */}
      {database.status === 'archived' ? (
        <p className="inline-error" role="status">
          This database is archived and read-only. Restore it from Dashboard settings to make changes.
        </p>
      ) : null}

      <div className="split-view">
        <div className="card">
          <div className="card-title">Keys</div>
          <KeyList dbId={dbId} selected={selectedKey} onSelect={handleSelect} />
        </div>
        <div className="card">
          <div className="card-title">Key details</div>
          <KeyEditor
            key={`${editorSeq}-${selectedKey ?? 'none'}`}
            dbId={dbId}
            detail={editorDetail}
            mode={editorMode}
            onDeleted={() => setEditorMode('cleared')}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <Console dbId={dbId} />
      </div>

      {/* ------------------------------ Actions ------------------------------ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '8px' }}>
        <Button
          label="Settings"
          iconName="sliders"
          variant="secondary"
          onClick={() => navigate(`/databases/${dbId}/settings`)}
        />
        <Button
          label="Delete database"
          iconName="trash"
          variant="danger"
          onClick={() => setDeleteConfirm(true)}
        />
      </div>

      {/* ------------------------------- Modals ------------------------------ */}
      <Modal
        open={createKeyOpen}
        title={`API key for "${database.name}"`}
        onClose={() => setCreateKeyOpen(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setCreateKeyOpen(false)} />
            <Button label="Create key" variant="primary" onClick={() => void submitCreateKey()} disabled={createKeyBusy} />
          </>
        )}
      >
        <Field
          ref={keyNameFieldRef}
          id="dbkey-name"
          label="Key name"
          required
          placeholder="e.g. production app, CI pipeline"
          hint="Shown only to you, for identification."
          value={keyName}
          onValueChange={setKeyName}
          validate={validateRequired}
        />
        <div className="field">
          <span>Permission *</span>
          {PERMISSIONS.map((entry, index) => (
            <label
              key={entry.value}
              htmlFor={`dbkey-permission-${index}`}
              style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '6px', cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="dbkey-permission"
                id={`dbkey-permission-${index}`}
                value={entry.value}
                checked={permission === entry.value}
                onChange={(event) => setPermission(event.target.value)}
              />
              <span>
                <strong>{entry.label}</strong>
                <span className="hint" style={{ display: 'block' }}>{entry.hint}</span>
              </span>
            </label>
          ))}
          <p className="hint">Enforced server-side on every request.</p>
        </div>
        <p className="inline-error" role="alert" hidden={!createKeyError}>{createKeyError}</p>
      </Modal>

      <Modal
        open={revokeConfirm}
        title="Revoke API key"
        onClose={() => setRevokeConfirm(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setRevokeConfirm(false)} />
            <Button
              label="Revoke key"
              variant="danger"
              onClick={() => {
                setRevokeConfirm(false);
                void submitRevoke();
              }}
            />
          </>
        )}
      >
        {activeKey ? (
          <p>{`Anything using "${activeKey.name}" loses access to "${database.name}" immediately. This cannot be undone.`}</p>
        ) : null}
      </Modal>

      <Modal
        open={deleteConfirm}
        title="Delete database"
        onClose={() => setDeleteConfirm(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setDeleteConfirm(false)} />
            <Button
              label="Delete database"
              variant="danger"
              onClick={() => {
                setDeleteConfirm(false);
                void confirmDeleteDatabase();
              }}
            />
          </>
        )}
      >
        <p>{`This deletes "${database.name}" and every key in it. This cannot be undone.`}</p>
      </Modal>

      <PlaintextReveal
        open={reveal.open}
        plaintext={reveal.plaintext}
        onClose={() => setReveal((state) => ({ ...state, open: false }))}
      />
    </div>
  );
}

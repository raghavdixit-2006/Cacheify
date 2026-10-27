'use client';

/**
 * API keys page (screen archetype: Collection).
 * Every key is scoped to exactly one database with an explicit permission
 * level; creation shows the plaintext exactly once with a copy action.
 * Revocation previews before executing (irreversible action guard).
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, Spinner, Badge, EmptyState } from '../components/common/atoms.jsx';
import Field from '../components/common/Field.jsx';
import Modal from '../components/common/Modal.jsx';
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import { listApiKeys, createApiKey, revokeApiKey } from '../services/adminService.js';
import { listDatabases } from '../services/databaseService.js';
import PlaintextReveal from '../components/features/keys/PlaintextReveal.jsx';
import { formatDate } from '../utils/format.js';
import { validateRequired, errorToMessage } from '../utils/validators.js';

const PERMISSIONS = [
  { value: 'read-write', label: 'Read and write', hint: 'Full data access: get, set, delete, TTL.' },
  { value: 'read-only', label: 'Read only', hint: 'Can read values and keys. All writes are denied by the server.' },
];

function permissionBadge(keyRow) {
  if (!keyRow.database) {
    return <Badge text="All databases (legacy)" kind="type" iconName="database" />;
  }
  return (
    <Badge
      text={keyRow.permission === 'read-only' ? 'Read only' : 'Read + write'}
      kind={keyRow.permission === 'read-only' ? 'perm-read-only' : 'perm-read-write'}
      iconName={keyRow.permission === 'read-only' ? 'eye' : 'pencil'}
    />
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);

  /* Create key modal */
  const [createOpen, setCreateOpen] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [activeDbIds, setActiveDbIds] = useState(() => new Set());
  const [databaseId, setDatabaseId] = useState('');
  const [keyName, setKeyName] = useState('');
  const [permission, setPermission] = useState('read-write');
  const [createError, setCreateError] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const nameFieldRef = useRef(null);

  /* Revocation + plaintext reveal */
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [reveal, setReveal] = useState({ open: false, plaintext: '' });

  useEffect(() => {
    let cancelled = false;
    listApiKeys()
      .then(({ data }) => {
        if (!cancelled) setKeys(data.apiKeys);
      })
      .catch((err) => {
        if (!cancelled) {
          showErrorToast(errorToMessage(err, 'Could not load API keys'));
          setKeys([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openCreate() {
    let listed = [];
    try {
      const result = await listDatabases();
      listed = (result.data.databases || []).filter((db) => db.status === 'active');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not load databases'));
      return;
    }
    if (listed.length === 0) {
      showErrorToast('Create a database first - API keys are scoped to a database.');
      return;
    }

    // One active key per database: databases already holding an active key
    // are marked and disabled (the server rejects them with 409 regardless).
    const taken = new Set(
      (keys || [])
        .filter((k) => !k.revokedAt && k.database && k.database.id)
        .map((k) => k.database.id),
    );
    setDatabases(listed);
    setActiveDbIds(taken);
    setKeyName('');
    setPermission('read-write');
    setCreateError(null);
    setCreateBusy(false);
    const firstEnabled = listed.find((db) => !taken.has(db.id));
    setDatabaseId(firstEnabled ? firstEnabled.id : '');
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!nameFieldRef.current.validate()) return;
    setCreateBusy(true);
    try {
      const { data } = await createApiKey({
        name: keyName.trim(),
        databaseId,
        permission,
      });
      setCreateOpen(false);
      setKeys((current) => [data.apiKey, ...current]);
      setReveal({ open: true, plaintext: data.plaintext });
    } catch (err) {
      setCreateError(errorToMessage(err, 'Could not create the key'));
      setCreateBusy(false);
    }
  }

  async function revoke(keyRow) {
    try {
      await revokeApiKey(keyRow.id);
      setKeys((current) => current.map(
        (entry) => (entry.id === keyRow.id ? { ...entry, revokedAt: new Date().toISOString() } : entry),
      ));
      showToast(`Key "${keyRow.name}" revoked`);
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not revoke the key'));
    }
  }

  if (keys === null) {
    return <Spinner label="Loading keys" />;
  }

  const noEnabledDatabase = databases.length > 0 && databases.every((db) => activeDbIds.has(db.id));

  return (
    <div>
      <Breadcrumbs
        trail={[
          { label: 'Dashboard', href: '/databases' },
          { label: 'API Keys', current: true },
        ]}
      />

      <div className="page-toolbar" style={{ margin: '12px 0 16px' }}>
        <div className="page-heading" style={{ margin: '0' }}>
          <h1>
            <Icon name="key" />
            {' '}
            API Keys
          </h1>
          <p>Scoped access tokens: each key is bound to one database and a permission level, and a database has exactly one active key at a time. Keys are hashed server-side and can be revoked at any time.</p>
        </div>
        <Button label="Create API key" iconName="plus-lg" variant="primary" onClick={() => void openCreate()} />
      </div>

      <div className="card">
        {keys.length === 0 ? (
          <EmptyState
            title="No API keys yet"
            description="Create a scoped key to call the data-plane API from scripts, CI jobs or AI agents."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['Name', 'Database', 'Permission', 'Token prefix', 'Created', 'Last used', 'Status', ''].map((label, index) => (
                  <th key={index} scope="col">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((keyRow) => (
                <tr key={keyRow.id}>
                  <td>{keyRow.name}</td>
                  <td>
                    {keyRow.database && keyRow.database.id ? (
                      <Link href={`/databases/${keyRow.database.id}`}>
                        {keyRow.database.name || keyRow.database.id}
                      </Link>
                    ) : (
                      'All databases'
                    )}
                  </td>
                  <td>{permissionBadge(keyRow)}</td>
                  <td className="mono">{`${keyRow.prefix}\u2026`}</td>
                  <td>{formatDate(keyRow.createdAt)}</td>
                  <td>{keyRow.lastUsedAt ? formatDate(keyRow.lastUsedAt) : 'Never'}</td>
                  <td>
                    {keyRow.revokedAt
                      ? <Badge text="Revoked" kind="status-suspended" iconName="x-circle" />
                      : <Badge text="Active" kind="status-active" iconName="check2-circle" />}
                  </td>
                  <td>
                    <div className="row-actions">
                      {!keyRow.revokedAt ? (
                        <Button
                          label="Revoke"
                          iconName="slash-circle"
                          variant="ghost"
                          ariaLabel={`Revoke ${keyRow.name}`}
                          onClick={() => setRevokeTarget(keyRow)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={createOpen}
        title="Create API key"
        onClose={() => setCreateOpen(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setCreateOpen(false)} />
            <Button label="Create key" variant="primary" onClick={() => void submitCreate()} disabled={createBusy} />
          </>
        )}
      >
        <Field
          ref={nameFieldRef}
          id="apikey-name"
          label="Key name"
          required
          placeholder="e.g. CI pipeline, reporting bot"
          hint="Shown only to you, for identification."
          value={keyName}
          onValueChange={setKeyName}
          validate={validateRequired}
        />
        <div className="field">
          <label htmlFor="apikey-database">Database *</label>
          <select
            id="apikey-database"
            className="input"
            value={databaseId}
            onChange={(event) => setDatabaseId(event.target.value)}
          >
            {databases.map((db) => (
              <option key={db.id} value={db.id} disabled={activeDbIds.has(db.id)}>
                {activeDbIds.has(db.id) ? `${db.name} - has an active key` : db.name}
              </option>
            ))}
          </select>
          <p className="hint">
            The key can only access this database. Databases with an active key are unavailable - revoke that key first (or manage it from the database page).
          </p>
        </div>
        <div className="field">
          <span>Permission *</span>
          {PERMISSIONS.map((entry, index) => (
            <label
              key={entry.value}
              htmlFor={`apikey-permission-${index}`}
              style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '6px', cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="apikey-permission"
                id={`apikey-permission-${index}`}
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
        {noEnabledDatabase ? (
          <p className="inline-error" role="status">
            Every active database already has an API key. Revoke one first (here or on the database page) to mint a new key.
          </p>
        ) : null}
        <p className="inline-error" role="alert" hidden={!createError}>{createError}</p>
      </Modal>

      <Modal
        open={Boolean(revokeTarget)}
        title="Revoke API key"
        onClose={() => setRevokeTarget(null)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setRevokeTarget(null)} />
            <Button
              label="Revoke key"
              variant="danger"
              onClick={() => {
                const target = revokeTarget;
                setRevokeTarget(null);
                if (target) void revoke(target);
              }}
            />
          </>
        )}
      >
        {revokeTarget ? (
          <p>{`Anything using "${revokeTarget.name}" will immediately lose access. This cannot be undone.`}</p>
        ) : null}
      </Modal>

      <PlaintextReveal
        open={reveal.open}
        plaintext={reveal.plaintext}
        onClose={() => setReveal((state) => ({ ...state, open: false }))}
      />
    </div>
  );
}

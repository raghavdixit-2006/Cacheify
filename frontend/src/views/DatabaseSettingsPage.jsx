'use client';

/**
 * Database settings page (screen archetype: Settings + Danger zone).
 * One place for everything scoped to this database: identity, lifecycle
 * status, its API keys and destructive operations with confirm guards.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, Spinner, Badge, EmptyState } from '../components/common/atoms.jsx';
import Field from '../components/common/Field.jsx';
import Modal from '../components/common/Modal.jsx';
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import {
  getDatabase, updateDatabase, deleteDatabase, flushDatabase,
} from '../services/databaseService.js';
import { listApiKeys } from '../services/adminService.js';
import { formatDate } from '../utils/format.js';
import { validateDatabaseName, errorToMessage } from '../utils/validators.js';
import { navigate } from '../router/navigate.js';

function StatusConfirmModal({ open, action, database, onClose, onConfirm }) {
  const active = action === 'archive';
  return (
    <Modal
      open={open}
      title={active ? 'Archive database' : 'Restore database'}
      onClose={onClose}
      actions={(
        <>
          <Button label="Cancel" onClick={onClose} />
          <Button
            label={active ? 'Archive' : 'Restore'}
            variant={active ? 'secondary' : 'primary'}
            onClick={() => {
              onClose();
              void onConfirm();
            }}
          />
        </>
      )}
    >
      <p>{active
        ? `"${database.name}" becomes read-only. Everything is kept; writes (API keys, console) are rejected until restored.`
        : `"${database.name}" becomes active again: reads and writes resume.`}
      </p>
    </Modal>
  );
}

function FlushConfirmModal({ open, database, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      title="Flush all data"
      onClose={onClose}
      actions={(
        <>
          <Button label="Cancel" onClick={onClose} />
          <Button
            label="Flush database"
            variant="danger"
            onClick={() => {
              onClose();
              void onConfirm();
            }}
          />
        </>
      )}
    >
      <p>{`Every key in "${database.name}" is deleted permanently. The database itself stays (with its API keys).`}</p>
    </Modal>
  );
}

function DeleteConfirmModal({ open, database, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      title="Delete database"
      onClose={onClose}
      actions={(
        <>
          <Button label="Cancel" onClick={onClose} />
          <Button
            label="Delete database"
            variant="danger"
            onClick={() => {
              onClose();
              void onConfirm();
            }}
          />
        </>
      )}
    >
      <p>
        {`This deletes "${database.name}" itself, every key in it, and immediately revokes all API keys scoped to it. This cannot be undone.`}
      </p>
    </Modal>
  );
}

/* Scoped API keys table (own spinner / non-blocking like the original). */
function ScopedKeysTable({ dbId }) {
  const [phase, setPhase] = useState('loading'); // loading | error | empty | ready
  const [failure, setFailure] = useState(null);
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listApiKeys()
      .then(({ data }) => {
        if (cancelled) return;
        setKeys(data.apiKeys.filter((keyRow) => keyRow.database && keyRow.database.id === dbId));
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setFailure(errorToMessage(err, 'Could not load keys for this database'));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  if (phase === 'loading') {
    return <Spinner label="Loading keys" />;
  }
  if (phase === 'error') {
    return <p className="inline-error">{failure}</p>;
  }
  if (keys.length === 0) {
    return (
      <EmptyState
        title="No API keys scoped here"
        description="Keys created for this database appear here with their permission level."
        action={<Button label="Create API key" iconName="plus-lg" variant="primary" onClick={() => navigate('/api-keys')} />}
      />
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {['Name', 'Permission', 'Token prefix', 'Created', 'Last used', 'Status'].map((label) => (
                <th key={label} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((keyRow) => (
              <tr key={keyRow.id}>
                <td>{keyRow.name}</td>
                <td>{keyRow.permission === 'read-only' ? 'Read only' : 'Read + write'}</td>
                <td>{`${keyRow.prefix}\u2026`}</td>
                <td className="nowrap">{formatDate(keyRow.createdAt)}</td>
                <td className="nowrap">{keyRow.lastUsedAt ? formatDate(keyRow.lastUsedAt) : 'Never'}</td>
                <td>
                  {keyRow.revokedAt
                    ? <Badge text="Revoked" kind="status-suspended" iconName="x-circle" />
                    : <Badge text="Active" kind="status-active" iconName="check2-circle" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button label="Manage all keys" iconName="key" variant="ghost" onClick={() => navigate('/api-keys')} />
    </>
  );
}

export default function DatabaseSettingsPage({ dbId }) {
  const [database, setDatabase] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [generalError, setGeneralError] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [statusAction, setStatusAction] = useState(null); // 'archive' | 'restore' | null
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const nameFieldRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase(dbId)
      .then(({ data }) => {
        if (cancelled) return;
        setDatabase(data.database);
        setName(data.database.name);
        setDescription(data.database.description || '');
      })
      .catch((err) => {
        if (cancelled) setLoadError(errorToMessage(err, 'Could not load this database'));
      });
    return () => {
      cancelled = true;
    };
  }, [dbId]);

  async function saveGeneral() {
    if (!nameFieldRef.current.validate()) return;
    setSaveBusy(true);
    try {
      const { data } = await updateDatabase(dbId, {
        name: name.trim(),
        description: description.trim(),
      });
      setDatabase(data.database);
      setName(data.database.name);
      setDescription(data.database.description || '');
      showToast('Settings saved');
    } catch (err) {
      setGeneralError(errorToMessage(err, 'Could not save changes'));
    } finally {
      setSaveBusy(false);
    }
  }

  async function toggleStatus() {
    const archivedNow = database.status === 'active';
    try {
      const { data } = await updateDatabase(dbId, {
        status: archivedNow ? 'archived' : 'active',
      });
      setDatabase(data.database);
      setGeneralError(null);
      showToast(data.database.status === 'active' ? 'Database restored' : 'Database archived');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not change status'));
    }
  }

  async function doFlush() {
    try {
      await flushDatabase(dbId);
      showToast('All keys in this database were flushed');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not flush the database'));
    }
  }

  async function doDelete() {
    try {
      await deleteDatabase(dbId);
      showToast('Database deleted');
      navigate('/databases');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not delete database'));
    }
  }

  if (loadError) {
    return (
      <div>
        <p className="inline-error" role="alert">{loadError}</p>
        <Button label="Back to overview" iconName="arrow-left" onClick={() => navigate('/databases')} />
      </div>
    );
  }

  if (!database) {
    return <Spinner label="Loading settings" />;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { label: 'Databases', href: '/databases' },
          { label: database.name, href: `/databases/${dbId}` },
          { label: 'Settings', current: true },
        ]}
      />

      <div className="page-toolbar" style={{ margin: '12px 0 16px' }}>
        <div className="page-heading" style={{ margin: '0' }}>
          <h1>
            <Icon name="sliders" />
            {` ${database.name} — settings`}
          </h1>
          <p>Everything scoped to this database on one page.</p>
        </div>
        <Button
          label="Back to database"
          iconName="arrow-left"
          variant="ghost"
          onClick={() => navigate(`/databases/${dbId}`)}
        />
      </div>

      {/* ------------------------------ General ------------------------------- */}
      <div className="card">
        <div className="card-title">
          <Icon name="gear" />
          {' General'}
        </div>
        <Field
          ref={nameFieldRef}
          id="settings-name"
          label="Name"
          required
          hint="Letters, numbers, spaces and dashes. Up to 64 characters."
          value={name}
          onValueChange={setName}
          validate={validateDatabaseName}
        />
        <Field
          id="settings-description"
          label="Description"
          textarea
          rows={3}
          hint="What is this database for? (Optional)"
          value={description}
          onValueChange={setDescription}
        />
        <p className="inline-error" role="alert" hidden={!generalError}>{generalError}</p>
        <Button
          label="Save changes"
          iconName="check-lg"
          variant="primary"
          onClick={() => void saveGeneral()}
          disabled={saveBusy}
        />
      </div>

      {/* ------------------------------- Status ------------------------------- */}
      <div className="card">
        <div className="card-title">
          <Icon name="toggle-on" />
          {' Status'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <Badge
            text={database.status === 'active' ? 'Active' : 'Archived (read-only)'}
            kind={`status-${database.status}`}
            iconName={database.status === 'active' ? 'check2-circle' : 'pause-circle'}
          />
          <span className="muted">
            {database.status === 'active'
              ? 'API keys and the console can read and write.'
              : 'Read-only: all data-plane writes are rejected. Keys scoped here still work for reads.'}
          </span>
        </div>
        <Button
          label={database.status === 'active' ? 'Archive database' : 'Restore to active'}
          iconName={database.status === 'active' ? 'pause-circle' : 'play-circle'}
          variant={database.status === 'active' ? 'secondary' : 'primary'}
          onClick={() => setStatusAction(database.status === 'active' ? 'archive' : 'restore')}
        />
      </div>

      {/* ------------------------- API keys scoped here ------------------------ */}
      <div className="card">
        <div className="card-title">
          <Icon name="key" />
          {' API keys for this database'}
        </div>
        <div id="db-settings-keys">
          <ScopedKeysTable dbId={dbId} />
        </div>
      </div>

      {/* ----------------------------- Danger zone ----------------------------- */}
      <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
        <div className="card-title">
          <Icon name="exclamation-triangle" />
          {' Danger zone'}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button label="Flush all data" iconName="eraser" variant="danger" onClick={() => setFlushConfirm(true)} />
          <Button label="Delete database" iconName="trash" variant="danger" onClick={() => setDeleteConfirm(true)} />
        </div>
        <p className="hint">
          Flushing keeps the database and keys; deleting removes everything including scoped API keys.
        </p>
      </div>

      <StatusConfirmModal
        open={Boolean(statusAction)}
        action={statusAction}
        database={database}
        onClose={() => setStatusAction(null)}
        onConfirm={() => toggleStatus()}
      />
      <FlushConfirmModal
        open={flushConfirm}
        database={database}
        onClose={() => setFlushConfirm(false)}
        onConfirm={() => doFlush()}
      />
      <DeleteConfirmModal
        open={deleteConfirm}
        database={database}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => doDelete()}
      />
    </div>
  );
}

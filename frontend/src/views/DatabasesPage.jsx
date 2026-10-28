'use client';

/** Dashboard page (screen archetype: Dashboard). Databases as cards with stats. */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, EmptyState, Spinner, Badge } from '../components/common/atoms.jsx';
import Field from '../components/common/Field.jsx';
import Modal from '../components/common/Modal.jsx';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import { listDatabases, createDatabase, deleteDatabase, updateDatabase } from '../services/databaseService.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { validateDatabaseName, errorToMessage } from '../utils/validators.js';
import { navigate } from '../router/navigate.js';

function DatabaseCard({ database, onSettings, onDelete }) {
  return (
    <article
      className={`card db-card${database.status === 'active' ? '' : ' is-archived'}`}
      data-agent-action="database-card"
      data-id={database.id}
    >
      <div className="db-card-head">
        <span className="db-card-icon" aria-hidden="true">
          <Icon name={database.status === 'active' ? 'database' : 'lock'} />
        </span>
        <h2 className="db-card-name" title={database.name}>{database.name}</h2>
        <Badge
          text={database.status === 'active' ? 'Active' : 'Archived'}
          kind={`status-${database.status}`}
          iconName={database.status === 'active' ? 'check2-circle' : 'x-circle'}
        />
      </div>

      <p className="db-card-desc">
        {database.description || 'No description yet.'}
      </p>

      <div className="db-card-stats">
        <div className="db-card-stat">
          <span>Keys</span>
          <span data-testid="key-count">{database.stats ? database.stats.totalKeys : '-'}</span>
        </div>
        <div className="db-card-stat">
          <span>Size</span>
          <span>{database.stats ? formatBytes(database.stats.totalBytes) : '-'}</span>
        </div>
        <div className="db-card-stat">
          <span>Created</span>
          <span>{formatDate(database.createdAt)}</span>
        </div>
        <div className="db-card-stat">
          <span>Default TTL</span>
          <span>24 hours</span>
        </div>
      </div>

      <div className="db-card-foot">
        <Button label="Settings" iconName="gear" variant="ghost" ariaLabel={`Settings for ${database.name}`} onClick={() => onSettings(database)} />
        <Button label="Delete" iconName="trash" variant="ghost" ariaLabel={`Delete ${database.name}`} onClick={() => onDelete(database)} />
        <Button
          label="Open"
          iconName="box-arrow-up-right"
          variant="primary"
          onClick={() => navigate(`/databases/${database.id}`)}
        />
      </div>
    </article>
  );
}

export default function DatabasesPage() {
  const [databases, setDatabases] = useState(null); // null = loading
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createError, setCreateError] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '' });
  const [settingsError, setSettingsError] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [installToggleBusy, setInstallToggleBusy] = useState(false);
  const nameFieldRef = useRef(null);
  const settingsNameFieldRef = useRef(null);

  /* database currently edited in the settings modal (null = closed) */
  const [settingsTarget, setSettingsTarget] = useState(null);
  /* database pending delete confirmation (null = closed) */
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listDatabases()
      .then(({ data }) => {
        if (!cancelled) setDatabases(data.databases);
      })
      .catch((err) => {
        showErrorToast(errorToMessage(err, 'Could not load databases'));
        if (!cancelled) setDatabases([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------- Create / edit ------------------------------ */

  function openCreateModal() {
    if (databases.length >= 5) {
      showErrorToast('Plan limit reached: at most 5 active databases. Delete one and try again.');
      return;
    }
    setCreateForm({ name: '', description: '' });
    setCreateError(null);
    setCreateBusy(false);
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!nameFieldRef.current.validate()) return;
    setCreateBusy(true);
    try {
      const { data } = await createDatabase({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
      });
      setCreateOpen(false);
      setDatabases([data.database, ...databases]);
      showToast(`Database "${data.database.name}" created`);
    } catch (err) {
      setCreateError(errorToMessage(err, 'Could not create database'));
      setCreateBusy(false);
    }
  }

  function openSettingsModal(database) {
    setSettingsTarget(database);
    setSettingsForm({ name: database.name, description: database.description || '' });
    setSettingsError(null);
    setSettingsBusy(false);
    setInstallToggleBusy(false);
  }

  async function toggleArchive(database) {
    const archived = database.status === 'archived';
    setInstallToggleBusy(true);
    try {
      const { data } = await updateDatabase(database.id, { status: archived ? 'active' : 'archived' });
      setDatabases(databases.map((entry) => (entry.id === database.id ? data.database : entry)));
      setSettingsTarget(null);
      showToast(`Database "${data.database.name}" is now ${data.database.status}`);
    } catch (err) {
      setInstallToggleBusy(false);
      showErrorToast(errorToMessage(err, 'Could not update database'));
    }
  }

  async function submitSettings() {
    if (!settingsNameFieldRef.current.validate()) return;
    setSettingsBusy(true);
    try {
      const { data } = await updateDatabase(settingsTarget.id, {
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim(),
      });
      setDatabases(databases.map((entry) => (entry.id === settingsTarget.id ? data.database : entry)));
      setSettingsTarget(null);
      showToast('Changes saved');
    } catch (err) {
      setSettingsError(errorToMessage(err, 'Could not save changes'));
      setSettingsBusy(false);
    }
  }

  /* -------------------------------- Delete --------------------------------- */

  function confirmDelete(database) {
    setDeleteTarget(database);
  }

  async function doDelete(database) {
    try {
      await deleteDatabase(database.id);
      setDatabases(databases.filter((entry) => entry.id !== database.id));
      showToast(`Database "${database.name}" deleted`);
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not delete database'));
    }
  }

  const archivedBadge = settingsTarget && settingsTarget.status === 'archived';

  return (
    <>
      <div className="page-toolbar">
        <div className="page-heading">
          <h1>
            <Icon name="database" />
            {' '}
            Databases
          </h1>
          <p>Each database is an isolated Redis-compatible namespace scoped to your account.</p>
        </div>
        <Button label="Create database" iconName="plus-lg" variant="primary" onClick={openCreateModal} />
      </div>

      {databases === null ? (
        <Spinner label="Loading databases" />
      ) : databases.length === 0 ? (
        <EmptyState
          title="No databases yet"
          description="Create your first Redis database to start storing keys, lists, sets, hashes and sorted sets."
          action={<Button label="Create database" iconName="plus-lg" variant="primary" onClick={openCreateModal} />}
        />
      ) : (
        <>
          {renderStatBand(databases)}
          <div className="grid-cards">
            {databases.map((database) => (
              <DatabaseCard
                key={database.id}
                database={database}
                onSettings={openSettingsModal}
                onDelete={confirmDelete}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        title="Create database"
        onClose={() => setCreateOpen(false)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setCreateOpen(false)} />
            <Button label="Create database" variant="primary" onClick={() => void submitCreate()} disabled={createBusy} />
          </>
        )}
      >
        <Field
          ref={nameFieldRef}
          id="db-name"
          label="Name"
          required
          placeholder="e.g. prod-cache, user-sessions"
          hint="Letters, numbers, spaces and dashes. Up to 64 characters."
          value={createForm.name}
          onValueChange={(value) => setCreateForm((form) => ({ ...form, name: value }))}
          validate={validateDatabaseName}
        />
        <Field
          id="db-description"
          label="Description"
          textarea
          rows={3}
          hint="What is this database for? (Optional)"
          value={createForm.description}
          onValueChange={(value) => setCreateForm((form) => ({ ...form, description: value }))}
        />
        <p className="inline-error" role="alert" hidden={!createError}>{createError}</p>
      </Modal>

      <Modal
        open={Boolean(settingsTarget)}
        title={settingsTarget ? `Settings - ${settingsTarget.name}` : 'Settings'}
        onClose={() => setSettingsTarget(null)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setSettingsTarget(null)} />
            <Button label="Save changes" variant="primary" onClick={() => void submitSettings()} disabled={settingsBusy} />
          </>
        )}
      >
        {settingsTarget ? (
          <>
            <Field
              ref={settingsNameFieldRef}
              id="db-name"
              label="Name"
              required
              placeholder="e.g. prod-cache, user-sessions"
              hint="Letters, numbers, spaces and dashes. Up to 64 characters."
              value={settingsForm.name}
              onValueChange={(value) => setSettingsForm((form) => ({ ...form, name: value }))}
              validate={validateDatabaseName}
            />
            <Field
              id="db-description"
              label="Description"
              textarea
              rows={3}
              hint="What is this database for? (Optional)"
              value={settingsForm.description}
              onValueChange={(value) => setSettingsForm((form) => ({ ...form, description: value }))}
            />
            <p className="muted" hidden={!archivedBadge}>
              Archived databases are read-only. Manage &gt; Archive toggles write access again.
            </p>
            <Button
              label={archivedBadge ? 'Restore to active' : 'Archive (read-only)'}
              iconName="archive"
              onClick={() => void toggleArchive(settingsTarget)}
              disabled={installToggleBusy}
            />
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete database"
        onClose={() => setDeleteTarget(null)}
        actions={(
          <>
            <Button label="Cancel" onClick={() => setDeleteTarget(null)} />
            <Button
              label="Delete database"
              variant="danger"
              onClick={() => {
                const database = deleteTarget;
                setDeleteTarget(null);
                if (database) void doDelete(database);
              }}
            />
          </>
        )}
      >
        {deleteTarget ? (
          <p>
            {`This permanently deletes "${deleteTarget.name}" and all of its keys. This action cannot be undone.`}
          </p>
        ) : null}
      </Modal>
    </>
  );
}

/* Usage band above the grid: quick read on account capacity. */
function renderStatBand(databases) {
  const totalKeys = databases.reduce((sum, db) => sum + (db.stats ? (db.stats.totalKeys ?? 0) : 0), 0);
  const cells = [
    { label: 'Databases', value: String(databases.length), icon: 'database' },
    { label: 'Total keys', value: String(totalKeys), icon: 'braces' },
    { label: 'Plan', value: 'Free forever', icon: 'bolt' },
  ];
  return (
    <div className="stat-grid" id="database-stats">
      {cells.map((cell) => (
        <div className="stat" key={cell.label}>
          <span className="label">
            <Icon name={cell.icon} />
            {` ${cell.label}`}
          </span>
          <div className="value">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

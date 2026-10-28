'use client';

/**
 * Admin page: MECE user table (Location/Category ordering), quota editing,
 * suspend/activate with confirmation, usage stats per user.
 */

import { useEffect, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, Spinner, Badge, EmptyState } from '../components/common/atoms.jsx';
import Field from '../components/common/Field.jsx';
import Modal from '../components/common/Modal.jsx';
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import { listUsers, getUser, updateUser } from '../services/adminService.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { errorToMessage } from '../utils/validators.js';

function SuspendConfirmModal({ open, user, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      title="Suspend account"
      onClose={onClose}
      actions={(
        <>
          <Button label="Cancel" onClick={onClose} />
          <Button
            label="Suspend account"
            variant="danger"
            onClick={() => {
              onClose();
              void onConfirm({ status: 'suspended' });
            }}
          />
        </>
      )}
    >
      <p>{`${user.email} loses all API access immediately. Databases and keys are preserved.`}</p>
    </Modal>
  );
}

function RoleConfirmModal({ open, patch, onClose, onConfirm }) {
  if (!patch) return null;
  return (
    <Modal
      open={open}
      title="Change role"
      onClose={onClose}
      actions={(
        <>
          <Button label="Cancel" onClick={onClose} />
          <Button
            label="Confirm change"
            variant="danger"
            onClick={() => {
              onClose();
              void onConfirm(patch.patch);
            }}
          />
        </>
      )}
    >
      <p>{patch.message}</p>
    </Modal>
  );
}

function ManageModal({ user, onClose, onSaved, onRoleToggle }) {
  const [usageText, setUsageText] = useState('Loading usage stats...');
  const [maxDatabases, setMaxDatabases] = useState(String(user.quota.maxDatabases));
  const [maxKeysPerDb, setMaxKeysPerDb] = useState(String(user.quota.maxKeysPerDb));
  const [maxValueBytes, setMaxValueBytes] = useState(String(user.quota.maxValueBytes));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUser(user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setUsageText(
          `Databases: ${data.usage.databases.total} total / ${data.usage.databases.active} active\n` +
          `Keys: ${data.usage.keys.total.toLocaleString()} (${formatBytes(data.usage.keys.bytes)})\n` +
          `Active API keys: ${data.usage.apiKeys.active}`,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setUsageText('Usage stats unavailable.');
        showErrorToast(errorToMessage(err, 'Could not load usage stats'));
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  function validateQuotas() {
    const values = [Number(maxDatabases), Number(maxKeysPerDb), Number(maxValueBytes)];
    if (values.some((value) => !Number.isFinite(value) || value < 1)) {
      showErrorToast('Quota values must be positive numbers');
      return null;
    }
    return { maxDatabases: values[0], maxKeysPerDb: values[1], maxValueBytes: values[2] };
  }

  async function submit() {
    const patch = validateQuotas();
    if (!patch) return;
    setBusy(true);
    try {
      const { data } = await updateUser(user.id, patch);
      onSaved(data.user);
      onClose();
      showToast('Quotas updated');
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not update the user'));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Manage ${user.email}`}
      onClose={onClose}
      actions={(
        <>
          <Button
            label={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
            iconName={user.role === 'admin' ? 'person-dash' : 'shield-plus'}
            onClick={() => {
              onClose();
              onRoleToggle(user);
            }}
          />
          <Button label="Cancel" onClick={onClose} />
          <Button label="Save quotas" variant="primary" onClick={() => void submit()} disabled={busy} />
        </>
      )}
    >
      <pre className="key-preview">{usageText}</pre>
      <Field
        id="admin-max-db"
        label="Max databases"
        type="number"
        required
        value={maxDatabases}
        onValueChange={setMaxDatabases}
      />
      <Field
        id="admin-max-keys"
        label="Max keys per database"
        type="number"
        required
        value={maxKeysPerDb}
        onValueChange={setMaxKeysPerDb}
      />
      <Field
        id="admin-max-value"
        label="Max value size (bytes)"
        type="number"
        required
        value={maxValueBytes}
        onValueChange={setMaxValueBytes}
      />
    </Modal>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState(null); // null = loading
  const [nextCursor, setNextCursor] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [rolePatch, setRolePatch] = useState(null); // { user, patch, message }
  const [manage, setManage] = useState(null); // user object under management

  useEffect(() => {
    let cancelled = false;
    listUsers({ cursor: 0, limit: 25 })
      .then(({ data, meta }) => {
        if (cancelled) return;
        setUsers(data.users);
        setNextCursor(meta ? meta.cursor : 0);
      })
      .catch((err) => {
        if (!cancelled) {
          showErrorToast(errorToMessage(err, 'Could not load users'));
          setUsers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore(cursor) {
    try {
      const { data, meta } = await listUsers({ cursor, limit: 25 });
      setUsers((current) => current.concat(data.users));
      setNextCursor(meta ? meta.cursor : 0);
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not load users'));
    }
  }

  async function patchUser(userRow, patch) {
    try {
      const { data } = await updateUser(userRow.id, patch);
      setUsers((current) => current.map(
        (entry) => (entry.id === userRow.id ? data.user : entry),
      ));
      showToast(`${data.user.email} updated`);
      return data.user;
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not update the user'));
      return null;
    }
  }

  if (users === null) {
    return <Spinner label="Loading users" />;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { label: 'Dashboard', href: '/databases' },
          { label: 'Admin', current: true },
        ]}
      />

      <div className="page-toolbar" style={{ margin: '12px 0 16px' }}>
        <div className="page-heading" style={{ margin: '0' }}>
          <h1>
            <Icon name="people" />
            {' '}
            Users
          </h1>
          <p>Suspended accounts lose API access immediately and their sessions are rotated.</p>
        </div>
      </div>

      <div className="card card-flush">
        {users.length === 0 ? (
          <EmptyState title="No users found" description="Loading issue or nobody has signed up yet." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    { label: 'Email' },
                    { label: 'Role' },
                    { label: 'Databases quota', secondary: true },
                    { label: 'Keys / DB', secondary: true },
                    { label: 'Max value', secondary: true },
                    { label: 'Created', secondary: true },
                    { label: 'Status' },
                    { label: '' },
                  ].map((column, index) => (
                    <th key={index} scope="col" className={column.secondary ? 'hide-secondary' : undefined}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((userRow) => (
                  <tr key={userRow.id}>
                    <td>{userRow.email}</td>
                    <td>
                      <Badge
                        text={userRow.role}
                        kind={`role-${userRow.role}`}
                        iconName={userRow.role === 'admin' ? 'shield-lock' : 'person'}
                      />
                    </td>
                    <td className="hide-secondary">{String(userRow.quota.maxDatabases)}</td>
                    <td className="hide-secondary">{userRow.quota.maxKeysPerDb.toLocaleString()}</td>
                    <td className="hide-secondary">{formatBytes(userRow.quota.maxValueBytes)}</td>
                    <td className="nowrap hide-secondary">{formatDate(userRow.createdAt)}</td>
                    <td>
                      {userRow.status === 'active'
                        ? <Badge text="Active" kind="status-active" iconName="check2-circle" />
                        : <Badge text="Suspended" kind="status-suspended" iconName="slash-circle" />}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          label="Manage"
                          iconName="sliders"
                          variant="ghost"
                          ariaLabel={`Manage ${userRow.email}`}
                          onClick={() => setManage(userRow)}
                        />
                        {userRow.status === 'active' ? (
                          <Button
                            label="Suspend"
                            iconName="pause-circle"
                            variant="ghost"
                            ariaLabel={`Suspend ${userRow.email}`}
                            onClick={() => setSuspendTarget(userRow)}
                          />
                        ) : (
                          <Button
                            label="Activate"
                            iconName="play-circle"
                            variant="ghost"
                            ariaLabel={`Activate ${userRow.email}`}
                            onClick={() => void patchUser(userRow, { status: 'active' })}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="load-more-row">
          {nextCursor > 0 ? (
            <Button label="Load more" iconName="chevron-down" onClick={() => void loadMore(nextCursor)} />
          ) : null}
        </div>
      </div>

      {manage ? (
        <ManageModal
          key={manage.id}
          user={manage}
          onClose={() => setManage(null)}
          onSaved={(updated) => setUsers((current) => (current || []).map(
            (entry) => (entry.id === updated.id ? updated : entry),
          ))}
          onRoleToggle={(userRow) => setRolePatch({
            user: userRow,
            patch: { role: userRow.role === 'admin' ? 'user' : 'admin' },
            message: userRow.role === 'admin'
              ? `${userRow.email} will lose admin access. Their sessions are reset.`
              : `${userRow.email} will gain full admin access to every tenant's data.`,
          })}
        />
      ) : null}

      <SuspendConfirmModal
        open={Boolean(suspendTarget)}
        user={suspendTarget || { email: '' }}
        onClose={() => setSuspendTarget(null)}
        onConfirm={(patch) => patchUser(suspendTarget, patch)}
      />

      <RoleConfirmModal
        open={Boolean(rolePatch)}
        patch={rolePatch}
        onClose={() => setRolePatch(null)}
        onConfirm={(patch) => patchUser(rolePatch.user, patch)}
      />
    </div>
  );
}

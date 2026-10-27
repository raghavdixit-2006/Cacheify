'use client';

/**
 * Profile page — account identity, command usage and settings.
 * Free platform: no upsells, no advertising. Shows real per-day command
 * usage, a usage graph, and editable profile fields stored in MongoDB.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button, Badge, Spinner } from '../components/common/atoms.jsx';
import { showToast, showErrorToast } from '../components/common/toasts.js';
import { errorToMessage, validateProfileText } from '../utils/validators.js';
import { getSession, setSession, onboardingSkipped, setOnboardingSkipped } from '../store/store.js';
import { getProfile, saveProfile, getCommandUsage } from '../services/profileService.js';
import { navigate } from '../router/navigate.js';
import { Routes } from '../router/routes.js';

const COLOR_SWATCHES = ['#dc2626', '#ea580c', '#ca8a04', '#15803d', '#0891b2', '#2563eb', '#7c3aed', '#be185d'];

const MEMBER_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatMemberSince(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return `${MEMBER_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function initials(email) {
  if (!email) return '?';
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return email.charAt(0).toUpperCase();
}

function UsageGraph({ dailyTotals, axisLabels }) {
  const width = 700;
  const height = 200;
  const padding = 40;
  const points = dailyTotals.length > 0 ? dailyTotals.map((d) => d.total) : [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...points) * 1.1 || 1;
  const xStep = (width - 2 * padding) / (points.length - 1);

  const polygonPoints = points.map((v, i) => {
    const x = padding + i * xStep;
    const y = height - padding - (v / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `${polygonPoints} ${width - padding},${height - padding} ${padding},${height - padding}`;

  const gridY = [height - padding, height - padding - (height - 2 * padding) / 2, padding];
  const maxLabel = Math.ceil(maxVal / 0.9).toString();
  const midLabel = Math.ceil((maxVal / 0.9) / 2).toString();
  const gridLabels = [maxLabel, midLabel, '0'];

  const peakIdx = points.indexOf(Math.max(...points));
  const peakX = padding + peakIdx * xStep;
  const peakY = height - padding - (points[peakIdx] / maxVal) * (height - 2 * padding);

  return (
    <div className="svg-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="Command usage over the last 7 days" className="usage-svg">
        <defs>
          <linearGradient id="usageFade" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridY.map((y, i) => (
          <g key={gridLabels[i]}>
            <line stroke="#cbd5e1" strokeDasharray="4 4" strokeOpacity="0.5" x1={padding} x2={width - padding} y1={y} y2={y} />
            <text className="usage-grid-label" fill="#64748b" x="8" y={y + 4}>{gridLabels[i]}</text>
          </g>
        ))}
        <polygon fill="url(#usageFade)" points={areaPoints} />
        <polyline
          fill="none"
          stroke="#dc2626"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          points={polygonPoints}
        />
        <circle cx={peakX} cy={peakY} r="5" fill="#b91c1c" />
      </svg>
      <div className="graph-axis">
        {(axisLabels.length > 0 ? axisLabels : ['\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014']).map((label, index) => (
          <span className="graph-label" key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <p className="graph-note">
        <Icon name="info" />
        {' Real command usage from your databases over the last 7 days.'}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [nameError, setNameError] = useState('');
  const [bioError, setBioError] = useState('');
  const [avatarColorIndex, setAvatarColorIndex] = useState(0);
  const [usageData, setUsageData] = useState(null); // null = empty state visible
  const [onboarding, setOnboarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const editSectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const session = getSession();
    if (!session) {
      navigate(Routes.login);
      return undefined;
    }
    getProfile()
      .then(async ({ data }) => {
        if (cancelled) return;
        setProfile(data.profile);
        setDisplayName(data.profile.displayName || '');
        setBio(data.profile.bio || '');
        const colorIdx = COLOR_SWATCHES.indexOf(data.profile.avatarColor || '#dc2626');
        setAvatarColorIndex(colorIdx !== -1 ? colorIdx : 0);

        const s = getSession();
        setOnboarding(Boolean(
          s && s.user && s.user.emailVerified !== false
          && data.profile.updatedAt === null
          && !onboardingSkipped(s.user.id),
        ));

        /* Real command usage: graph + breakdown. Best-effort. */
        try {
          const { data: usage } = await getCommandUsage();
          if (cancelled) return;
          setUsageData(buildUsage(usage.usage || []));
        } catch (_err) {
          /* Fail silently: usage tracking is best-effort */
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showErrorToast(errorToMessage(err, 'Could not load profile'));
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    const patch = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatarColor: COLOR_SWATCHES[avatarColorIndex],
    };
    const nameMessage = validateProfileText(patch.displayName, 80);
    const bioMessage = validateProfileText(patch.bio, 500);
    if (nameMessage || bioMessage) {
      setNameError(nameMessage || '');
      setBioError(bioMessage || '');
      return;
    }

    setBusy(true);
    try {
      const { data } = await saveProfile(patch);
      const s = getSession();
      if (s) {
        setSession({ ...s, user: { ...s.user, displayName: patch.displayName } });
      }
      setProfile((current) => ({ ...current, ...data.profile }));
      showToast('Profile saved', 'success');
      if (onboarding) navigate(Routes.databases);
    } catch (err) {
      showErrorToast(errorToMessage(err, 'Could not save profile'));
    } finally {
      setBusy(false);
    }
  }

  function scrollIntoEdit() {
    if (editSectionRef.current) editSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const session = getSession();
  if (!session) return null;

  return (
    <div className="profile-page">
      {/* ---------------------------------------------------------------- shell */}
      <div className="page-toolbar">
        <h2 className="card-title">
          <Icon name="person-circle" />
          Profile &amp; Account
        </h2>
      </div>

      <div className="context-bar">
        <span className="context-email">
          <Icon name="envelope" />
          {` ${session.user.email}`}
        </span>
        {session.user.emailVerified ? (
          <Badge text="Email verified" kind="status-active" iconName="check-lg" />
        ) : (
          <Badge text="Email not verified" kind="status-suspended" iconName="exclamation-triangle" />
        )}
        {session.user.role === 'admin'
          ? <Badge text="Administrator" kind="badge-role-admin" iconName="people" />
          : <Badge text="Free tier" kind="badge-role-user" iconName="person" />}
      </div>

      <div className="skip-row" hidden={!onboarding}>
        <Button
          label="Skip for now"
          iconName="arrow-left"
          onClick={() => {
            const s = getSession();
            if (s) setOnboardingSkipped(s.user.id);
            navigate(Routes.databases);
          }}
        />
      </div>

      {loadFailed ? null : profile === null ? (
        <Spinner label="Loading account" />
      ) : (
        <>
          {/* ----------------------------------------------------------- identity card */}
          <section className="card identity-card">
            <div className="identity-head">
              <div className="avatar-wrap">
                <div className={`avatar-large avatar-color-${avatarColorIndex}`} data-color-index={String(avatarColorIndex)}>
                  {initials(session.user.email)}
                </div>
              </div>
              <div className="identity-meta">
                <h1 className="identity-name">
                  {profile.displayName || session.user.email.split('@')[0]}
                </h1>
                <p className="identity-id">
                  <Icon name="badge" />
                  {`  Account ID: ${session.user.id}`}
                </p>
                <p className="identity-since">
                  <Icon name="calendar_today" />
                  {`  Member since ${formatMemberSince(session.user.createdAt)}`}
                </p>
              </div>
              <div className="identity-actions">
                <Button label="Edit details" iconName="pencil" variant="primary" onClick={scrollIntoEdit} />
              </div>
            </div>
            <hr className="section-divider" />
          </section>

          {/* ------------------------------------------------- command usage per day */}
          <section className="usage-section">
            <h3 className="card-title">
              <Icon name="show_chart" />
              {'Commands Used per Day'}
            </h3>

            {!usageData ? (
              <div className="card empty-usage">
                <div className="empty-state">
                  <Icon name="bar_chart" />
                  <h2 className="empty-title">No command activity yet</h2>
                  <p className="empty-subtitle">Start using your databases — SET, GET, HSET, and other commands will appear here.</p>
                </div>
              </div>
            ) : null}

            {usageData ? (
              <div className="usage-content">
                <div className="card stat-card">
                  <div className="stat">
                    <div className="label">
                      <Icon name="bolt" />
                      {' Total Commands (7 days)'}
                    </div>
                    <div className="value" id="u-total">{usageData.grandTotal.toLocaleString()}</div>
                  </div>
                </div>

                <div className="card stat-card">
                  <div className="stat">
                    <div className="label">
                      <Icon name="list" />
                      {' Top Commands'}
                    </div>
                    <div className="value" id="u-top-commands">
                      {usageData.topCommands.length > 0
                        ? `${usageData.topCommands[0][0]} (${usageData.topCommands[0][1].toLocaleString()})`
                        : '\u2014'}
                    </div>
                  </div>
                  <div id="u-breakdown-list" className="breakdown-list">
                    {usageData.topCommands.length > 0
                      ? usageData.topCommands.map(([cmd, cnt]) => (
                        <div className="breakdown-item" key={cmd}>
                          <span className="breakdown-cmd">{cmd}</span>
                          {': '}
                          <span className="breakdown-count">{cnt.toLocaleString()}</span>
                        </div>
                      ))
                      : 'No commands recorded yet.'}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* ------------------------------------------------------------ usage graph */}
          <section className="graph-section">
            <h3 className="card-title">
              <Icon name="show_chart" />
              {'Command Throughput'}
            </h3>
            <div className="card graph-card">
              <UsageGraph dailyTotals={usageData ? usageData.dailyTotals : []} axisLabels={usageData ? usageData.axisLabels : []} />
            </div>
          </section>

          {/* ------------------------------------------------------------ edit form */}
          <section className="edit-section" ref={editSectionRef}>
            <h3 className="card-title">
              <Icon name="person" />
              {'Account Details'}
            </h3>
            <div className="card">
              <form noValidate className="edit-form" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
                <label className="field-label" htmlFor="profile-name">Display name *</label>
                <input
                  id="profile-name"
                  name="profile-name"
                  className="field-input"
                  type="text"
                  maxLength={80}
                  value={displayName}
                  placeholder="How should the platform greet you?"
                  onChange={(event) => setDisplayName(event.target.value)}
                  onBlur={() => setNameError(validateProfileText(displayName, 80) || '')}
                />
                <p className="field-error" id="profile-name-error">{nameError}</p>

                <label className="field-label" htmlFor="profile-bio">Bio / notes (Optional)</label>
                <textarea
                  id="profile-bio"
                  name="profile-bio"
                  className="field-input"
                  rows={4}
                  maxLength={500}
                  value={bio}
                  placeholder="What do you use your Redis databases for?"
                  onChange={(event) => setBio(event.target.value)}
                  onBlur={() => setBioError(validateProfileText(bio, 500) || '')}
                />
                <p className="field-error" id="profile-bio-error">{bioError}</p>

                <label className="field-label" id="profile-color-label" htmlFor="profile-color">Identity color *</label>
                <div className="color-swatch-row" role="group" aria-labelledby="profile-color-label">
                  {COLOR_SWATCHES.map((color, index) => (
                    <button
                      key={color}
                      type="button"
                      id={index === 0 ? 'profile-color' : undefined}
                      aria-label={`Use color ${color}`}
                      className={`color-swatch color-swatch-${index}${index === avatarColorIndex ? ' is-active' : ''}`}
                      data-index={String(index)}
                      onClick={() => setAvatarColorIndex(index)}
                    />
                  ))}
                </div>

                <div className="form-actions">
                  <Button label="Save changes" iconName="save" variant="primary" type="submit" />
                  <span className="saved-stamp">
                    {`Last saved: ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'never'}`}
                  </span>
                </div>
              </form>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function buildUsage(usage) {
  const dailyMap = new Map();
  const commandMap = new Map();
  for (const row of usage) {
    dailyMap.set(row.date, (dailyMap.get(row.date) || 0) + row.count);
    commandMap.set(row.command, (commandMap.get(row.command) || 0) + row.count);
  }

  /* Last 7 days with zero-filled missing dates */
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dailyTotals = [];
  const axisLabels = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyTotals.push({ date: dateStr, total: dailyMap.get(dateStr) || 0 });
    axisLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  }

  const grandTotal = dailyTotals.reduce((sum, d) => sum + d.total, 0);
  const topCommands = [...commandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return { dailyTotals, axisLabels, grandTotal, topCommands };
}

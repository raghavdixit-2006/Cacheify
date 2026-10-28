/**
 * Illustrative preview of the authenticated console. It is a drawing of the
 * real information architecture — sidebar, database cards, key browser and
 * command console — not live data.
 */

import { Icon } from '../../common/Icon.jsx';

const DATABASES = [
  { name: 'sessions', description: 'Short-lived session cache for the web app.', keys: '1,284 keys', status: 'Active' },
  { name: 'leaderboard', description: 'Sorted sets for the weekly product ranking.', keys: '86 keys', status: 'Active' },
  { name: 'feature-flags', description: 'Boolean rollout flags with a 24h expiry.', keys: '24 keys', status: 'Active' },
];

export default function DashboardPreview({ caption = 'Illustrative preview of the authenticated console.' }) {
  return (
    <div className="dashboard-preview">
      <div className="preview-frame">
        <div className="preview-chrome">
          <span className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="preview-url">
            <Icon name="lock" />
            console / databases
          </span>
          <span className="preview-user" aria-hidden="true">RG</span>
        </div>

        <div className="preview-body">
          <aside className="preview-sidebar" aria-hidden="true">
            <span className="preview-sidebar-brand">
              <span className="preview-sidebar-mark" />
              Cacheify
            </span>
            <span className="preview-sidebar-item is-active">
              <Icon name="grid-1x2" />
              Overview
            </span>
            <span className="preview-sidebar-item">
              <Icon name="key" />
              API keys
            </span>
            <span className="preview-sidebar-item">
              <Icon name="person-circle" />
              Profile
            </span>
            <span className="preview-sidebar-item">
              <Icon name="menu-book" />
              Documentation
            </span>
            <span className="preview-sidebar-plan">
              <small>Current plan</small>
              <strong>Free, for everyone</strong>
            </span>
          </aside>

          <div className="preview-main">
            <div className="preview-topline">
              <span>
                <small>Console</small>
                <strong>Databases</strong>
              </span>
              <span className="preview-button">
                <Icon name="plus-lg" />
                New database
              </span>
            </div>

            <div className="preview-stat-row">
              <span><small>Databases</small><strong>3 / 5</strong></span>
              <span><small>Keys</small><strong>1,394</strong></span>
              <span><small>API keys</small><strong>3 active</strong></span>
            </div>

            <div className="preview-card-grid">
              {DATABASES.map((database) => (
                <div className="preview-db-card" key={database.name}>
                  <div className="preview-db-head">
                    <span className="preview-db-icon"><Icon name="database" /></span>
                    <span className="badge badge-status-active">{database.status}</span>
                  </div>
                  <strong>{database.name}</strong>
                  <small>{database.description}</small>
                  <div className="preview-db-foot">
                    <span>{database.keys}</span>
                    <span>24h TTL</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="preview-terminal">
              <span className="preview-terminal-label">
                <Icon name="terminal" />
                Command console
                <span className="preview-terminal-badge">Demo</span>
              </span>
              <code><span>&gt;</span> SET session:9942 active EX 3600</code>
              <code className="preview-terminal-ok">OK</code>
            </div>
          </div>
        </div>
      </div>
      <p className="preview-caption">
        <Icon name="info-circle" />
        {caption}
      </p>
    </div>
  );
}

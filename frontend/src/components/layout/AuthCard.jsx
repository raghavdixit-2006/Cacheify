/** Shared auth card shell for login/register: brand row + heading + lead. */

import { Icon } from '../common/Icon.jsx';

export default function AuthCard({ heading, lead, children, footer = null }) {
  return (
    <div className="card auth-card">
      <div className="auth-brand">
        <span className="navbar-logo" aria-hidden="true">
          <Icon name="bolt" />
        </span>
        <span>Cacheify</span>
      </div>
      <h1 style={{ fontSize: '24px', letterSpacing: '-0.02em', fontWeight: '800' }}>{heading}</h1>
      <p className="muted">{lead}</p>
      {children}
      {footer}
    </div>
  );
}

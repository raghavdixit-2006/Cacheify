/** Shared auth card shell for login/register: brand row + heading + lead. */

import Brand from '../common/Brand.jsx';
import { Icon } from '../common/Icon.jsx';

const TRUST = [
  { icon: 'shield-lock', label: 'Scoped keys' },
  { icon: 'database', label: '5 free databases' },
  { icon: 'clock', label: 'Mandatory TTL' },
];

export default function AuthCard({ heading, lead, children, footer = null }) {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <Brand href="/" />
        <p className="auth-eyebrow">
          <span className="dot" />
          Free for all users
        </p>
        <h1>{heading}</h1>
        <p className="muted">{lead}</p>
        {children}
        {footer}
        <div className="auth-trust" aria-label="Platform guarantees">
          {TRUST.map((item) => (
            <span key={item.label}>
              <Icon name={item.icon} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

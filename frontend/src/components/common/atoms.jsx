/** Button/Spinner/Badge/EmptyState atoms. Presentational only. */

import { Icon } from './Icon.jsx';

export function Button({ label, iconName, variant = 'secondary', type = 'button', onClick, disabled = false, ariaLabel = null, title = null }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? undefined}
      title={title ?? undefined}
    >
      {iconName ? <Icon name={iconName} /> : null}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner" role="status" aria-busy="true">
      <Icon name="arrow-repeat" />
      <span>{label}</span>
    </div>
  );
}

/** Badge with icon so status is never color-only. */
export function Badge({ text, kind = 'type', iconName = null }) {
  return (
    <span className={`badge badge-${kind}`}>
      {iconName ? <Icon name={iconName} /> : null}
      <span>{text}</span>
    </span>
  );
}

export function EmptyState({ title, description, action = null }) {
  return (
    <div className="empty-state">
      <Icon name="inbox" />
      <h2 style={{ fontSize: '17px', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ margin: '0 0 16px' }}>{description}</p>
      {action}
    </div>
  );
}

/** Toast bubble. Rendered inside the #app-toasts host by Toasts.jsx. */
export function Toast({ message, kind = 'ok' }) {
  const iconName = kind === 'error' ? 'x-circle' : kind === 'info' ? 'info-circle' : 'check2-circle';
  const className = `toast${kind === 'error' ? ' is-error' : kind === 'info' ? ' is-info' : ''}`;
  return (
    <output className={className} role="status">
      <Icon name={iconName} />
      <span>{message}</span>
    </output>
  );
}

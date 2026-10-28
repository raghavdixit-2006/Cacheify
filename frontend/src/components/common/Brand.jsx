/**
 * Cacheify brand lockup. The mark is a single geometric bolt inside a
 * rounded red tile; it scales cleanly from the 28px sidebar mark to the
 * 44px auth header and never depends on an external image.
 */

import Link from 'next/link';

export function LogoMark({ className = '' }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M18.9 4.5 8.7 18.2h5.8L13 27.5l10.3-14.1h-5.9l1.5-8.9Z"
          fill="currentColor"
        />
        <path
          d="M24.6 19.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export default function Brand({ href = '/', className = '', label = 'Cacheify', markOnly = false }) {
  return (
    <Link href={href} className={`navbar-brand ${className}`.trim()} aria-label={markOnly ? `${label} home` : undefined}>
      <LogoMark />
      {markOnly ? null : <span>{label}</span>}
    </Link>
  );
}

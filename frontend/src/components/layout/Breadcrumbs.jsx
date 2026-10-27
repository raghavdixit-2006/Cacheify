/**
 * Breadcrumbs: answers "where am I / how do I get back". Inline list styles
 * match the original markup (renderFooter parity).
 */

import Link from 'next/link';

export function Breadcrumbs({ trail }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ul style={{ listStyle: 'none', display: 'flex', gap: '8px', margin: '0', padding: '0' }}>
        {trail.map((crumb) => (
          <li key={crumb.href ?? crumb.label}>
            {crumb.current ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.href}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default Breadcrumbs;

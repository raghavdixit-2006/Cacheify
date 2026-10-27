/**
 * Global site footer: attribution + links.
 * Zero inline styles beyond the original parity markup; visual layout via CSS.
 */

import Link from 'next/link';
import { Icon } from '../common/Icon.jsx';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        {/* Left: attribution */}
        <div className="footer-attribution">
          <Icon name="bolt" />
          <span>Made by Rahul Gheek  •  rahulgheek1@gmail.com</span>
        </div>
        {/* Right: links */}
        <nav className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/manual">Manual</Link>
        </nav>
      </div>
    </footer>
  );
}

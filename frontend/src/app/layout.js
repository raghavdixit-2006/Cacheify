import '../styles/tokens.css';
import '../styles/main.css';
import Toasts from '../components/common/Toasts.jsx';

export const metadata = {
  title: 'Cacheify Console',
  description: 'Multi-user Redis hosting platform with isolated databases, scoped API keys, and an admin control plane.',
};

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Cacheify Console',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
});

/* Fonts load as plain Google links (same URLs as the old index.html) so the
   --font-ui / --font-mono families declared in tokens.css keep resolving;
   React hoists the <link> elements into <head>. */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
        {children}
        <Toasts />
      </body>
    </html>
  );
}

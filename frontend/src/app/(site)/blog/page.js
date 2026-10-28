import BlogPage from '../../../views/BlogPage.jsx';

export const metadata = {
  title: 'Engineering notes — Cacheify',
  description:
    'Implementation notes from building a Redis-compatible platform over HTTP: the contract, mandatory TTL, scoped keys, tenant isolation and quota rollback.',
};

export default function Page() {
  return <BlogPage />;
}

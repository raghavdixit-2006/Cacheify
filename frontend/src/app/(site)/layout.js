import RouterBridge from '../../router/RouterBridge.jsx';
import AuthGate from '../../components/layout/AuthGate.jsx';

export default function SiteLayout({ children }) {
  return (
    <>
      <RouterBridge />
      <AuthGate>
        {children}
      </AuthGate>
    </>
  );
}

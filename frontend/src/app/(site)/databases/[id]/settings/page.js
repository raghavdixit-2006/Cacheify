import DatabaseSettingsPage from '../../../../../views/DatabaseSettingsPage.jsx';

export default async function Page({ params }) {
  const { id } = await params;
  return <DatabaseSettingsPage dbId={id} />;
}

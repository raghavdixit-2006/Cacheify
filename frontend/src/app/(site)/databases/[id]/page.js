import DatabaseDetailPage from '../../../../views/DatabaseDetailPage.jsx';

export default async function Page({ params }) {
  const { id } = await params;
  return <DatabaseDetailPage dbId={id} />;
}

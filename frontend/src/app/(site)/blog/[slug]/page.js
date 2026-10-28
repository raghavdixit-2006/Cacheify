import { notFound } from 'next/navigation';
import BlogPostPage from '../../../../views/BlogPostPage.jsx';
import { NOTES, getNote } from '../../../../content/notes.js';

export function generateStaticParams() {
  return NOTES.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return {};
  return {
    title: `${note.title} — Cacheify engineering notes`,
    description: note.summary,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();
  return <BlogPostPage note={note} />;
}

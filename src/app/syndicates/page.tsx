import { redirect } from 'next/navigation';

/**
 * Redirect /syndicates → /coordinate
 * 
 * The discovery page has better filtering, search, and sorting.
 * This route is kept for backward compatibility (nav links, bookmarks).
 */
export default function SyndicatesPage() {
  redirect('/coordinate');
}

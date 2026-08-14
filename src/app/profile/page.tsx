import { redirect } from 'next/navigation';

/**
 * Redirect /profile → /portfolio
 *
 * The legacy user-dashboard page duplicated content now covered by
 * /portfolio (wallet + positions) and /my-tickets (ticket history).
 * The `syndicate_base_address` preference it stored lives in localStorage
 * and is read/written independently by SimplePurchaseModal, so nothing
 * is lost by the redirect.
 * Route kept for backward compatibility (bookmarks, old links).
 */
export default function ProfilePage() {
  redirect('/portfolio');
}

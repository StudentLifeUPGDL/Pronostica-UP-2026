import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';
import { EMPTY_PUBLIC_STATS, type PublicStats } from '../app/data/worldcup';

// Public aggregate stats live in stats/public. They hold ONLY paid counts (no
// personal data) so the home page can show the live bote. The doc is world-readable
// (Firestore rules) and written only by the admin via recomputePublicStats().

const STATS_DOC = 'public';

export async function fetchPublicStats(): Promise<PublicStats> {
  if (!firebaseConfigured) return EMPTY_PUBLIC_STATS;
  try {
    const snap = await getDoc(doc(db, 'stats', STATS_DOC));
    if (!snap.exists()) return EMPTY_PUBLIC_STATS;
    return { ...EMPTY_PUBLIC_STATS, ...(snap.data() as Partial<PublicStats>) };
  } catch {
    // stats doc not published yet or rules pending — fall back to zeros silently.
    return EMPTY_PUBLIC_STATS;
  }
}

// Admin-only: recompute paid counts from predictions + tickets and publish them.
// Best-effort — callers invoke this after a payment change and swallow errors so
// the underlying action never fails just because the public board couldn't update.
export async function recomputePublicStats(): Promise<void> {
  if (!firebaseConfigured) return;
  const [predsSnap, ticketsSnap] = await Promise.all([
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'tickets')),
  ]);

  const stats: PublicStats = { ...EMPTY_PUBLIC_STATS, updatedAt: new Date().toISOString() };
  for (const d of predsSnap.docs) {
    const p = d.data() as { league?: string; paymentStatus?: string };
    if (p.paymentStatus !== 'paid') continue;
    if (p.league === 'main') stats.mainPaid++;
    else if (p.league === 'r32') stats.r32Paid++;
    else if (p.league === 'r16') stats.r16Paid++;
  }
  for (const d of ticketsSnap.docs) {
    const t = d.data() as { paymentStatus?: string };
    if (t.paymentStatus === 'paid') stats.rifaPaid++;
  }

  await setDoc(doc(db, 'stats', STATS_DOC), stats);
}

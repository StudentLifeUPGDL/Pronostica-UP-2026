import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';

// ─── mail jobs (admin → cron relay) ───────────────────────────────────────────
//
// There is no web backend, so the browser can't send mail directly. Instead the
// admin queues a 'pending' job in the `mailJobs` collection and the GitHub Actions
// cron (scripts/sendReminders.mjs) sends the emails on its next run and marks the
// job 'sent'. Used by both modes:
//   - 'rifa-reminder'       → owners of unpaid Rifa tickets (AdminRifa).
//   - 'pronostica-reminder' → owners of unpaid Pronostica entries (AdminReport).

export type MailJobType = 'rifa-reminder' | 'pronostica-reminder';

export interface MailJob {
  id: string;
  type: MailJobType;
  status: 'pending' | 'sent' | 'error';
  requestedAt: string;          // ISO
  requestedBy?: string;         // admin email (audit only)
  recipientCount?: number;      // filled by the cron
  sentCount?: number;           // filled by the cron
  finishedAt?: string;          // ISO — when the cron finished
  error?: string;               // set by the cron on failure
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

// Queue a payment-reminder send. The cron reads config.paymentDeadline and the live
// ticket/prediction list (for the given type) when it runs.
export async function requestReminderJob(type: MailJobType, requestedBy?: string): Promise<MailJob> {
  const prefix = type === 'rifa-reminder' ? 'rmd' : 'pmd';
  const job: MailJob = {
    id: `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    requestedBy,
  };
  await setDoc(doc(db, 'mailJobs', job.id), stripUndefined(job as unknown as Record<string, unknown>));
  return job;
}

// Most recent reminder job of a type, for showing its status in the admin UI. The
// collection is tiny, so we read it all and sort client-side (no composite index).
export async function fetchLatestReminderJob(type: MailJobType): Promise<MailJob | null> {
  if (!firebaseConfigured) return null;
  const snap = await getDocs(collection(db, 'mailJobs'));
  const jobs = snap.docs
    .map(d => d.data() as MailJob)
    .filter(j => j.type === type)
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
  return jobs[0] ?? null;
}

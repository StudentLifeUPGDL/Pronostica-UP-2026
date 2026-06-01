import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, Timestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, firebaseConfigured } from './firebase';
import {
  DEFAULT_CONFIG, EMPTY_RESULTS,
  type AppConfig, type Prediction, type PaymentStatus, type Results,
} from '../app/data/worldcup';

// ─── helpers ──────────────────────────────────────────────────────────────────

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

function tsToIso(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  // plain {seconds,nanoseconds} fallback
  const anyV = v as { toDate?: () => Date };
  if (typeof anyV.toDate === 'function') return anyV.toDate().toISOString();
  return undefined;
}

export function makeShortCode(uid: string): string {
  const base = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'XXXX';
  return `QM-${base}`;
}

const byCreatedDesc = (a: Prediction, b: Prediction) =>
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

// ─── users ──────────────────────────────────────────────────────────────────

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  shortCode: string;
  createdAt: string;
}

export async function ensureUserDoc(user: User, displayName?: string): Promise<void> {
  if (!firebaseConfigured) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? '',
      displayName: displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'Participante',
      shortCode: makeShortCode(user.uid),
      createdAt: new Date().toISOString(),
    });
  } else if (displayName && snap.data().displayName !== displayName) {
    await updateDoc(ref, { displayName });
  }
}

export async function fetchAllUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data() as UserDoc);
}

// ─── predictions ──────────────────────────────────────────────────────────────

export async function fetchMyPredictions(uid: string): Promise<Prediction[]> {
  const q = query(collection(db, 'predictions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Prediction).sort(byCreatedDesc);
}

export async function fetchAllPredictions(): Promise<Prediction[]> {
  const snap = await getDocs(collection(db, 'predictions'));
  return snap.docs.map(d => d.data() as Prediction).sort(byCreatedDesc);
}

// Create or update a MAIN entry. On create, enforces the per-user pending cap
// (client-side; not a security boundary). The lock window is enforced by rules.
export async function saveMainPrediction(pred: Prediction, isNew: boolean): Promise<void> {
  if (isNew) {
    const [mine, cfg] = await Promise.all([fetchMyPredictions(pred.uid), fetchConfig()]);
    const pending = mine.filter(p => p.league === 'main' && p.paymentStatus === 'pending').length;
    if (pending >= cfg.maxPendingPerUser) {
      throw new Error(
        `Tienes ${pending} quinela(s) con pago pendiente (máximo ${cfg.maxPendingPerUser}). ` +
        `Espera a que se confirme un pago antes de crear otra.`,
      );
    }
  }
  await setDoc(doc(db, 'predictions', pred.id), stripUndefined(pred as unknown as Record<string, unknown>));
}

// Create a fix snapshot (r32 / r16 league). Eligibility (paid parent, window open,
// one-fix-per-round) is checked by the caller; the open window is enforced by rules.
export async function saveFix(pred: Prediction): Promise<void> {
  await setDoc(doc(db, 'predictions', pred.id), stripUndefined(pred as unknown as Record<string, unknown>));
}

export async function deletePrediction(id: string): Promise<void> {
  await deleteDoc(doc(db, 'predictions', id));
}

export async function setPaymentStatus(
  predId: string, status: PaymentStatus, note?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { paymentStatus: status };
  patch.paidAt = status === 'paid' ? new Date().toISOString() : null;
  if (note !== undefined) patch.paymentNote = note;
  await updateDoc(doc(db, 'predictions', predId), patch);
}

// Voids MAIN entries still pending after the payment deadline (admin action).
export async function applyVoids(): Promise<number> {
  const cfg = await fetchConfig();
  const deadline = new Date(cfg.paymentDeadline).getTime();
  if (Date.now() <= deadline) return 0;
  const all = await fetchAllPredictions();
  const toVoid = all.filter(p => p.league === 'main' && p.paymentStatus === 'pending');
  if (!toVoid.length) return 0;
  const batch = writeBatch(db);
  for (const p of toVoid) batch.update(doc(db, 'predictions', p.id), { paymentStatus: 'void' });
  await batch.commit();
  return toVoid.length;
}

// ─── config ─────────────────────────────────────────────────────────────────

export async function fetchConfig(): Promise<AppConfig> {
  if (!firebaseConfigured) return DEFAULT_CONFIG;
  const snap = await getDoc(doc(db, 'config', 'app'));
  if (!snap.exists()) return DEFAULT_CONFIG;
  const d = snap.data();
  return {
    lockDate: tsToIso(d.lockDate) ?? DEFAULT_CONFIG.lockDate,
    paymentDeadline: tsToIso(d.paymentDeadline) ?? DEFAULT_CONFIG.paymentDeadline,
    r32StartDate: tsToIso(d.r32StartDate) ?? DEFAULT_CONFIG.r32StartDate,
    r16StartDate: tsToIso(d.r16StartDate) ?? DEFAULT_CONFIG.r16StartDate,
    season: d.season ?? DEFAULT_CONFIG.season,
    adminEmails: d.adminEmails ?? DEFAULT_CONFIG.adminEmails,
    maxPendingPerUser: d.maxPendingPerUser ?? DEFAULT_CONFIG.maxPendingPerUser,
    currency: d.currency ?? DEFAULT_CONFIG.currency,
    fees: d.fees ?? DEFAULT_CONFIG.fees,
    payoutPercent: d.payoutPercent ?? DEFAULT_CONFIG.payoutPercent,
    payoutRoundTo: d.payoutRoundTo ?? DEFAULT_CONFIG.payoutRoundTo,
  };
}

// Stores config dates as Firestore Timestamps so the security rules can compare
// them against request.time.
export async function saveConfig(cfg: AppConfig): Promise<void> {
  await setDoc(doc(db, 'config', 'app'), {
    ...cfg,
    lockDate: Timestamp.fromDate(new Date(cfg.lockDate)),
    paymentDeadline: Timestamp.fromDate(new Date(cfg.paymentDeadline)),
    r32StartDate: Timestamp.fromDate(new Date(cfg.r32StartDate)),
    r16StartDate: Timestamp.fromDate(new Date(cfg.r16StartDate)),
  });
}

// ─── results ──────────────────────────────────────────────────────────────────

export async function fetchResults(): Promise<Results> {
  if (!firebaseConfigured) return EMPTY_RESULTS;
  const snap = await getDoc(doc(db, 'results', 'official'));
  if (!snap.exists()) return EMPTY_RESULTS;
  return { ...EMPTY_RESULTS, ...(snap.data() as Partial<Results>) };
}

export async function saveResults(results: Results): Promise<void> {
  await setDoc(doc(db, 'results', 'official'), {
    ...results,
    updatedAt: new Date().toISOString(),
  });
}

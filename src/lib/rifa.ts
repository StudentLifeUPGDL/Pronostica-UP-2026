import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';
import {
  makeTicketFolio, POOL_CAPACITY,
  type Ticket, type Pool, type PaymentStatus, type Results,
} from '../app/data/worldcup';

// ─── helpers ──────────────────────────────────────────────────────────────────

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

const byCreatedDesc = (a: Ticket, b: Ticket) =>
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

// ─── tickets ──────────────────────────────────────────────────────────────────

export interface BuyTicketInput {
  uid: string;
  email?: string;
  displayName?: string;
}

// Buy a Rifa ticket: creates a pending ticket with NO pool/team. The cron
// (scripts/managePools.mjs) bins paid tickets into pools of 48 and draws the
// teams — the client cannot set poolId/teamId/paymentStatus (Firestore rules).
// Players may buy as many tickets as they wish (no cap).
export async function buyTicket(input: BuyTicketInput): Promise<Ticket> {
  const ticket: Ticket = {
    id: makeTicketFolio(),
    uid: input.uid,
    userEmail: input.email,
    userDisplayName: input.displayName,
    paymentStatus: 'pending',
    poolId: '',
    teamId: '',
    notified: false,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'tickets', ticket.id), stripUndefined(ticket as unknown as Record<string, unknown>));
  return ticket;
}

export async function fetchMyTickets(uid: string): Promise<Ticket[]> {
  if (!firebaseConfigured) return [];
  const q = query(collection(db, 'tickets'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Ticket).sort(byCreatedDesc);
}

export async function fetchAllTickets(): Promise<Ticket[]> {
  const snap = await getDocs(collection(db, 'tickets'));
  return snap.docs.map(d => d.data() as Ticket).sort(byCreatedDesc);
}

// Admin-only (Firestore rules): confirm/void a ticket's payment. The cron picks
// up paid tickets on its next run to bin + assign teams.
export async function setTicketPayment(
  id: string, status: PaymentStatus, note?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { paymentStatus: status };
  patch.paidAt = status === 'paid' ? new Date().toISOString() : null;
  if (note !== undefined) patch.paymentNote = note;
  await updateDoc(doc(db, 'tickets', id), patch);
}

// Owner may delete only an unpaid ticket not yet in a pool; admin may delete any.
export async function deleteTicket(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tickets', id));
}

// ─── pools ──────────────────────────────────────────────────────────────────

export async function fetchPools(): Promise<Pool[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'pools'));
  return snap.docs.map(d => d.data() as Pool).sort((a, b) => a.index - b.index);
}

// ─── prize math ──────────────────────────────────────────────────────────────

export interface PoolPrize {
  gross: number;        // fee × capacity
  distributable: number; // gross × payoutPercent, rounded DOWN to roundTo
  champion: number;
  runnerUp: number;
  thirdPlace: number;
}

// A pool's prize = full pool (fee × 48) × payoutPercent, rounded down, then split
// by the pool's payoutSplit between the holders of champ / runner-up / 3rd-place.
export function poolPrize(pool: Pool, payoutPercent: number, roundTo: number): PoolPrize {
  const gross = pool.fee * pool.capacity;
  const raw = gross * payoutPercent;
  const distributable = roundTo > 0 ? Math.floor(raw / roundTo) * roundTo : Math.floor(raw);
  const [c = 0, r = 0, t = 0] = pool.payoutSplit ?? [];
  return {
    gross,
    distributable,
    champion: Math.floor(distributable * c),
    runnerUp: Math.floor(distributable * r),
    thirdPlace: Math.floor(distributable * t),
  };
}

// ─── team progress (display) ──────────────────────────────────────────────────

export interface TeamStatus { label: string; color: string }

// How far an assigned team has gone, derived live from the official Results doc.
// Display only — used to tell a ticket owner whether their team is still alive.
export function teamStatus(teamId: string, r: Results): TeamStatus {
  if (!teamId) return { label: 'Sin asignar', color: '#4a7d65' };
  if (r.champion === teamId)   return { label: '🏆 Campeón', color: '#f5a623' };
  if (r.runnerUp === teamId)   return { label: '🥈 Subcampeón', color: '#d4f226' };
  if (r.thirdPlace === teamId) return { label: '🥉 Tercer lugar', color: '#cd7f32' };

  // If the final/3rd-place is decided and this team isn't on the podium, it's out.
  const podiumDecided = !!r.champion;

  if ((r.sfWinners ?? []).includes(teamId)) return { label: 'Finalista', color: '#4ade80' };
  if ((r.qfWinners ?? []).includes(teamId)) return { label: podiumDecided ? 'Eliminado · Semifinal' : 'En Semifinal', color: podiumDecided ? '#7eb89a' : '#4ade80' };
  if ((r.r16Winners ?? []).includes(teamId)) return { label: podiumDecided ? 'Eliminado · Cuartos' : 'En Cuartos', color: podiumDecided ? '#7eb89a' : '#4ade80' };
  if ((r.r32Winners ?? []).includes(teamId)) return { label: podiumDecided ? 'Eliminado · Octavos' : 'En Octavos', color: podiumDecided ? '#7eb89a' : '#4ade80' };

  // Reached the knockout (group winner/runner-up or best third) but no KO result yet.
  const inR32 = Object.values(r.groups ?? {}).some(g => g.first === teamId || g.second === teamId)
    || (r.bestThirds ?? []).includes(teamId);
  if (inR32) return { label: podiumDecided ? 'Eliminado' : 'En Dieciseisavos', color: podiumDecided ? '#7eb89a' : '#9cc4b2' };

  // Group stage finished and the team isn't 1st/2nd/3rd → didn't qualify.
  const groupFinishedForTeam = Object.values(r.groups ?? {}).some(
    g => g.first === teamId || g.second === teamId || g.third === teamId,
  );
  if (groupFinishedForTeam) return { label: 'Eliminado en grupos', color: '#7eb89a' };

  return { label: 'En el torneo', color: '#9cc4b2' };
}

// True once a team is definitively out (no chance at any podium prize).
export function isEliminated(teamId: string, r: Results): boolean {
  const s = teamStatus(teamId, r);
  return s.label.startsWith('Eliminado');
}

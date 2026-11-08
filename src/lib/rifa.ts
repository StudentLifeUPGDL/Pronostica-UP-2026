import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';
import { recomputePublicStats } from './stats';
import {
  makeTicketFolio, POOL_CAPACITY, computeEliminatedTeams,
  type Ticket, type Pool, type PaymentStatus, type Results, type RifaPrizes,
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

export interface AdminAddTicketInput {
  uid: string;
  email?: string;
  displayName?: string;
  note?: string;
}

// Admin-only: register a ticket on behalf of a participant who paid for an extra
// ticket outside the app (e.g. a transfer the app never captured). Creates it
// already PAID with no pool/team, so the cron bins it like any other paid ticket
// on its next run. Firestore rules let admins create tickets for any uid.
export async function adminAddTicket(input: AdminAddTicketInput): Promise<Ticket> {
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: makeTicketFolio(),
    uid: input.uid,
    userEmail: input.email,
    userDisplayName: input.displayName,
    paymentStatus: 'paid',
    paidAt: now,
    paymentNote: input.note,
    poolId: '',
    teamId: '',
    notified: false,
    createdAt: now,
  };
  await setDoc(doc(db, 'tickets', ticket.id), stripUndefined(ticket as unknown as Record<string, unknown>));
  await recomputePublicStats().catch(() => {});
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
  await recomputePublicStats().catch(() => {});
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

// ─── prize ladder (fixed prizes funded by the organizer) ──────────────────────

// Static description of the prize ladder, for display ("¿Qué se gana?").
export interface RifaLadderTier {
  place: string;                 // "1°", "5°–8°", …
  label: string;                 // "Campeón", "Eliminados en Cuartos", …
  kind: 'cash' | 'voucher';
  amount: number;                // cash prize, or voucher value per person
  seats: number;                 // how many tickets get this tier
}

export function rifaPrizeLadder(prizes: RifaPrizes): RifaLadderTier[] {
  return [
    { place: '1°', label: 'Campeón', kind: 'cash', amount: prizes.first, seats: 1 },
    { place: '2°', label: 'Subcampeón', kind: 'cash', amount: prizes.second, seats: 1 },
    { place: '3°', label: 'Tercer lugar', kind: 'cash', amount: prizes.third, seats: 1 },
    { place: '4°', label: 'Cuarto lugar', kind: 'cash', amount: prizes.fourth, seats: 1 },
    { place: '5°–8°', label: 'Eliminados en Cuartos', kind: 'voucher', amount: prizes.consolation, seats: 4 },
    { place: '9°–16°', label: 'Eliminados en Octavos', kind: 'voucher', amount: prizes.consolation, seats: 8 },
  ];
}

// Which TEAMS currently occupy each prize place, derived live from the official
// Results. The owner of the ticket holding that team is the prize winner.
//   1°–4° → cash (4° = the semifinalist that isn't champ/runner-up/3rd)
//   5°–8° → eliminados en Cuartos  (reached QF, didn't reach SF)
//   9°–16° → eliminados en Octavos (reached R16, didn't reach QF)
export interface RifaPlaces {
  first: string;          // teamId or ''
  second: string;
  third: string;
  fourth: string;
  quartersOut: string[];  // 5°–8°
  roundOf16Out: string[]; // 9°–16°
}

export function rifaPlaces(r: Results): RifaPlaces {
  const qf = (r.qfWinners ?? []).filter(Boolean);     // 4 semifinalists
  const r16 = (r.r16Winners ?? []).filter(Boolean);   // 8 teams that reached QF
  const r32 = (r.r32Winners ?? []).filter(Boolean);   // 16 teams that reached R16 (octavos)

  // 4th place is the remaining semifinalist once the 3rd-place match is decided.
  const podium = new Set([r.champion, r.runnerUp, r.thirdPlace].filter(Boolean));
  const fourth = r.thirdPlace ? (qf.find(t => !podium.has(t)) ?? '') : '';

  return {
    first: r.champion ?? '',
    second: r.runnerUp ?? '',
    third: r.thirdPlace ?? '',
    fourth,
    quartersOut: r16.filter(t => !qf.includes(t)),
    roundOf16Out: r32.filter(t => !r16.includes(t)),
  };
}

// Total cash put up by the organizer (excludes the Nessu vouchers).
export function rifaCashTotal(prizes: RifaPrizes): number {
  return prizes.first + prizes.second + prizes.third + prizes.fourth;
}

// ─── team progress (display) ──────────────────────────────────────────────────

export interface TeamStatus { label: string; color: string }

// Colours: green = still alive, red = out.
const ALIVE = '#4ade80';
const ALIVE_DIM = '#9cc4b2';
const OUT = '#e07a82';

// Memoize the eliminated-team set per Results object. The Firestore snapshot replaces
// `r` with a new object on every update, so identity is a safe cache key within a render.
let _elimCache: { r: Results; set: Set<string> } | null = null;
function eliminatedSet(r: Results): Set<string> {
  if (_elimCache && _elimCache.r === r) return _elimCache.set;
  const set = computeEliminatedTeams(r);
  _elimCache = { r, set };
  return set;
}

// How far an assigned team has gone, derived live from the official Results doc.
// Display only — used to tell a ticket owner whether their team is still alive.
// A team is flagged "Eliminado · <ronda>" as soon as it's actually knocked out (the
// round it lost), not only once the whole podium is decided.
export function teamStatus(teamId: string, r: Results): TeamStatus {
  if (!teamId) return { label: 'Sin asignar', color: '#4a7d65' };
  if (r.champion === teamId)   return { label: '🏆 Campeón', color: '#f5a623' };
  if (r.runnerUp === teamId)   return { label: '🥈 Subcampeón', color: '#d4f226' };
  if (r.thirdPlace === teamId) return { label: '🥉 Tercer lugar', color: '#cd7f32' };

  const out = eliminatedSet(r).has(teamId);

  // The furthest round the team reached; "Eliminado · X" if it's already out there,
  // otherwise "En X" (still alive / round not decided yet).
  if ((r.sfWinners ?? []).includes(teamId)) return { label: 'Finalista', color: ALIVE };
  if ((r.qfWinners ?? []).includes(teamId)) return { label: out ? 'Eliminado · Semifinal' : 'En Semifinal', color: out ? OUT : ALIVE };
  if ((r.r16Winners ?? []).includes(teamId)) return { label: out ? 'Eliminado · Cuartos' : 'En Cuartos', color: out ? OUT : ALIVE };
  if ((r.r32Winners ?? []).includes(teamId)) return { label: out ? 'Eliminado · Octavos' : 'En Octavos', color: out ? OUT : ALIVE };

  // Reached the knockout (group winner/runner-up or best third) but no KO result yet.
  const inR32 = Object.values(r.groups ?? {}).some(g => g.first === teamId || g.second === teamId)
    || (r.bestThirds ?? []).includes(teamId);
  if (inR32) return { label: out ? 'Eliminado · Dieciseisavos' : 'En Dieciseisavos', color: out ? OUT : ALIVE_DIM };

  // Group stage finished and the team isn't 1st/2nd/3rd → didn't qualify.
  const groupFinishedForTeam = Object.values(r.groups ?? {}).some(
    g => g.first === teamId || g.second === teamId || g.third === teamId,
  );
  if (groupFinishedForTeam) return { label: 'Eliminado en grupos', color: OUT };

  return { label: 'En el torneo', color: ALIVE_DIM };
}

// True once a team is definitively out (no chance at any podium prize).
export function isEliminated(teamId: string, r: Results): boolean {
  const s = teamStatus(teamId, r);
  return s.label.startsWith('Eliminado');
}

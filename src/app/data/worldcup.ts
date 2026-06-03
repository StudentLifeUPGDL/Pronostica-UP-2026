export interface Team {
  id: string;
  name: string;
  flag: string;
  confederation: string;
  shortName: string;
}

export interface Group {
  id: string;
  name: string;
  teams: Team[];
}

export interface Match {
  id: string;
  matchNum?: number;        // official FIFA match number (1–104)
  date: string;
  time: string;
  homeTeamId: string;       // '' when the team is not yet known (knockout placeholder)
  awayTeamId: string;       // '' when the team is not yet known
  homeLabel?: string;       // shown when homeTeamId is '' — e.g. "1° Gr. A", "Ganador P73"
  awayLabel?: string;       // shown when awayTeamId is '' — e.g. "Mejor 3°", "Ganador P75"
  homeScore?: number;
  awayScore?: number;
  status: 'upcoming' | 'live' | 'finished';
  group?: string;
  round?: string;
  city: string;
}

export interface User {
  id: string;
  name: string;
}

export interface GroupPick {
  first: string;
  second: string;
  third: string;
}

// Which competition an entry belongs to. 'main' = the main quiniela; 'r32' / 'r16' =
// standalone side-league tournaments of the knockout (each its own league + prize pool).
export type League = 'main' | 'r32' | 'r16';

// Per-entry payment lifecycle.
//   pending → the user hasn't paid yet (pay button shown).
//   review  → the user paid through the external app and uploaded a proof
//             screenshot; "CONFIRMANDO PAGO" until the admin verifies it.
//   paid    → the admin confirmed the proof against the received transfer.
//   void    → cancelled (e.g. expired pending after the deadline).
// pending → review is set by the owner (uploading proof); review → paid/void is
// the admin's manual decision.
export type PaymentStatus = 'pending' | 'review' | 'paid' | 'void';

export interface Prediction {
  id: string;
  uid: string;                        // Firebase Auth uid of the owner (== quiniela ID)
  userEmail?: string;
  userDisplayName?: string;
  name: string;
  league: League;
  createdAt: string;                  // ISO
  updatedAt?: string;                 // ISO
  lockedAt?: string;                  // ISO — when this version froze (kickoff / round start)
  groups: Record<string, GroupPick>;
  eliminatedThird: string[];          // 4 team IDs that don't advance from 3rd place
  r32Thirds: Record<string, string>;  // matchId → teamId for best-3rd slots in R32
  r32: Record<string, string>;
  r16: Record<string, string>;
  qf: Record<string, string>;
  sf: Record<string, string>;
  champion: string;
  runnerUp: string;
  thirdPlace: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  paymentNote?: string;
  proofUrl?: string;                  // payment screenshot (Firebase Storage URL), set on review
  proofSubmittedAt?: string;          // ISO — when the owner uploaded the proof
  points: number;                     // optional cache; standings are computed live from Results
}

// ─── Rifa de Países (modo tradicional) ────────────────────────────────────────
// A "pool" is a batch of 48 tickets. A player buys as many tickets as they like;
// each ticket costs `rifaFee`. Once a pool reaches 48 PAID tickets, the GitHub
// Actions cron (scripts/managePools.mjs) randomly assigns the 48 World Cup teams
// (one per ticket), emails each owner, freezes the pool, and opens the next one.
// All assignment/binning is done by the trusted cron with the admin SDK — the
// client NEVER writes poolId/teamId/paymentStatus, so nobody can pick their team.

export type PoolStatus = 'open' | 'assigned';

export const POOL_CAPACITY = 48; // one slot per qualified team

export interface Ticket {
  id: string;                 // folio RIFA-XXXXX (== Firestore doc id)
  uid: string;                // owner's Firebase Auth uid
  userEmail?: string;
  userDisplayName?: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;            // ISO — set by admin when the transfer is confirmed
  paymentNote?: string;
  proofUrl?: string;          // payment screenshot (Firebase Storage URL), set on review
  proofSubmittedAt?: string;  // ISO — when the owner uploaded the proof
  poolId: string;             // '' until the cron bins it into a pool
  poolIndex?: number;         // cache of the pool's sequential number (display)
  teamId: string;             // '' until the pool is assigned
  notified?: boolean;         // assignment email sent (cron sets this)
  createdAt: string;          // ISO
}

export interface Pool {
  id: string;                 // e.g. "pool-3" (== Firestore doc id)
  index: number;              // sequential pool number (Pool #1, #2, …)
  status: PoolStatus;
  capacity: number;           // POOL_CAPACITY (48)
  paidCount: number;          // paid tickets currently in this pool (0–48)
  fee: number;                // snapshot of rifaFee when the pool filled
  payoutSplit: number[];      // snapshot of rifaPayoutSplit [champ, runnerUp, third]
  assignedAt?: string;        // ISO — when the 48 teams were drawn
  assignedSeed?: string;      // hex seed of the shuffle (auditability)
  createdAt: string;          // ISO
}

// ─── Real tournament results (admin-entered, drives scoring) ──────────────────

export interface GroupResult {
  first: string;   // team id that actually finished 1st
  second: string;  // 2nd
  third: string;   // 3rd
}

// One row of a live group standings table (provisional — updated after each match).
export interface GroupStandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export interface Results {
  groups: Record<string, GroupResult>; // exact placements per group A–L (scored — written only once the group has played all its matches)
  groupTables?: Record<string, GroupStandingRow[]>; // live standings rows per group, in position order (display only, updates each match)
  bestThirds?: string[];                // the (up to) 8 third-placed team IDs that advanced to R32; lets the bracket render the real "winner vs best 3rd" matchups
  r32Winners: string[];                 // 16 teams that won R32 (advanced to R16)
  r16Winners: string[];                 // 8 teams advancing to QF
  qfWinners: string[];                  // 4 teams advancing to SF
  sfWinners: string[];                  // 2 teams advancing to the Final
  champion: string;
  runnerUp: string;
  thirdPlace: string;
  updatedAt?: string;                   // ISO
}

export const EMPTY_RESULTS: Results = {
  groups: {}, groupTables: {}, bestThirds: [], r32Winners: [], r16Winners: [], qfWinners: [], sfWinners: [],
  champion: '', runnerUp: '', thirdPlace: '',
};

// ─── Public aggregate stats (paid counts → live bote, no personal data) ─────────
// Maintained by admin actions (payment confirmations) and world-readable so the
// home page can show the growing prize without exposing individual entries.
export interface PublicStats {
  mainPaid: number;   // paid 'main' predictions
  r32Paid: number;    // paid 'r32' predictions
  r16Paid: number;    // paid 'r16' predictions
  rifaPaid: number;   // paid rifa tickets
  updatedAt?: string;
}

export const EMPTY_PUBLIC_STATS: PublicStats = { mainPaid: 0, r32Paid: 0, r16Paid: 0, rifaPaid: 0 };

// Below this published bote, the home page shows a teaser ("participa por grandes
// premios") instead of a small number; at/above it, the live amount is revealed.
export const BIG_PRIZE_THRESHOLD = 1000;

// ─── App configuration (admin-editable, lives in config/app) ──────────────────

export interface AppFees { main: number; r32: number; r16: number; }

// Rifa de Países — FIXED prizes funded by the organizer (la UP cubre la diferencia).
// Ranking is by how far each ticket's assigned country goes in the World Cup:
//   1°=campeón, 2°=subcampeón, 3°=tercer lugar, 4°=cuarto lugar → premio en efectivo;
//   5°–16° (eliminados en cuartos y octavos) → vale de café para el Nessu.
export interface RifaPrizes {
  first: number;       // 1° (campeón)
  second: number;      // 2° (subcampeón)
  third: number;       // 3° (tercer lugar)
  fourth: number;      // 4° (cuarto lugar)
  consolation: number; // vale Nessu para los lugares 5°–16°
}

export const DEFAULT_RIFA_PRIZES: RifaPrizes = {
  first: 5000, second: 3000, third: 800, fourth: 800, consolation: 100,
};

export interface AppConfig {
  lockDate: string;          // ISO — MAIN entries lock (kickoff)
  paymentDeadline: string;   // ISO — pending MAIN entries auto-void after this
  r32StartDate: string;      // ISO — R32 league locks (join window closes at first R32 match)
  r16StartDate: string;      // ISO — R16 league locks (join window closes at first R16 match)
  season: string;
  adminEmails: string[];     // UI fallback only; rules trust the custom claim
  maxPendingPerUser: number;
  currency: string;
  fees: AppFees;
  payoutPercent: number;     // PUBLISHED share of each variant's bote (winner-takes-all, e.g. 0.80)
  payoutRoundTo: number;     // displayed prize rounded DOWN to this (e.g. 100)
  rifaEnabled: boolean;      // show/hide the "Rifa de Países" mode
  rifaFee: number;           // price per rifa ticket
  rifaPayoutSplit: number[]; // legacy snapshot kept on pools by the cron (no longer used for display)
  rifaPrizes: RifaPrizes;    // fixed prize ladder for the Rifa de Países
}

export const DEFAULT_CONFIG: AppConfig = {
  lockDate: '2026-06-11T16:00:00-05:00',     // kickoff (México City time, editable)
  paymentDeadline: '2026-06-14T23:59:00-05:00',
  r32StartDate: '2026-06-28T12:00:00-05:00',
  r16StartDate: '2026-07-04T12:00:00-05:00',
  season: '2026',
  adminEmails: ['hectorineg10@gmail.com'],
  maxPendingPerUser: 5,
  currency: 'MXN',
  fees: { main: 100, r32: 200, r16: 300 },
  payoutPercent: 0.8,
  payoutRoundTo: 100,
  rifaEnabled: true,
  rifaFee: 200,
  rifaPayoutSplit: [0.7, 0.2, 0.1],
  rifaPrizes: DEFAULT_RIFA_PRIZES,
};

// ─── Teams ────────────────────────────────────────────────────────────────────

// The 48 qualified teams of the 2026 FIFA World Cup, listed in their official
// Final Draw groups (draw held 5 Dec 2025; playoff spots resolved Mar 2026).
export const TEAMS: Record<string, Team> = {
  // Grupo A
  mex: { id: 'mex', name: 'México',               shortName: 'MEX', flag: '🇲🇽', confederation: 'CONCACAF' },
  rsa: { id: 'rsa', name: 'Sudáfrica',            shortName: 'RSA', flag: '🇿🇦', confederation: 'CAF'      },
  kor: { id: 'kor', name: 'Corea del Sur',        shortName: 'KOR', flag: '🇰🇷', confederation: 'AFC'      },
  cze: { id: 'cze', name: 'República Checa',      shortName: 'CZE', flag: '🇨🇿', confederation: 'UEFA'     },
  // Grupo B
  can: { id: 'can', name: 'Canadá',               shortName: 'CAN', flag: '🇨🇦', confederation: 'CONCACAF' },
  bih: { id: 'bih', name: 'Bosnia y Herzegovina', shortName: 'BIH', flag: '🇧🇦', confederation: 'UEFA'     },
  qat: { id: 'qat', name: 'Qatar',                shortName: 'QAT', flag: '🇶🇦', confederation: 'AFC'      },
  sui: { id: 'sui', name: 'Suiza',                shortName: 'SUI', flag: '🇨🇭', confederation: 'UEFA'     },
  // Grupo C
  bra: { id: 'bra', name: 'Brasil',               shortName: 'BRA', flag: '🇧🇷', confederation: 'CONMEBOL' },
  mar: { id: 'mar', name: 'Marruecos',            shortName: 'MAR', flag: '🇲🇦', confederation: 'CAF'      },
  hai: { id: 'hai', name: 'Haití',                shortName: 'HAI', flag: '🇭🇹', confederation: 'CONCACAF' },
  sco: { id: 'sco', name: 'Escocia',              shortName: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA'     },
  // Grupo D
  usa: { id: 'usa', name: 'Estados Unidos',       shortName: 'EUA', flag: '🇺🇸', confederation: 'CONCACAF' },
  par: { id: 'par', name: 'Paraguay',             shortName: 'PAR', flag: '🇵🇾', confederation: 'CONMEBOL' },
  aus: { id: 'aus', name: 'Australia',            shortName: 'AUS', flag: '🇦🇺', confederation: 'AFC'      },
  tur: { id: 'tur', name: 'Turquía',              shortName: 'TUR', flag: '🇹🇷', confederation: 'UEFA'     },
  // Grupo E
  ger: { id: 'ger', name: 'Alemania',             shortName: 'GER', flag: '🇩🇪', confederation: 'UEFA'     },
  cuw: { id: 'cuw', name: 'Curazao',              shortName: 'CUW', flag: '🇨🇼', confederation: 'CONCACAF' },
  civ: { id: 'civ', name: 'Costa de Marfil',      shortName: 'CIV', flag: '🇨🇮', confederation: 'CAF'      },
  ecu: { id: 'ecu', name: 'Ecuador',              shortName: 'ECU', flag: '🇪🇨', confederation: 'CONMEBOL' },
  // Grupo F
  ned: { id: 'ned', name: 'Países Bajos',         shortName: 'NED', flag: '🇳🇱', confederation: 'UEFA'     },
  jpn: { id: 'jpn', name: 'Japón',                shortName: 'JPN', flag: '🇯🇵', confederation: 'AFC'      },
  swe: { id: 'swe', name: 'Suecia',               shortName: 'SWE', flag: '🇸🇪', confederation: 'UEFA'     },
  tun: { id: 'tun', name: 'Túnez',                shortName: 'TUN', flag: '🇹🇳', confederation: 'CAF'      },
  // Grupo G
  bel: { id: 'bel', name: 'Bélgica',              shortName: 'BEL', flag: '🇧🇪', confederation: 'UEFA'     },
  egy: { id: 'egy', name: 'Egipto',               shortName: 'EGY', flag: '🇪🇬', confederation: 'CAF'      },
  irn: { id: 'irn', name: 'Irán',                 shortName: 'IRN', flag: '🇮🇷', confederation: 'AFC'      },
  nzl: { id: 'nzl', name: 'Nueva Zelanda',        shortName: 'NZL', flag: '🇳🇿', confederation: 'OFC'      },
  // Grupo H
  esp: { id: 'esp', name: 'España',               shortName: 'ESP', flag: '🇪🇸', confederation: 'UEFA'     },
  cpv: { id: 'cpv', name: 'Cabo Verde',           shortName: 'CPV', flag: '🇨🇻', confederation: 'CAF'      },
  ksa: { id: 'ksa', name: 'Arabia Saudita',       shortName: 'KSA', flag: '🇸🇦', confederation: 'AFC'      },
  uru: { id: 'uru', name: 'Uruguay',              shortName: 'URU', flag: '🇺🇾', confederation: 'CONMEBOL' },
  // Grupo I
  fra: { id: 'fra', name: 'Francia',              shortName: 'FRA', flag: '🇫🇷', confederation: 'UEFA'     },
  sen: { id: 'sen', name: 'Senegal',              shortName: 'SEN', flag: '🇸🇳', confederation: 'CAF'      },
  irq: { id: 'irq', name: 'Irak',                 shortName: 'IRQ', flag: '🇮🇶', confederation: 'AFC'      },
  nor: { id: 'nor', name: 'Noruega',              shortName: 'NOR', flag: '🇳🇴', confederation: 'UEFA'     },
  // Grupo J
  arg: { id: 'arg', name: 'Argentina',            shortName: 'ARG', flag: '🇦🇷', confederation: 'CONMEBOL' },
  alg: { id: 'alg', name: 'Argelia',              shortName: 'ALG', flag: '🇩🇿', confederation: 'CAF'      },
  aut: { id: 'aut', name: 'Austria',              shortName: 'AUT', flag: '🇦🇹', confederation: 'UEFA'     },
  jor: { id: 'jor', name: 'Jordania',             shortName: 'JOR', flag: '🇯🇴', confederation: 'AFC'      },
  // Grupo K
  por: { id: 'por', name: 'Portugal',             shortName: 'POR', flag: '🇵🇹', confederation: 'UEFA'     },
  cod: { id: 'cod', name: 'RD Congo',             shortName: 'COD', flag: '🇨🇩', confederation: 'CAF'      },
  uzb: { id: 'uzb', name: 'Uzbekistán',           shortName: 'UZB', flag: '🇺🇿', confederation: 'AFC'      },
  col: { id: 'col', name: 'Colombia',             shortName: 'COL', flag: '🇨🇴', confederation: 'CONMEBOL' },
  // Grupo L
  eng: { id: 'eng', name: 'Inglaterra',           shortName: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA'     },
  cro: { id: 'cro', name: 'Croacia',              shortName: 'CRO', flag: '🇭🇷', confederation: 'UEFA'     },
  gha: { id: 'gha', name: 'Ghana',                shortName: 'GHA', flag: '🇬🇭', confederation: 'CAF'      },
  pan: { id: 'pan', name: 'Panamá',               shortName: 'PAN', flag: '🇵🇦', confederation: 'CONCACAF' },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const GROUPS: Group[] = [
  { id: 'A', name: 'Grupo A', teams: [TEAMS.mex, TEAMS.rsa, TEAMS.kor, TEAMS.cze] },
  { id: 'B', name: 'Grupo B', teams: [TEAMS.can, TEAMS.bih, TEAMS.qat, TEAMS.sui] },
  { id: 'C', name: 'Grupo C', teams: [TEAMS.bra, TEAMS.mar, TEAMS.hai, TEAMS.sco] },
  { id: 'D', name: 'Grupo D', teams: [TEAMS.usa, TEAMS.par, TEAMS.aus, TEAMS.tur] },
  { id: 'E', name: 'Grupo E', teams: [TEAMS.ger, TEAMS.cuw, TEAMS.civ, TEAMS.ecu] },
  { id: 'F', name: 'Grupo F', teams: [TEAMS.ned, TEAMS.jpn, TEAMS.swe, TEAMS.tun] },
  { id: 'G', name: 'Grupo G', teams: [TEAMS.bel, TEAMS.egy, TEAMS.irn, TEAMS.nzl] },
  { id: 'H', name: 'Grupo H', teams: [TEAMS.esp, TEAMS.cpv, TEAMS.ksa, TEAMS.uru] },
  { id: 'I', name: 'Grupo I', teams: [TEAMS.fra, TEAMS.sen, TEAMS.irq, TEAMS.nor] },
  { id: 'J', name: 'Grupo J', teams: [TEAMS.arg, TEAMS.alg, TEAMS.aut, TEAMS.jor] },
  { id: 'K', name: 'Grupo K', teams: [TEAMS.por, TEAMS.cod, TEAMS.uzb, TEAMS.col] },
  { id: 'L', name: 'Grupo L', teams: [TEAMS.eng, TEAMS.cro, TEAMS.gha, TEAMS.pan] },
];

// ─── Official Round of 32 bracket ─────────────────────────────────────────────

export type TeamSlot =
  | { type: 'pos';    group: string; pos: 1 | 2 }
  | { type: 'best3rd'; eligibleGroups: string[] };

export interface OfficialR32Match {
  id: string;
  matchNum: number;
  date: string;
  time: string;     // kickoff in Ciudad de México time (UTC-6)
  stadium: string;
  home: TeamSlot;
  away: TeamSlot;
}

// Dates, venues and kickoff times are from FIFA's official match schedule.
// FIFA publishes all times in U.S. Eastern Time; here they are shown in Ciudad
// de México time (UTC-6, i.e. ET − 2h during the tournament in late Jun/Jul).
export const OFFICIAL_R32: OfficialR32Match[] = [
  // Jun 28
  {
    id: 'p73', matchNum: 73, date: '28 jun', time: '13:00', stadium: 'Los Ángeles',
    home: { type: 'pos', group: 'A', pos: 2 },
    away: { type: 'pos', group: 'B', pos: 2 },
  },
  // Jun 29
  {
    id: 'p74', matchNum: 74, date: '29 jun', time: '14:30', stadium: 'Boston',
    home: { type: 'pos', group: 'E', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['A','B','C','D','F'] },
  },
  {
    id: 'p75', matchNum: 75, date: '29 jun', time: '19:00', stadium: 'Monterrey',
    home: { type: 'pos', group: 'F', pos: 1 },
    away: { type: 'pos', group: 'C', pos: 2 },
  },
  {
    // Note: original data had "1º E" but E is already in p74 — corrected to 1º C
    id: 'p76', matchNum: 76, date: '29 jun', time: '11:00', stadium: 'Houston',
    home: { type: 'pos', group: 'C', pos: 1 },
    away: { type: 'pos', group: 'F', pos: 2 },
  },
  // Jun 30
  {
    id: 'p77', matchNum: 77, date: '30 jun', time: '15:00', stadium: 'Nueva York / Nueva Jersey',
    home: { type: 'pos', group: 'I', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['C','D','F','G','H'] },
  },
  {
    id: 'p78', matchNum: 78, date: '30 jun', time: '11:00', stadium: 'Dallas',
    home: { type: 'pos', group: 'E', pos: 2 },
    away: { type: 'pos', group: 'I', pos: 2 },
  },
  {
    id: 'p79', matchNum: 79, date: '30 jun', time: '19:00', stadium: 'Azteca — Ciudad de México',
    home: { type: 'pos', group: 'A', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['C','E','F','H','I'] },
  },
  // Jul 1
  {
    id: 'p80', matchNum: 80, date: '1 jul', time: '10:00', stadium: 'Atlanta',
    home: { type: 'pos', group: 'L', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['E','H','I','J','K'] },
  },
  {
    id: 'p81', matchNum: 81, date: '1 jul', time: '18:00', stadium: 'Bahía de San Francisco',
    home: { type: 'pos', group: 'D', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['B','E','F','I','J'] },
  },
  {
    id: 'p82', matchNum: 82, date: '1 jul', time: '14:00', stadium: 'Seattle',
    home: { type: 'pos', group: 'G', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['A','E','H','I','J'] },
  },
  // Jul 2
  {
    id: 'p83', matchNum: 83, date: '2 jul', time: '17:00', stadium: 'Toronto',
    home: { type: 'pos', group: 'K', pos: 2 },
    away: { type: 'pos', group: 'L', pos: 2 },
  },
  {
    id: 'p84', matchNum: 84, date: '2 jul', time: '13:00', stadium: 'Los Ángeles',
    home: { type: 'pos', group: 'H', pos: 1 },
    away: { type: 'pos', group: 'J', pos: 2 },
  },
  {
    id: 'p85', matchNum: 85, date: '2 jul', time: '21:00', stadium: 'BC Place Vancouver',
    home: { type: 'pos', group: 'B', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['E','F','G','I','J'] },
  },
  // Jul 3
  {
    id: 'p86', matchNum: 86, date: '3 jul', time: '16:00', stadium: 'Miami',
    home: { type: 'pos', group: 'J', pos: 1 },
    away: { type: 'pos', group: 'H', pos: 2 },
  },
  {
    id: 'p87', matchNum: 87, date: '3 jul', time: '19:30', stadium: 'Kansas City',
    home: { type: 'pos', group: 'K', pos: 1 },
    away: { type: 'best3rd', eligibleGroups: ['D','E','I','J','L'] },
  },
  {
    id: 'p88', matchNum: 88, date: '3 jul', time: '12:00', stadium: 'Dallas',
    home: { type: 'pos', group: 'D', pos: 2 },
    away: { type: 'pos', group: 'G', pos: 2 },
  },
];

// IDs of all R32 matches that need a best-3rd team
export const BEST3RD_MATCH_IDS = OFFICIAL_R32
  .filter(m => m.away.type === 'best3rd')
  .map(m => m.id);

// ─── Knockout brackets (official FIFA bracket, match numbers 89–104) ───────────
// The pairings below follow FIFA's published bracket exactly — they are NOT a
// "two consecutive matches feed the next" simplification. Times are kickoff in
// Ciudad de México (UTC-6); FIFA publishes them in U.S. Eastern Time (ET = CDMX + 2h).

export interface R16Pair {
  id: string; matchNum: number; date: string; time: string; stadium: string;
  r32a: string; r32b: string;  // the two R32 matches whose winners meet here
}
export const R16_PAIRS: R16Pair[] = [
  { id: 'r16-1', matchNum: 89, date: '4 jul', time: '15:00', stadium: 'Filadelfia',                 r32a: 'p74', r32b: 'p77' },
  { id: 'r16-2', matchNum: 90, date: '4 jul', time: '11:00', stadium: 'Houston',                    r32a: 'p73', r32b: 'p75' },
  { id: 'r16-3', matchNum: 91, date: '5 jul', time: '14:00', stadium: 'Nueva York / Nueva Jersey',  r32a: 'p76', r32b: 'p78' },
  { id: 'r16-4', matchNum: 92, date: '5 jul', time: '18:00', stadium: 'Azteca — Ciudad de México',  r32a: 'p79', r32b: 'p80' },
  { id: 'r16-5', matchNum: 93, date: '6 jul', time: '13:00', stadium: 'Dallas',                     r32a: 'p83', r32b: 'p84' },
  { id: 'r16-6', matchNum: 94, date: '6 jul', time: '18:00', stadium: 'Seattle',                    r32a: 'p81', r32b: 'p82' },
  { id: 'r16-7', matchNum: 95, date: '7 jul', time: '10:00', stadium: 'Atlanta',                    r32a: 'p86', r32b: 'p88' },
  { id: 'r16-8', matchNum: 96, date: '7 jul', time: '14:00', stadium: 'BC Place Vancouver',         r32a: 'p85', r32b: 'p87' },
];

export interface QFPair {
  id: string; matchNum: number; date: string; time: string; stadium: string;
  r16a: string; r16b: string;
}
export const QF_PAIRS: QFPair[] = [
  { id: 'qf-1', matchNum: 97,  date: '9 jul',  time: '14:00', stadium: 'Boston',      r16a: 'r16-1', r16b: 'r16-2' },
  { id: 'qf-2', matchNum: 98,  date: '10 jul', time: '13:00', stadium: 'Los Ángeles', r16a: 'r16-5', r16b: 'r16-6' },
  { id: 'qf-3', matchNum: 99,  date: '11 jul', time: '15:00', stadium: 'Miami',       r16a: 'r16-3', r16b: 'r16-4' },
  { id: 'qf-4', matchNum: 100, date: '11 jul', time: '19:00', stadium: 'Kansas City', r16a: 'r16-7', r16b: 'r16-8' },
];

export interface SFPair {
  id: string; matchNum: number; date: string; time: string; stadium: string;
  qfa: string; qfb: string;
}
export const SF_PAIRS: SFPair[] = [
  { id: 'sf-1', matchNum: 101, date: '14 jul', time: '13:00', stadium: 'Dallas',  qfa: 'qf-1', qfb: 'qf-2' },
  { id: 'sf-2', matchNum: 102, date: '15 jul', time: '13:00', stadium: 'Atlanta', qfa: 'qf-3', qfb: 'qf-4' },
];

export interface KnockoutInfo { matchNum: number; date: string; time: string; stadium: string; }
// Third-place match: losers of sf-1 and sf-2.
export const BRONZE_INFO: KnockoutInfo = { matchNum: 103, date: '18 jul', time: '15:00', stadium: 'Miami' };
// Final: winners of sf-1 and sf-2.
export const FINAL_INFO: KnockoutInfo = { matchNum: 104, date: '19 jul', time: '13:00', stadium: 'MetLife — Nueva York / Nueva Jersey' };

// ─── Match schedule ───────────────────────────────────────────────────────────
// The complete 104-match calendar is GENERATED from a single source of truth so it
// can never drift out of sync:
//   • Group stage (matches 1–72): every group's full round-robin, built from GROUPS
//     using FIFA's fixed fixture pattern (MD1 1v2 / 3v4 · MD2 1v3 / 4v2 · MD3 4v1 / 2v3).
//   • Knockout (matches 73–104): built from the official bracket above. Teams aren't
//     known yet, so each side carries a PLACEHOLDER label ("1° Gr. A", "Mejor 3°",
//     "Ganador P73"). As real group results are entered, R32 position slots auto-fill
//     with the actual teams; deeper rounds keep their placeholders until played.

export const ROUND_GROUP  = 'Fase de Grupos';
export const ROUND_R32    = 'Dieciseisavos de Final';
export const ROUND_R16    = 'Octavos de Final';
export const ROUND_QF     = 'Cuartos de Final';
export const ROUND_SF     = 'Semifinales';
export const ROUND_BRONZE = 'Tercer Lugar';
export const ROUND_FINAL  = 'Final';

// Display order of the phases (used to group the full match list in the UI).
export const PHASE_ORDER = [
  ROUND_GROUP, ROUND_R32, ROUND_R16, ROUND_QF, ROUND_SF, ROUND_BRONZE, ROUND_FINAL,
] as const;

// The 16 official host cities, cycled through for generated group-stage venues.
const HOST_CITIES = [
  'Ciudad de México', 'Guadalajara', 'Monterrey', 'Los Ángeles', 'San Francisco',
  'Seattle', 'Vancouver', 'Toronto', 'Kansas City', 'Dallas', 'Houston', 'Atlanta',
  'Miami', 'Filadelfia', 'Boston', 'Nueva York',
];

// Matchday date blocks — 3 groups share a day (A,B,C · D,E,F · G,H,I · J,K,L).
const MD_DATES: Record<number, string[]> = {
  1: ['11 jun', '12 jun', '13 jun', '14 jun'],
  2: ['18 jun', '19 jun', '20 jun', '21 jun'],
  3: ['24 jun', '25 jun', '26 jun', '27 jun'],
};
const KICKOFFS = [['11:00', '19:00'], ['14:00', '21:00'], ['16:00', '18:00']]; // [daySlot][submatch]

// Verbatim dates/times/venues for the 8 originally-listed opening matches, keyed by
// `${group}${matchday}${submatch}`. Pairings already match the generated round-robin.
const GROUP_OVERRIDES: Record<string, { date: string; time: string; city: string }> = {
  A10: { date: '11 jun', time: '17:00', city: 'Los Ángeles' },
  B10: { date: '11 jun', time: '14:00', city: 'Ciudad de México' },
  C10: { date: '11 jun', time: '20:00', city: 'Toronto' },
  D10: { date: '12 jun', time: '15:00', city: 'Dallas' },
  E10: { date: '12 jun', time: '12:00', city: 'Nueva York' },
  F10: { date: '12 jun', time: '18:00', city: 'Miami' },
  G10: { date: '13 jun', time: '14:00', city: 'San Francisco' },
  H10: { date: '13 jun', time: '17:00', city: 'Atlanta' },
};

// FIFA's fixed round-robin: returns [homeId, awayId] for a group, matchday (1–3) and
// submatch (0 or 1). Teams are positions 1–4 = group.teams[0..3].
function roundRobinPairing(teams: Team[], md: number, sub: number): [string, string] {
  const [a, b, c, d] = teams.map(t => t.id);
  if (md === 1) return sub === 0 ? [a, b] : [c, d];
  if (md === 2) return sub === 0 ? [a, c] : [d, b];
  return sub === 0 ? [d, a] : [b, c]; // md 3
}

// Build all 72 group-stage matches (always have concrete teams).
export function buildGroupStageMatches(): Match[] {
  const out: Match[] = [];
  GROUPS.forEach((g, gi) => {
    const dayBlock = Math.floor(gi / 3);
    const daySlot = gi % 3;
    for (let md = 1; md <= 3; md++) {
      for (let sub = 0; sub <= 1; sub++) {
        const [homeTeamId, awayTeamId] = roundRobinPairing(g.teams, md, sub);
        const matchNum = (md - 1) * 24 + gi * 2 + sub + 1;
        const ov = GROUP_OVERRIDES[`${g.id}${md}${sub}`];
        out.push({
          id: `g${matchNum}`,
          matchNum,
          date: ov?.date ?? MD_DATES[md][dayBlock],
          time: ov?.time ?? KICKOFFS[daySlot][sub],
          homeTeamId,
          awayTeamId,
          status: 'upcoming',
          group: g.id,
          round: ROUND_GROUP,
          city: ov?.city ?? HOST_CITIES[(matchNum - 1) % HOST_CITIES.length],
        });
      }
    }
  });
  return out.sort((a, b) => (a.matchNum! - b.matchNum!));
}

// id → official match number, across every knockout round.
const KO_MATCH_NUM: Record<string, number> = {};
OFFICIAL_R32.forEach(m => { KO_MATCH_NUM[m.id] = m.matchNum; });
R16_PAIRS.forEach(p => { KO_MATCH_NUM[p.id] = p.matchNum; });
QF_PAIRS.forEach(p => { KO_MATCH_NUM[p.id] = p.matchNum; });
SF_PAIRS.forEach(p => { KO_MATCH_NUM[p.id] = p.matchNum; });

// Human placeholder for an R32 slot, e.g. "1° Gr. A" or "Mejor 3° (A/B/C/D/F)".
function slotLabel(slot: TeamSlot): string {
  return slot.type === 'pos'
    ? `${slot.pos}° Gr. ${slot.group}`
    : `Mejor 3° (${slot.eligibleGroups.join('/')})`;
}

// Resolve the actual team in an R32 slot from the entered group results, when known.
// Only position slots (1°/2°) are determinable from Results; best-3rd slots stay open
// because Results doesn't record which thirds advanced.
function slotTeam(slot: TeamSlot, results?: Results): string {
  if (slot.type !== 'pos' || !results) return '';
  const gr = results.groups[slot.group];
  if (!gr) return '';
  return (slot.pos === 1 ? gr.first : gr.second) ?? '';
}

// Build all knockout matches (73–104) with placeholders, auto-filling R32 teams from
// group results when available.
export function buildKnockoutMatches(results?: Results): Match[] {
  const out: Match[] = [];

  OFFICIAL_R32.forEach(m => {
    out.push({
      id: m.id, matchNum: m.matchNum, date: m.date, time: m.time,
      homeTeamId: slotTeam(m.home, results), awayTeamId: slotTeam(m.away, results),
      homeLabel: slotLabel(m.home), awayLabel: slotLabel(m.away),
      status: 'upcoming', round: ROUND_R32, city: m.stadium,
    });
  });

  R16_PAIRS.forEach(p => out.push({
    id: p.id, matchNum: p.matchNum, date: p.date, time: p.time,
    homeTeamId: '', awayTeamId: '',
    homeLabel: `Ganador P${KO_MATCH_NUM[p.r32a]}`, awayLabel: `Ganador P${KO_MATCH_NUM[p.r32b]}`,
    status: 'upcoming', round: ROUND_R16, city: p.stadium,
  }));

  QF_PAIRS.forEach(p => out.push({
    id: p.id, matchNum: p.matchNum, date: p.date, time: p.time,
    homeTeamId: '', awayTeamId: '',
    homeLabel: `Ganador P${KO_MATCH_NUM[p.r16a]}`, awayLabel: `Ganador P${KO_MATCH_NUM[p.r16b]}`,
    status: 'upcoming', round: ROUND_QF, city: p.stadium,
  }));

  SF_PAIRS.forEach(p => out.push({
    id: p.id, matchNum: p.matchNum, date: p.date, time: p.time,
    homeTeamId: '', awayTeamId: '',
    homeLabel: `Ganador P${KO_MATCH_NUM[p.qfa]}`, awayLabel: `Ganador P${KO_MATCH_NUM[p.qfb]}`,
    status: 'upcoming', round: ROUND_SF, city: p.stadium,
  }));

  out.push({
    id: 'bronze', matchNum: BRONZE_INFO.matchNum, date: BRONZE_INFO.date, time: BRONZE_INFO.time,
    homeTeamId: '', awayTeamId: '',
    homeLabel: `Perdedor P${SF_PAIRS[0].matchNum}`, awayLabel: `Perdedor P${SF_PAIRS[1].matchNum}`,
    status: 'upcoming', round: ROUND_BRONZE, city: BRONZE_INFO.stadium,
  });

  out.push({
    id: 'final', matchNum: FINAL_INFO.matchNum, date: FINAL_INFO.date, time: FINAL_INFO.time,
    homeTeamId: '', awayTeamId: '',
    homeLabel: `Ganador P${SF_PAIRS[0].matchNum}`, awayLabel: `Ganador P${SF_PAIRS[1].matchNum}`,
    status: 'upcoming', round: ROUND_FINAL, city: FINAL_INFO.stadium,
  });

  return out;
}

// The complete tournament calendar (group stage + knockout), ordered by match number.
// Pass live results to auto-fill R32 teams as group placements get entered.
export function buildSchedule(results?: Results): Match[] {
  return [...buildGroupStageMatches(), ...buildKnockoutMatches(results)];
}

// Static, results-agnostic snapshots for convenience.
export const GROUP_STAGE_MATCHES: Match[] = buildGroupStageMatches();
export const FULL_SCHEDULE: Match[] = buildSchedule();

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  { id: 'MEXICO01', name: 'Carlos H.' },
  { id: 'AGUILA22', name: 'Miguel T.' },
  { id: 'PULQUE33', name: 'Laura J.'  },
  { id: 'AZTECA44', name: 'Roberto G.'},
  { id: 'CHIVAS55', name: 'Ana M.'    },
  { id: 'PUMAS66',  name: 'Diego R.'  },
  { id: 'TIGRES77', name: 'Sofía L.'  },
  { id: 'ATLAS88',  name: 'Eduardo V.'},
];

export const MOCK_LEADERBOARD = [
  { rank: 1, userId: 'MEXICO01', name: 'Carlos H.',  predictions: 2, points: 0 },
  { rank: 2, userId: 'AGUILA22', name: 'Miguel T.',  predictions: 1, points: 0 },
  { rank: 3, userId: 'PULQUE33', name: 'Laura J.',   predictions: 3, points: 0 },
  { rank: 4, userId: 'AZTECA44', name: 'Roberto G.', predictions: 1, points: 0 },
  { rank: 5, userId: 'CHIVAS55', name: 'Ana M.',     predictions: 2, points: 0 },
  { rank: 6, userId: 'PUMAS66',  name: 'Diego R.',   predictions: 1, points: 0 },
  { rank: 7, userId: 'TIGRES77', name: 'Sofía L.',   predictions: 1, points: 0 },
  { rank: 8, userId: 'ATLAS88',  name: 'Eduardo V.', predictions: 2, points: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getTeam(id: string): Team {
  return TEAMS[id] ?? { id, name: '?', shortName: '?', flag: '❓', confederation: '' };
}

export function getGroupById(id: string): Group | undefined {
  return GROUPS.find(g => g.id === id);
}

// Human-friendly entry folio used as the Firestore doc id. Short, uppercase, and
// drawn from an alphabet with no look-alike characters (no 0/O, 1/I/L) so it is
// easy to read aloud, type into the payment form by hand, and reconcile by the
// admin. Prefixed by competition: QM = main quiniela, R32 / R16 = side-leagues.
const FOLIO_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const FOLIO_PREFIX: Record<League, string> = { main: 'QM', r32: 'R32', r16: 'R16' };

export function makeFolio(league: League): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += FOLIO_ALPHABET[Math.floor(Math.random() * FOLIO_ALPHABET.length)];
  }
  return `${FOLIO_PREFIX[league]}-${code}`;
}

// Folio for a Rifa de Países ticket (RIFA-XXXXX). Same readable alphabet as the
// quiniela folios; this is the Firestore doc id and the value the payment form
// receives pre-filled.
export function makeTicketFolio(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += FOLIO_ALPHABET[Math.floor(Math.random() * FOLIO_ALPHABET.length)];
  }
  return `RIFA-${code}`;
}

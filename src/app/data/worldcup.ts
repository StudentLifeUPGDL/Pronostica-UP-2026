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
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
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

// Which competition an entry belongs to. 'main' = original locked picks;
// 'r32' / 'r16' = paid post-kickoff fix snapshots (their own leagues + prize pools).
export type League = 'main' | 'r32' | 'r16';

// Per-entry payment lifecycle, managed manually by the admin.
export type PaymentStatus = 'pending' | 'paid' | 'void';

export interface Prediction {
  id: string;
  uid: string;                        // Firebase Auth uid of the owner (== quiniela ID)
  userEmail?: string;
  userDisplayName?: string;
  name: string;
  league: League;
  parentId?: string;                  // for r32/r16 fixes: the MAIN entry they derive from
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
  points: number;                     // optional cache; standings are computed live from Results
}

// ─── Real tournament results (admin-entered, drives scoring) ──────────────────

export interface GroupResult {
  first: string;   // team id that actually finished 1st
  second: string;  // 2nd
  third: string;   // 3rd
}

export interface Results {
  groups: Record<string, GroupResult>; // actual exact placements per group A–L
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
  groups: {}, r32Winners: [], r16Winners: [], qfWinners: [], sfWinners: [],
  champion: '', runnerUp: '', thirdPlace: '',
};

// ─── App configuration (admin-editable, lives in config/app) ──────────────────

export interface AppFees { main: number; r32: number; r16: number; }

export interface AppConfig {
  lockDate: string;          // ISO — MAIN entries lock (kickoff)
  paymentDeadline: string;   // ISO — pending MAIN entries auto-void after this
  r32StartDate: string;      // ISO — R32 fix freezes / R32 league locks
  r16StartDate: string;      // ISO — R16 fix freezes / R16 league locks
  season: string;
  adminEmails: string[];     // UI fallback only; rules trust the custom claim
  maxPendingPerUser: number;
  currency: string;
  fees: AppFees;
  payoutPercent: number;     // share of the gross pool that is paid out (e.g. 0.90)
  payoutRoundTo: number;     // distributable prize rounded DOWN to this (e.g. 100)
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
  fees: { main: 100, r32: 50, r16: 50 },
  payoutPercent: 0.9,
  payoutRoundTo: 100,
};

// ─── Teams ────────────────────────────────────────────────────────────────────

export const TEAMS: Record<string, Team> = {
  usa: { id: 'usa', name: 'Estados Unidos', shortName: 'EUA', flag: '🇺🇸', confederation: 'CONCACAF' },
  pan: { id: 'pan', name: 'Panamá',         shortName: 'PAN', flag: '🇵🇦', confederation: 'CONCACAF' },
  mar: { id: 'mar', name: 'Marruecos',      shortName: 'MAR', flag: '🇲🇦', confederation: 'CAF'      },
  jpn: { id: 'jpn', name: 'Japón',          shortName: 'JPN', flag: '🇯🇵', confederation: 'AFC'      },
  mex: { id: 'mex', name: 'México',         shortName: 'MEX', flag: '🇲🇽', confederation: 'CONCACAF' },
  hon: { id: 'hon', name: 'Honduras',       shortName: 'HON', flag: '🇭🇳', confederation: 'CONCACAF' },
  cmr: { id: 'cmr', name: 'Camerún',        shortName: 'CMR', flag: '🇨🇲', confederation: 'CAF'      },
  kor: { id: 'kor', name: 'Corea del Sur',  shortName: 'KOR', flag: '🇰🇷', confederation: 'AFC'      },
  can: { id: 'can', name: 'Canadá',         shortName: 'CAN', flag: '🇨🇦', confederation: 'CONCACAF' },
  jam: { id: 'jam', name: 'Jamaica',        shortName: 'JAM', flag: '🇯🇲', confederation: 'CONCACAF' },
  tun: { id: 'tun', name: 'Túnez',          shortName: 'TUN', flag: '🇹🇳', confederation: 'CAF'      },
  jor: { id: 'jor', name: 'Jordania',       shortName: 'JOR', flag: '🇯🇴', confederation: 'AFC'      },
  bra: { id: 'bra', name: 'Brasil',         shortName: 'BRA', flag: '🇧🇷', confederation: 'CONMEBOL' },
  chi: { id: 'chi', name: 'Chile',          shortName: 'CHI', flag: '🇨🇱', confederation: 'CONMEBOL' },
  egy: { id: 'egy', name: 'Egipto',         shortName: 'EGY', flag: '🇪🇬', confederation: 'CAF'      },
  uzb: { id: 'uzb', name: 'Uzbekistán',     shortName: 'UZB', flag: '🇺🇿', confederation: 'AFC'      },
  arg: { id: 'arg', name: 'Argentina',      shortName: 'ARG', flag: '🇦🇷', confederation: 'CONMEBOL' },
  ecu: { id: 'ecu', name: 'Ecuador',        shortName: 'ECU', flag: '🇪🇨', confederation: 'CONMEBOL' },
  nga: { id: 'nga', name: 'Nigeria',        shortName: 'NGA', flag: '🇳🇬', confederation: 'CAF'      },
  aus: { id: 'aus', name: 'Australia',      shortName: 'AUS', flag: '🇦🇺', confederation: 'AFC'      },
  esp: { id: 'esp', name: 'España',         shortName: 'ESP', flag: '🇪🇸', confederation: 'UEFA'     },
  crc: { id: 'crc', name: 'Costa Rica',     shortName: 'CRC', flag: '🇨🇷', confederation: 'CONCACAF' },
  sen: { id: 'sen', name: 'Senegal',        shortName: 'SEN', flag: '🇸🇳', confederation: 'CAF'      },
  qat: { id: 'qat', name: 'Qatar',          shortName: 'QAT', flag: '🇶🇦', confederation: 'AFC'      },
  fra: { id: 'fra', name: 'Francia',        shortName: 'FRA', flag: '🇫🇷', confederation: 'UEFA'     },
  por: { id: 'por', name: 'Portugal',       shortName: 'POR', flag: '🇵🇹', confederation: 'UEFA'     },
  gha: { id: 'gha', name: 'Ghana',          shortName: 'GHA', flag: '🇬🇭', confederation: 'CAF'      },
  nzl: { id: 'nzl', name: 'Nueva Zelanda',  shortName: 'NZL', flag: '🇳🇿', confederation: 'OFC'      },
  ger: { id: 'ger', name: 'Alemania',       shortName: 'GER', flag: '🇩🇪', confederation: 'UEFA'     },
  bel: { id: 'bel', name: 'Bélgica',        shortName: 'BEL', flag: '🇧🇪', confederation: 'UEFA'     },
  rsa: { id: 'rsa', name: 'Sudáfrica',      shortName: 'RSA', flag: '🇿🇦', confederation: 'CAF'      },
  irn: { id: 'irn', name: 'Irán',           shortName: 'IRN', flag: '🇮🇷', confederation: 'AFC'      },
  ita: { id: 'ita', name: 'Italia',         shortName: 'ITA', flag: '🇮🇹', confederation: 'UEFA'     },
  ned: { id: 'ned', name: 'Países Bajos',   shortName: 'NED', flag: '🇳🇱', confederation: 'UEFA'     },
  civ: { id: 'civ', name: 'Costa de Marfil',shortName: 'CIV', flag: '🇨🇮', confederation: 'CAF'      },
  kaz: { id: 'kaz', name: 'Kazajistán',     shortName: 'KAZ', flag: '🇰🇿', confederation: 'AFC'      },
  cro: { id: 'cro', name: 'Croacia',        shortName: 'CRO', flag: '🇭🇷', confederation: 'UEFA'     },
  sui: { id: 'sui', name: 'Suiza',          shortName: 'SUI', flag: '🇨🇭', confederation: 'UEFA'     },
  col: { id: 'col', name: 'Colombia',       shortName: 'COL', flag: '🇨🇴', confederation: 'CONMEBOL' },
  ven: { id: 'ven', name: 'Venezuela',      shortName: 'VEN', flag: '🇻🇪', confederation: 'CONMEBOL' },
  aut: { id: 'aut', name: 'Austria',        shortName: 'AUT', flag: '🇦🇹', confederation: 'UEFA'     },
  pol: { id: 'pol', name: 'Polonia',        shortName: 'POL', flag: '🇵🇱', confederation: 'UEFA'     },
  uru: { id: 'uru', name: 'Uruguay',        shortName: 'URU', flag: '🇺🇾', confederation: 'CONMEBOL' },
  ksa: { id: 'ksa', name: 'Arabia Saudita', shortName: 'KSA', flag: '🇸🇦', confederation: 'AFC'      },
  tur: { id: 'tur', name: 'Turquía',        shortName: 'TUR', flag: '🇹🇷', confederation: 'UEFA'     },
  srb: { id: 'srb', name: 'Serbia',         shortName: 'SRB', flag: '🇷🇸', confederation: 'UEFA'     },
  den: { id: 'den', name: 'Dinamarca',      shortName: 'DEN', flag: '🇩🇰', confederation: 'UEFA'     },
  sco: { id: 'sco', name: 'Escocia',        shortName: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA'     },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const GROUPS: Group[] = [
  { id: 'A', name: 'Grupo A', teams: [TEAMS.usa, TEAMS.pan, TEAMS.mar, TEAMS.jpn] },
  { id: 'B', name: 'Grupo B', teams: [TEAMS.mex, TEAMS.hon, TEAMS.cmr, TEAMS.kor] },
  { id: 'C', name: 'Grupo C', teams: [TEAMS.can, TEAMS.jam, TEAMS.tun, TEAMS.jor] },
  { id: 'D', name: 'Grupo D', teams: [TEAMS.bra, TEAMS.chi, TEAMS.egy, TEAMS.uzb] },
  { id: 'E', name: 'Grupo E', teams: [TEAMS.arg, TEAMS.ecu, TEAMS.nga, TEAMS.aus] },
  { id: 'F', name: 'Grupo F', teams: [TEAMS.esp, TEAMS.crc, TEAMS.sen, TEAMS.qat] },
  { id: 'G', name: 'Grupo G', teams: [TEAMS.fra, TEAMS.por, TEAMS.gha, TEAMS.nzl] },
  { id: 'H', name: 'Grupo H', teams: [TEAMS.ger, TEAMS.bel, TEAMS.rsa, TEAMS.irn] },
  { id: 'I', name: 'Grupo I', teams: [TEAMS.ita, TEAMS.ned, TEAMS.civ, TEAMS.kaz] },
  { id: 'J', name: 'Grupo J', teams: [TEAMS.cro, TEAMS.sui, TEAMS.col, TEAMS.ven] },
  { id: 'K', name: 'Grupo K', teams: [TEAMS.aut, TEAMS.pol, TEAMS.uru, TEAMS.ksa] },
  { id: 'L', name: 'Grupo L', teams: [TEAMS.tur, TEAMS.srb, TEAMS.den, TEAMS.sco] },
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

export const UPCOMING_MATCHES: Match[] = [
  { id: 'm1', date: '11 jun', time: '14:00', homeTeamId: 'mex', awayTeamId: 'hon', status: 'upcoming', group: 'B', city: 'Ciudad de México', round: 'Fase de Grupos' },
  { id: 'm2', date: '11 jun', time: '17:00', homeTeamId: 'usa', awayTeamId: 'pan', status: 'upcoming', group: 'A', city: 'Los Ángeles',      round: 'Fase de Grupos' },
  { id: 'm3', date: '11 jun', time: '20:00', homeTeamId: 'can', awayTeamId: 'jam', status: 'upcoming', group: 'C', city: 'Toronto',           round: 'Fase de Grupos' },
  { id: 'm4', date: '12 jun', time: '12:00', homeTeamId: 'arg', awayTeamId: 'ecu', status: 'upcoming', group: 'E', city: 'Nueva York',        round: 'Fase de Grupos' },
  { id: 'm5', date: '12 jun', time: '15:00', homeTeamId: 'bra', awayTeamId: 'chi', status: 'upcoming', group: 'D', city: 'Dallas',            round: 'Fase de Grupos' },
  { id: 'm6', date: '12 jun', time: '18:00', homeTeamId: 'esp', awayTeamId: 'crc', status: 'upcoming', group: 'F', city: 'Miami',             round: 'Fase de Grupos' },
  { id: 'm7', date: '13 jun', time: '14:00', homeTeamId: 'fra', awayTeamId: 'por', status: 'upcoming', group: 'G', city: 'San Francisco',     round: 'Fase de Grupos' },
  { id: 'm8', date: '13 jun', time: '17:00', homeTeamId: 'ger', awayTeamId: 'bel', status: 'upcoming', group: 'H', city: 'Atlanta',           round: 'Fase de Grupos' },
];

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

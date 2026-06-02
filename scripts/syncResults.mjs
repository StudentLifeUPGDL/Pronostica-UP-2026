// Auto-sync the official tournament results from football-data.org into Firestore.
// NOT part of the app bundle — run on a schedule (GitHub Actions) or by hand.
//
// What it writes: the single `results/official` document, shape `Results`
// (see src/app/data/worldcup.ts). Scoring (src/lib/scoring.ts) recomputes live
// from that doc, so this is the ONLY thing that needs to stay up to date — we do
// NOT store per-match scorelines anywhere.
//
//   • group stage → exact 1st/2nd/3rd per group (from the standings endpoint)
//   • knockouts   → the set of teams that advanced each round (winners of the
//                   finished matches in that stage)
//   • champion / runnerUp (final) and thirdPlace (third-place match)
//
// Usage:
//   node scripts/syncResults.mjs --dry-run     # fetch + print, write nothing (default)
//   node scripts/syncResults.mjs --write       # actually update Firestore
//   node scripts/syncResults.mjs --write --force   # ignore the tournament-window guard
//
// Env:
//   FOOTBALL_DATA_API_KEY   required — free key from https://www.football-data.org/client/register
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON as a string (used by the GH Action).
//                             If absent, falls back to scripts/serviceAccount.json (local runs).
//
// Only needed for --write. A --dry-run needs just FOOTBALL_DATA_API_KEY.

import { readFileSync } from 'node:fs';

// ─── config ───────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';            // football-data.org code for the FIFA World Cup
const RESULTS_DOC = ['results', 'official'];

// Cheap guard so the every-15-min cron does nothing (and burns no API calls)
// outside the tournament. Bypass with --force. Edit if dates shift.
const WINDOW_START = '2026-06-10T00:00:00Z';
const WINDOW_END   = '2026-07-21T00:00:00Z';

// football-data.org `stage` value → our internal round key. We accept a few
// spellings because the 48-team format's Round of 32 is new and the exact label
// isn't guaranteed; unknown stages are logged, never silently dropped.
const STAGE_TO_ROUND = {
  GROUP_STAGE: 'group',
  LAST_32: 'r32', ROUND_OF_32: 'r32',
  LAST_16: 'r16', ROUND_OF_16: 'r16',
  QUARTER_FINALS: 'qf', QUARTER_FINAL: 'qf',
  SEMI_FINALS: 'sf', SEMI_FINAL: 'sf',
  THIRD_PLACE: 'third', PLAYOFF_FOR_THIRD_PLACE: 'third', '3RD_PLACE': 'third',
  FINAL: 'final',
};

// ─── team mapping: football-data.org team → our team id ─────────────────────────
// Our team ids (src/app/data/worldcup.ts) are lowercase FIFA codes, so the team's
// `tla` is the primary key; `name`/aliases are the fallback. Keep this in sync if
// you change the teams in worldcup.ts. Format: [appId, displayName, tla, ...aliases]
const TEAM_TABLE = [
  // Grupo A
  ['mex', 'Mexico', 'MEX'],
  ['rsa', 'South Africa', 'RSA', 'South-Africa'],
  ['kor', 'South Korea', 'KOR', 'Korea Republic', 'Republic of Korea'],
  ['cze', 'Czech Republic', 'CZE', 'Czechia'],
  // Grupo B
  ['can', 'Canada', 'CAN'],
  ['bih', 'Bosnia and Herzegovina', 'BIH', 'Bosnia-Herzegovina', 'Bosnia'],
  ['qat', 'Qatar', 'QAT'],
  ['sui', 'Switzerland', 'SUI'],
  // Grupo C
  ['bra', 'Brazil', 'BRA'],
  ['mar', 'Morocco', 'MAR'],
  ['hai', 'Haiti', 'HAI'],
  ['sco', 'Scotland', 'SCO'],
  // Grupo D
  ['usa', 'United States', 'USA', 'United States of America'],
  ['par', 'Paraguay', 'PAR'],
  ['aus', 'Australia', 'AUS'],
  ['tur', 'Turkey', 'TUR', 'Türkiye', 'Turkiye'],
  // Grupo E
  ['ger', 'Germany', 'GER'],
  ['cuw', 'Curacao', 'CUW', 'Curaçao'],
  ['civ', 'Ivory Coast', 'CIV', "Cote d'Ivoire", 'Côte d’Ivoire'],
  ['ecu', 'Ecuador', 'ECU'],
  // Grupo F
  ['ned', 'Netherlands', 'NED', 'Holland'],
  ['jpn', 'Japan', 'JPN'],
  ['swe', 'Sweden', 'SWE'],
  ['tun', 'Tunisia', 'TUN'],
  // Grupo G
  ['bel', 'Belgium', 'BEL'],
  ['egy', 'Egypt', 'EGY'],
  ['irn', 'Iran', 'IRN', 'IR Iran', 'Islamic Republic of Iran'],
  ['nzl', 'New Zealand', 'NZL'],
  // Grupo H
  ['esp', 'Spain', 'ESP'],
  ['cpv', 'Cape Verde', 'CPV', 'Cabo Verde'],
  ['ksa', 'Saudi Arabia', 'KSA', 'Saudi-Arabia'],
  ['uru', 'Uruguay', 'URU'],
  // Grupo I
  ['fra', 'France', 'FRA'],
  ['sen', 'Senegal', 'SEN'],
  ['irq', 'Iraq', 'IRQ'],
  ['nor', 'Norway', 'NOR'],
  // Grupo J
  ['arg', 'Argentina', 'ARG'],
  ['alg', 'Algeria', 'ALG', 'DZA'],
  ['aut', 'Austria', 'AUT'],
  ['jor', 'Jordan', 'JOR'],
  // Grupo K
  ['por', 'Portugal', 'POR'],
  ['cod', 'DR Congo', 'COD', 'Congo DR', 'Democratic Republic of the Congo', 'Congo-Kinshasa'],
  ['uzb', 'Uzbekistan', 'UZB'],
  ['col', 'Colombia', 'COL'],
  // Grupo L
  ['eng', 'England', 'ENG'],
  ['cro', 'Croatia', 'CRO'],
  ['gha', 'Ghana', 'GHA'],
  ['pan', 'Panama', 'PAN'],
];

// NFD + stripping non-alphanumerics drops accents and punctuation (é→e, ü→u, ’ etc.).
const normalize = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

const DISPLAY = {};                                   // appId → display name
const byTla = {};                                     // TLA (upper) → appId
const byName = {};                                    // normalized name/alias → appId
for (const [id, name, tla, ...aliases] of TEAM_TABLE) {
  DISPLAY[id] = name;
  if (tla) byTla[tla.toUpperCase()] = id;
  for (const n of [name, ...aliases]) byName[normalize(n)] = id;
}

const unmapped = new Set();
function resolveTeam(team) {
  if (!team) return null;
  if (team.tla && byTla[String(team.tla).toUpperCase()]) return byTla[String(team.tla).toUpperCase()];
  for (const key of [team.name, team.shortName]) {
    const hit = byName[normalize(key)];
    if (hit) return hit;
  }
  // last resort: a 3-letter tla that already matches one of our ids
  if (team.tla && DISPLAY[String(team.tla).toLowerCase()]) return String(team.tla).toLowerCase();
  unmapped.add(`${team.name ?? '?'} (tla=${team.tla ?? '—'}, id=${team.id ?? '—'})`);
  return null;
}

// ─── football-data.org client ──────────────────────────────────────────────────

async function apiGet(path) {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error('Missing FOOTBALL_DATA_API_KEY env var.');
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'X-Auth-Token': key } });
  if (res.status === 403) {
    throw new Error(
      `403 from football-data.org for ${path}. The World Cup may not be in your plan's free tier. ` +
      `Verify coverage, or switch the data source to the openfootball fallback (see scripts/SYNC-RESULTS.md).`,
    );
  }
  if (res.status === 429) throw new Error('429 rate-limited by football-data.org — lower the cron frequency.');
  if (!res.ok) throw new Error(`football-data.org ${path} → HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── derive our Results shape from the API payloads ─────────────────────────────

function groupLetterFromStandings(entry) {
  // v4 gives e.g. group: "GROUP_A"; be lenient about spelling.
  const raw = String(entry.group ?? '').toUpperCase();
  const m = raw.match(/([A-L])\b/) || raw.match(/_([A-L])$/) || raw.match(/([A-L])$/);
  return m ? m[1] : null;
}

function winnerOf(match) {
  const w = match.score?.winner;
  if (w === 'HOME_TEAM') return match.homeTeam;
  if (w === 'AWAY_TEAM') return match.awayTeam;
  return null; // DRAW / null — a finished knockout shouldn't land here
}
function loserOf(match) {
  const w = match.score?.winner;
  if (w === 'HOME_TEAM') return match.awayTeam;
  if (w === 'AWAY_TEAM') return match.homeTeam;
  return null;
}

// Returns a *partial* Results object: only the parts we can confidently derive
// right now are included, so a merge-write never clobbers fields not yet decided.
function buildResults(standings, matches) {
  const out = {};

  // Group placements (exact 1/2/3) from the standings tables.
  const groups = {};
  for (const s of standings.standings ?? []) {
    if (s.type && s.type !== 'TOTAL') continue;
    const letter = groupLetterFromStandings(s);
    if (!letter) continue;
    const rows = [...(s.table ?? [])].sort((a, b) => a.position - b.position);
    const [a, b, c] = rows;
    const first = a && resolveTeam(a.team);
    const second = b && resolveTeam(b.team);
    const third = c && resolveTeam(c.team);
    // Only record a group once all three places resolve (avoids half-written groups
    // mid-stage; scoring needs exact positions anyway).
    if (first && second && third) groups[letter] = { first, second, third };
  }
  if (Object.keys(groups).length) out.groups = groups;

  // Knockout winners per round, from FINISHED matches only.
  const finished = (matches.matches ?? []).filter((m) => m.status === 'FINISHED');
  const winnersByRound = { r32: new Set(), r16: new Set(), qf: new Set(), sf: new Set() };
  let finalMatch = null, thirdMatch = null;
  const unknownStages = new Set();

  for (const m of finished) {
    const round = STAGE_TO_ROUND[m.stage];
    if (!round) { if (m.stage && m.stage !== 'GROUP_STAGE') unknownStages.add(m.stage); continue; }
    if (round === 'final') { finalMatch = m; continue; }
    if (round === 'third') { thirdMatch = m; continue; }
    if (round === 'group') continue;
    const w = resolveTeam(winnerOf(m));
    if (w) winnersByRound[round].add(w);
  }
  if (unknownStages.size) console.warn('⚠️  Unrecognised stage labels (update STAGE_TO_ROUND):', [...unknownStages]);

  if (winnersByRound.r32.size) out.r32Winners = [...winnersByRound.r32];
  if (winnersByRound.r16.size) out.r16Winners = [...winnersByRound.r16];
  if (winnersByRound.qf.size)  out.qfWinners  = [...winnersByRound.qf];
  if (winnersByRound.sf.size)  out.sfWinners  = [...winnersByRound.sf];

  if (finalMatch) {
    const champ = resolveTeam(winnerOf(finalMatch));
    const runner = resolveTeam(loserOf(finalMatch));
    if (champ) out.champion = champ;
    if (runner) out.runnerUp = runner;
  }
  if (thirdMatch) {
    const third = resolveTeam(winnerOf(thirdMatch));
    if (third) out.thirdPlace = third;
  }

  return out;
}

// ─── pretty-print for --dry-run ─────────────────────────────────────────────────

function summarize(r) {
  const names = (ids) => (ids ?? []).map((id) => DISPLAY[id] ?? id).join(', ') || '—';
  const lines = ['', '── Derived results ──────────────────────────────'];
  if (r.groups) {
    for (const g of Object.keys(r.groups).sort()) {
      const { first, second, third } = r.groups[g];
      lines.push(`  Group ${g}: 1° ${DISPLAY[first] ?? first}  ·  2° ${DISPLAY[second] ?? second}  ·  3° ${DISPLAY[third] ?? third}`);
    }
  } else lines.push('  (no completed groups yet)');
  lines.push(`  R32 advanced (${r.r32Winners?.length ?? 0}/16): ${names(r.r32Winners)}`);
  lines.push(`  R16 advanced (${r.r16Winners?.length ?? 0}/8):  ${names(r.r16Winners)}`);
  lines.push(`  QF  advanced (${r.qfWinners?.length ?? 0}/4):  ${names(r.qfWinners)}`);
  lines.push(`  SF  advanced (${r.sfWinners?.length ?? 0}/2):  ${names(r.sfWinners)}`);
  lines.push(`  🏆 ${DISPLAY[r.champion] ?? r.champion ?? '—'}   🥈 ${DISPLAY[r.runnerUp] ?? r.runnerUp ?? '—'}   🥉 ${DISPLAY[r.thirdPlace] ?? r.thirdPlace ?? '—'}`);
  lines.push('─────────────────────────────────────────────────');
  return lines.join('\n');
}

// ─── firestore write (lazy-loads firebase-admin only when needed) ───────────────

async function writeResults(partial) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount;
  try {
    serviceAccount = saJson
      ? JSON.parse(saJson)
      : JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url), 'utf8'));
  } catch {
    throw new Error('No service account: set FIREBASE_SERVICE_ACCOUNT or provide scripts/serviceAccount.json.');
  }

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // merge:true leaves untouched any field we didn't derive (e.g. a stage not yet
  // played, or a value the admin set manually). Arrays are replaced wholesale,
  // which is what we want — each run recomputes the full set per round.
  await db.collection(RESULTS_DOC[0]).doc(RESULTS_DOC[1])
    .set({ ...partial, updatedAt: new Date().toISOString() }, { merge: true });
}

// ─── main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has('--write');
  const force = args.has('--force');

  const now = Date.now();
  if (!force && (now < Date.parse(WINDOW_START) || now > Date.parse(WINDOW_END))) {
    console.log('Outside the tournament window — nothing to do (use --force to override).');
    return;
  }

  console.log(`Fetching ${COMPETITION} standings + matches from football-data.org…`);
  const [standings, matches] = await Promise.all([
    apiGet(`/competitions/${COMPETITION}/standings`),
    apiGet(`/competitions/${COMPETITION}/matches`),
  ]);

  const results = buildResults(standings, matches);
  console.log(summarize(results));

  if (unmapped.size) {
    console.warn(
      `\n⚠️  ${unmapped.size} team(s) from the API could not be matched to a team id in worldcup.ts:\n` +
      [...unmapped].map((u) => `     - ${u}`).join('\n') +
      `\n   These are skipped. If the real 2026 draw differs from the hard-coded teams,\n` +
      `   update TEAM_TABLE here AND the groups/teams in src/app/data/worldcup.ts.`,
    );
  }

  if (!write) {
    console.log('\n(dry run — nothing written. Re-run with --write to update Firestore.)');
    return;
  }
  if (!Object.keys(results).length) {
    console.log('\nNothing derivable yet — skipping the write.');
    return;
  }
  await writeResults(results);
  console.log('\n✅ results/official updated. Scores will recompute live.');
}

main().catch((e) => { console.error('\n❌', e.message ?? e); process.exit(1); });

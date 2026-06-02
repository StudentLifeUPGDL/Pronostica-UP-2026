import type { Prediction, Results, League } from '../app/data/worldcup';

// ─── Point values (from the rules table in ExplanationsPage) ──────────────────
// Group points require the EXACT finishing position. Knockout points use a
// "team correctly advanced" model: for each round, a team the user picked to win
// that round scores if it actually advanced at that round (pairing-agnostic).
export const POINTS = {
  groupExact: 2, // per exact group position (1°, 2°, 3°)
  r32: 3,
  r16: 5,
  qf: 8,
  sf: 13,
  champion: 25,
  runnerUp: 10,
  thirdPlace: 7,
} as const;

export interface ScoreBreakdown {
  groups: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  champion: number;
  runnerUp: number;
  thirdPlace: number;
  total: number;
}

export const EMPTY_BREAKDOWN: ScoreBreakdown = {
  groups: 0, r32: 0, r16: 0, qf: 0, sf: 0, champion: 0, runnerUp: 0, thirdPlace: 0, total: 0,
};

// How many distinct teams the user picked to win this round actually advanced.
function correctAdvances(predictedWinners: string[], actualAdvancing: string[]): number {
  const actual = new Set(actualAdvancing.filter(Boolean));
  const counted = new Set<string>();
  let n = 0;
  for (const id of predictedWinners) {
    if (id && actual.has(id) && !counted.has(id)) {
      counted.add(id);
      n++;
    }
  }
  return n;
}

export function computeScore(p: Prediction, r: Results): ScoreBreakdown {
  // Group stage — exact position only.
  let groups = 0;
  for (const groupId of Object.keys(r.groups)) {
    const actual = r.groups[groupId];
    const pick = p.groups?.[groupId];
    if (!pick || !actual) continue;
    if (pick.first && pick.first === actual.first) groups += POINTS.groupExact;
    if (pick.second && pick.second === actual.second) groups += POINTS.groupExact;
    if (pick.third && pick.third === actual.third) groups += POINTS.groupExact;
  }

  const r32 = correctAdvances(Object.values(p.r32 ?? {}), r.r32Winners) * POINTS.r32;
  const r16 = correctAdvances(Object.values(p.r16 ?? {}), r.r16Winners) * POINTS.r16;
  const qf = correctAdvances(Object.values(p.qf ?? {}), r.qfWinners) * POINTS.qf;
  const sf = correctAdvances(Object.values(p.sf ?? {}), r.sfWinners) * POINTS.sf;

  const champion = p.champion && p.champion === r.champion ? POINTS.champion : 0;
  const runnerUp = p.runnerUp && p.runnerUp === r.runnerUp ? POINTS.runnerUp : 0;
  const thirdPlace = p.thirdPlace && p.thirdPlace === r.thirdPlace ? POINTS.thirdPlace : 0;

  const total = groups + r32 + r16 + qf + sf + champion + runnerUp + thirdPlace;
  return { groups, r32, r16, qf, sf, champion, runnerUp, thirdPlace, total };
}

// Points that count toward a league's standings. Each league is scored only from
// its own round onward, so entries that didn't predict the earlier rounds (e.g. a
// standalone R32/R16 entry with no group picks) compete on equal footing:
//   • main → everything
//   • r32  → R32 onward (group points excluded)
//   • r16  → R16 onward (group + R32 excluded)
export function leagueScore(b: ScoreBreakdown, league: League): number {
  if (league === 'r32') return b.total - b.groups;
  if (league === 'r16') return b.total - b.groups - b.r32;
  return b.total;
}

export interface RankedEntry {
  prediction: Prediction;
  score: ScoreBreakdown;
  leagueTotal: number;   // score within the entry's own league scope (use this for standings)
  rank: number;
}

// Ranks by league-scoped points DESC, ties broken by earliest submission (createdAt
// ASC). createdAt timestamps are effectively unique, so this yields a single winner.
export function rankPredictions(preds: Prediction[], results: Results): RankedEntry[] {
  const scored = preds.map(p => {
    const score = computeScore(p, results);
    return { prediction: p, score, leagueTotal: leagueScore(score, p.league) };
  });
  scored.sort((a, b) => {
    if (b.leagueTotal !== a.leagueTotal) return b.leagueTotal - a.leagueTotal;
    return (a.prediction.createdAt ?? '').localeCompare(b.prediction.createdAt ?? '');
  });
  return scored.map((e, i) => ({ ...e, rank: i + 1 }));
}

// Gross = paid entries × fee; prize = payoutPercent of gross, rounded DOWN to roundTo.
export function prizePool(paidCount: number, fee: number, payoutPercent: number, roundTo: number) {
  const gross = paidCount * fee;
  const raw = gross * payoutPercent;
  const prize = roundTo > 0 ? Math.floor(raw / roundTo) * roundTo : Math.floor(raw);
  return { gross, prize };
}

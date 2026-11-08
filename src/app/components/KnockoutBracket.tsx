import { Trophy } from 'lucide-react';
import {
  R16_PAIRS, QF_PAIRS, SF_PAIRS,
  buildKnockoutMatches, getTeam, matchOutcome, matchDateTime,
  ROUND_R32, ROUND_R16, ROUND_QF, ROUND_SF, ROUND_FINAL, ROUND_BRONZE,
  type Match, type Results, EMPTY_RESULTS,
} from '../data/worldcup';

// ─── Bracket geometry ───────────────────────────────────────────────────────────
// The tree is built recursively from the official pairing graph, so each match card
// sits exactly between the two feeders it comes from. Widths/heights are fixed so the
// round headers line up with the card columns and the connector elbows land on centres.
const CARD_W = 188;   // match-card width
const CONN_W = 30;    // connector column width between two rounds
const LEAF_H = 96;    // vertical slot per Dieciseisavos match (leaf) — everything scales from this
const PITCH = CARD_W + CONN_W;

// match id → [feeder id, feeder id]. Winners of the two feeders meet in this match.
const FEEDERS: Record<string, [string, string]> = {};
R16_PAIRS.forEach(p => { FEEDERS[p.id] = [p.r32a, p.r32b]; });
QF_PAIRS.forEach(p => { FEEDERS[p.id] = [p.r16a, p.r16b]; });
SF_PAIRS.forEach(p => { FEEDERS[p.id] = [p.qfa, p.qfb]; });
FEEDERS['final'] = [SF_PAIRS[0].id, SF_PAIRS[1].id];

const ROUND_HEADERS = [
  { round: ROUND_R32,   short: 'DIECISEISAVOS' },
  { round: ROUND_R16,   short: 'OCTAVOS' },
  { round: ROUND_QF,    short: 'CUARTOS' },
  { round: ROUND_SF,    short: 'SEMIS' },
  { round: ROUND_FINAL, short: 'FINAL' },
];

// One team's line inside a match card. Resolves to a real team when known, otherwise
// shows the bracket placeholder ("Ganador P73", "1° Gr. A"). The advancing side is
// highlighted; the eliminated one is dimmed.
function TeamLine({
  teamId, label, score, state,
}: {
  teamId: string;
  label?: string;
  score: number | null;
  state: 'win' | 'lose' | 'neutral';
}) {
  const team = teamId ? getTeam(teamId) : null;
  const dim = state === 'lose';
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      style={{ background: state === 'win' ? 'rgba(74,222,128,0.1)' : 'transparent' }}
    >
      <span className="text-base" style={{ opacity: dim ? 0.45 : 1 }}>{team ? team.flag : '⏳'}</span>
      {team ? (
        <span
          className="flex-1 truncate"
          style={{
            color: '#e0f0e8',
            fontSize: '0.78rem',
            fontFamily: "'Twemoji Country Flags', 'Nunito Sans', sans-serif",
            fontWeight: state === 'win' ? 700 : 500,
            opacity: dim ? 0.5 : 1,
          }}
        >
          {team.name}
        </span>
      ) : (
        <span
          className="flex-1 truncate"
          style={{ color: '#7eb89a', fontSize: '0.7rem', fontStyle: 'italic', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace" }}
        >
          {label}
        </span>
      )}
      {score !== null && (
        <span
          style={{
            fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 700,
            color: state === 'win' ? '#4ade80' : dim ? '#4a7d65' : '#e0f0e8',
            minWidth: '12px',
            textAlign: 'right',
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// A single knockout match, showing both sides (with who's advancing), the score when
// played, and the date · time · stadium.
function MatchCard({ match, results }: { match: Match; results: Results }) {
  const out = matchOutcome(match, results);
  const dt = matchDateTime(match, results);

  // Definitive winner from the per-round winner sets (penalty-safe), falling back to
  // the scoreline for a live/finished match without a recorded winner yet.
  const winnerSets: Record<string, string[]> = {
    [ROUND_R32]: results.r32Winners ?? [],
    [ROUND_R16]: results.r16Winners ?? [],
    [ROUND_QF]: results.qfWinners ?? [],
    [ROUND_SF]: results.sfWinners ?? [],
  };
  let winner = '';
  if (match.round === ROUND_FINAL) winner = results.champion ?? '';
  else if (match.round === ROUND_BRONZE) winner = results.thirdPlace ?? '';
  else {
    const set = winnerSets[match.round ?? ''] ?? [];
    if (match.homeTeamId && set.includes(match.homeTeamId)) winner = match.homeTeamId;
    else if (match.awayTeamId && set.includes(match.awayTeamId)) winner = match.awayTeamId;
  }
  if (!winner && out && match.homeTeamId && match.awayTeamId && out.homeScore !== out.awayScore) {
    winner = out.homeScore > out.awayScore ? match.homeTeamId : match.awayTeamId;
  }

  const sideState = (teamId: string): 'win' | 'lose' | 'neutral' => {
    if (!winner || !teamId) return 'neutral';
    return teamId === winner ? 'win' : 'lose';
  };

  const live = out?.status === 'live';

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ width: CARD_W, background: '#0d5035', border: `1px solid ${live ? 'rgba(212,242,38,0.4)' : 'rgba(255,255,255,0.08)'}` }}
    >
      <div className="flex items-center justify-between px-2 py-1" style={{ background: 'rgba(0,0,0,0.18)' }}>
        <span style={{ color: '#f5a623', fontSize: '0.6rem', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace", fontWeight: 700 }}>
          P{match.matchNum}
        </span>
        <span style={{ color: '#7eb89a', fontSize: '0.6rem', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace" }}>
          {dt.date} · {dt.time}
        </span>
        {live && (
          <span className="px-1 rounded" style={{ background: 'rgba(212,242,38,0.15)', color: '#d4f226', fontSize: '0.52rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", letterSpacing: '0.04em' }}>
            EN VIVO
          </span>
        )}
      </div>
      <TeamLine teamId={match.homeTeamId} label={match.homeLabel} score={out ? out.homeScore : null} state={sideState(match.homeTeamId)} />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <TeamLine teamId={match.awayTeamId} label={match.awayLabel} score={out ? out.awayScore : null} state={sideState(match.awayTeamId)} />
      <div className="px-2 py-0.5 flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.12)' }}>
        <span style={{ color: '#4a7d65', fontSize: '0.58rem' }}>📍</span>
        <span className="truncate" style={{ color: '#7eb89a', fontSize: '0.6rem', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace" }}>
          {match.city}
        </span>
      </div>
    </div>
  );
}

// Connector between a feeder column (two subtrees, whose card centres land at 25% / 75%
// of the column height) and the match they feed into (centred at 50%). Pure CSS elbow.
function Connector() {
  const line = 'rgba(245,166,35,0.35)';
  return (
    <div className="relative flex-shrink-0" style={{ width: CONN_W, alignSelf: 'stretch' }}>
      <div style={{ position: 'absolute', left: 0, top: '25%', height: '50%', width: 2, background: line }} />
      <div style={{ position: 'absolute', left: 0, top: '50%', width: '100%', height: 2, background: line }} />
    </div>
  );
}

// Recursively lay out the bracket rightward: [ feeders column ][ connector ][ this match ].
// Leaves (Dieciseisavos) render a single card in a fixed-height slot; equal leaf heights
// keep every parent card aligned to the midpoint of its two feeders.
function BracketNode({ id, matches, results }: { id: string; matches: Record<string, Match>; results: Results }) {
  const feeder = FEEDERS[id];
  const match = matches[id];
  if (!match) return null;

  if (!feeder) {
    return (
      <div className="flex items-center" style={{ height: LEAF_H }}>
        <MatchCard match={match} results={results} />
      </div>
    );
  }

  return (
    <div className="flex items-stretch">
      <div className="flex flex-col justify-around">
        <BracketNode id={feeder[0]} matches={matches} results={results} />
        <BracketNode id={feeder[1]} matches={matches} results={results} />
      </div>
      <Connector />
      <div className="flex items-center">
        <MatchCard match={match} results={results} />
      </div>
    </div>
  );
}

export function KnockoutBracket({ results = EMPTY_RESULTS }: { results?: Results }) {
  const matches: Record<string, Match> = {};
  buildKnockoutMatches(results).forEach(m => { matches[m.id] = m; });

  const bronze = matches['bronze'];
  const champion = results.champion ? getTeam(results.champion) : null;

  return (
    <div>
      {/* Champion banner (once the final is decided) */}
      {champion && (
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)' }}>
          <Trophy size={22} style={{ color: '#f5a623' }} />
          <div>
            <div style={{ color: '#7eb89a', fontSize: '0.66rem', fontFamily: "'Twemoji Country Flags', 'DM Mono', monospace", letterSpacing: '0.08em' }}>CAMPEÓN DEL MUNDO</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl">{champion.flag}</span>
              <span style={{ color: '#f5a623', fontSize: '1.1rem', fontWeight: 700, fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", letterSpacing: '0.03em' }}>{champion.name}</span>
            </div>
          </div>
        </div>
      )}

      <p style={{ color: '#7eb89a', fontSize: '0.76rem', marginBottom: '10px' }}>
        Las llaves se llenan solas conforme se cargan los resultados: el ganador de cada
        partido avanza a su siguiente cruce. Desliza horizontalmente para ver todas las rondas. ↔
      </p>

      {/* Scroll container: the whole bracket is wider than the phone, so it scrolls sideways */}
      <div className="overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: 5 * CARD_W + 4 * CONN_W }}>
          {/* Round headers, aligned to the card columns */}
          <div className="flex mb-2">
            {ROUND_HEADERS.map((h, i) => (
              <div key={h.round} style={{ width: i === 0 ? CARD_W : PITCH, paddingLeft: i === 0 ? 0 : CONN_W }}>
                <div
                  className="text-center py-1 rounded"
                  style={{ width: CARD_W, background: 'rgba(245,166,35,0.08)', color: '#f5a623', fontSize: '0.62rem', letterSpacing: '0.06em', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif" }}
                >
                  {h.short}
                </div>
              </div>
            ))}
          </div>

          {/* The bracket tree, root = final on the right */}
          <BracketNode id="final" matches={matches} results={results} />
        </div>
      </div>

      {/* Third-place match, shown apart from the main tree */}
      {bronze && (
        <div className="mt-5">
          <div className="mb-2" style={{ color: '#f5a623', fontSize: '0.7rem', letterSpacing: '0.08em', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif" }}>
            TERCER LUGAR
          </div>
          <MatchCard match={bronze} results={results} />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-5 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(74,222,128,0.35)', border: '1px solid #4ade80' }} />
          <span style={{ color: '#7eb89a', fontSize: '0.68rem' }}>Avanza / va ganando</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">⏳</span>
          <span style={{ color: '#7eb89a', fontSize: '0.68rem' }}>Por definir</span>
        </div>
      </div>
    </div>
  );
}

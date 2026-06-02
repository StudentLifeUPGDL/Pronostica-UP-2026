import { useState } from 'react';
import { CheckCircle2, Clock, Trophy } from 'lucide-react';
import { GROUPS, buildSchedule, getTeam, PHASE_ORDER, type Match, type Results, EMPTY_RESULTS } from '../data/worldcup';

type Tab = 'grupos' | 'partidos' | 'clasificados';

// One side of a match row: a resolved team, or a placeholder label when unknown.
function MatchSide({ teamId, label, align }: { teamId: string; label?: string; align: 'left' | 'right' }) {
  const team = teamId ? getTeam(teamId) : null;
  const rowClass = align === 'right' ? 'flex items-center gap-2 flex-1 justify-end' : 'flex items-center gap-2 flex-1';
  const flag = <span className="text-xl">{team ? team.flag : '⏳'}</span>;
  const name = team
    ? <span style={{ color: '#e0f0e8', fontSize: '0.88rem', fontFamily: 'Nunito Sans, sans-serif', fontWeight: 600 }}>{team.name}</span>
    : <span style={{ color: '#7eb89a', fontSize: '0.82rem', fontFamily: 'DM Mono, monospace', fontStyle: 'italic' }}>{label}</span>;
  return <div className={rowClass}>{align === 'right' ? <>{name}{flag}</> : <>{flag}{name}</>}</div>;
}

export function ResultsPage({ results = EMPTY_RESULTS }: { results?: Results }) {
  const [activeTab, setActiveTab] = useState<Tab>('partidos');
  const [activeGroup, setActiveGroup] = useState('A');

  // Full calendar; R32 teams auto-fill from entered group results, deeper rounds stay
  // as placeholders until played. Grouped by phase for display.
  const schedule = buildSchedule(results);
  const byPhase = PHASE_ORDER
    .map(phase => ({ phase, matches: schedule.filter(m => m.round === phase) }))
    .filter(p => p.matches.length > 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'partidos', label: 'PARTIDOS' },
    { id: 'grupos', label: 'GRUPOS' },
    { id: 'clasificados', label: 'CLASIFICADOS' },
  ];

  const allConfTeams = {
    'CONCACAF': ['usa', 'can', 'mex', 'pan', 'hai', 'cuw'],
    'CONMEBOL': ['arg', 'bra', 'col', 'ecu', 'uru', 'par'],
    'UEFA': ['esp', 'fra', 'ger', 'por', 'ned', 'bel', 'cro', 'sui', 'aut', 'tur', 'sco', 'eng', 'cze', 'bih', 'swe', 'nor'],
    'CAF': ['mar', 'sen', 'rsa', 'egy', 'tun', 'gha', 'civ', 'cpv', 'alg', 'cod'],
    'AFC': ['jpn', 'kor', 'irn', 'ksa', 'aus', 'uzb', 'jor', 'qat', 'irq'],
    'OFC': ['nzl'],
  };

  const confColors: Record<string, string> = {
    CONCACAF: '#d4f226', CONMEBOL: '#f5a623', UEFA: '#4a9eff',
    CAF: '#ff6b6b', AFC: '#c084fc', OFC: '#4ade80',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>
          COPA DEL MUNDO FIFA 2026
        </h1>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginTop: '4px' }}>
          Estados Unidos · Canadá · México — 11 jun al 19 jul 2026
        </p>
      </div>

      {/* Status banner */}
      <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: 'rgba(212,242,38,0.08)', border: '1px solid rgba(212,242,38,0.2)' }}>
        <Clock size={18} style={{ color: '#d4f226' }} />
        <div>
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            FASE PREVIA AL TORNEO
          </span>
          <p style={{ color: '#7eb89a', fontSize: '0.78rem', marginTop: '2px' }}>
            El torneo inicia el jueves 11 de junio de 2026. Los partidos mostrados son próximos encuentros.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: '#083524' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer"
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '0.82rem',
              letterSpacing: '0.08em',
              background: activeTab === tab.id ? '#f5a623' : 'transparent',
              color: activeTab === tab.id ? '#062b1a' : '#7eb89a',
              fontWeight: activeTab === tab.id ? 700 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Partidos — complete 104-match calendar, grouped by phase */}
      {activeTab === 'partidos' && (
        <div className="flex flex-col gap-5">
          {byPhase.map(({ phase, matches }) => (
            <div key={phase} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(245,166,35,0.06)', borderBottom: '1px solid rgba(245,166,35,0.12)' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
                  {phase.toUpperCase()}
                </span>
                <span style={{ color: '#4a7d65', fontSize: '0.66rem', fontFamily: 'DM Mono' }}>{matches.length} partidos</span>
              </div>
              <div>
                {matches.map((match: Match, i: number) => (
                  <div
                    key={match.id}
                    className="px-5 py-4 flex items-center gap-4"
                    style={{ borderBottom: i < matches.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    {/* Date/time/match number */}
                    <div className="flex-shrink-0 text-center" style={{ minWidth: '70px' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', color: '#7eb89a', fontSize: '0.68rem' }}>{match.date}</div>
                      <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', fontWeight: 600 }}>{match.time}</div>
                      <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: 'DM Mono' }}>
                        {match.group ? `Gr. ${match.group}` : `P${match.matchNum}`}
                      </div>
                    </div>

                    {/* Match */}
                    <div className="flex-1 flex items-center gap-3">
                      <MatchSide teamId={match.homeTeamId} label={match.homeLabel} align="right" />
                      <div className="flex-shrink-0 px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)', minWidth: '64px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', color: '#9cc4b2', fontSize: '0.85rem' }}>VS</span>
                      </div>
                      <MatchSide teamId={match.awayTeamId} label={match.awayLabel} align="left" />
                    </div>

                    {/* City */}
                    <div className="hidden sm:block flex-shrink-0 text-right" style={{ minWidth: '100px' }}>
                      <div style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono, monospace' }}>{match.city}</div>
                      <div className="mt-1 px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(212,242,38,0.08)', color: '#d4f226', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                        PRÓXIMO
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Grupos */}
      {activeTab === 'grupos' && (
        <div>
          {/* Group selector */}
          <div className="flex flex-wrap gap-2 mb-5">
            {'ABCDEFGHIJKL'.split('').map(g => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className="w-10 h-10 rounded-lg cursor-pointer transition-all"
                style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  background: activeGroup === g ? '#f5a623' : '#0d5035',
                  color: activeGroup === g ? '#062b1a' : '#7eb89a',
                  border: activeGroup === g ? 'none' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Group table — live standings from results.groupTables when available,
              otherwise the static draw order with zeros (pre-kickoff). */}
          {GROUPS.filter(g => g.id === activeGroup).map(group => {
            const liveRows = results.groupTables?.[group.id];
            const rows = (liveRows && liveRows.length)
              ? liveRows.map(r => ({ team: getTeam(r.teamId), played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, points: r.points }))
              : group.teams.map(t => ({ team: t, played: 0, won: 0, drawn: 0, lost: 0, points: 0 }));
            const maxPlayed = rows.reduce((n, r) => Math.max(n, r.played), 0);
            const complete = maxPlayed >= 3;
            const inProgress = maxPlayed > 0 && !complete;
            return (
              <div key={group.id} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(245,166,35,0.08)', borderBottom: '1px solid rgba(245,166,35,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <Trophy size={14} style={{ color: '#f5a623' }} />
                    <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.06em' }}>
                      GRUPO {group.id}
                    </span>
                  </div>
                  {inProgress && (
                    <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,242,38,0.1)', color: '#d4f226', fontSize: '0.6rem', fontFamily: 'DM Mono', letterSpacing: '0.08em' }}>
                      EN VIVO · PROVISIONAL
                    </span>
                  )}
                  {complete && (
                    <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: '0.6rem', fontFamily: 'DM Mono', letterSpacing: '0.08em' }}>
                      FINAL
                    </span>
                  )}
                </div>
                <div>
                  {/* Table header */}
                  <div className="px-5 py-2 grid gap-2" style={{ gridTemplateColumns: '1fr 60px 60px 60px 60px 60px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['EQUIPO', 'PJ', 'G', 'E', 'P', 'PTS'].map(h => (
                      <div key={h} className="text-right first:text-left" style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
                        {h}
                      </div>
                    ))}
                  </div>
                  {rows.map((row, i) => (
                    <div
                      key={row.team.id}
                      className="px-5 py-3 grid gap-2 items-center"
                      style={{ gridTemplateColumns: '1fr 60px 60px 60px 60px 60px', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: i < 2 ? '#4ade80' : i === 2 ? '#d4f226' : '#4a7d65', fontSize: '0.75rem', fontFamily: 'DM Mono', minWidth: '16px' }}>{i + 1}</span>
                        <span className="text-lg">{row.team.flag}</span>
                        <span style={{ fontSize: '0.85rem', color: '#e0f0e8', fontFamily: 'Nunito Sans, sans-serif' }}>{row.team.name}</span>
                      </div>
                      {[row.played, row.won, row.drawn, row.lost, row.points].map((v, j) => (
                        <div key={j} className="text-right" style={{ fontFamily: 'DM Mono, monospace', color: j === 4 ? '#f5a623' : '#9cc4b2', fontSize: '0.85rem', fontWeight: j === 4 ? 700 : 400 }}>{v}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="px-5 py-2" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <span style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>
                    ✦ Top 2 avanzan a Dieciséisavos · Mejor 3ro también puede avanzar
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Clasificados */}
      {activeTab === 'clasificados' && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
            <span style={{ color: '#4ade80', fontSize: '0.85rem', fontFamily: 'Nunito Sans, sans-serif' }}>
              Los 48 equipos han completado la clasificación al Mundial 2026.
            </span>
          </div>

          {Object.entries(allConfTeams).map(([conf, teamIds]) => (
            <div key={conf} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: `${confColors[conf]}10` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: confColors[conf] }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', color: confColors[conf], fontSize: '0.85rem', letterSpacing: '0.1em' }}>
                  {conf} — {teamIds.length} equipo{teamIds.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {teamIds.map(id => {
                  const team = getTeam(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span>{team.flag}</span>
                      <span style={{ fontSize: '0.8rem', color: '#c0d8cc', fontFamily: 'Nunito Sans, sans-serif' }}>{team.name}</span>
                      <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

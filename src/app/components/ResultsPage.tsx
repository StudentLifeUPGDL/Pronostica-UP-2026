import { useState } from 'react';
import { CheckCircle2, Clock, Trophy } from 'lucide-react';
import { GROUPS, UPCOMING_MATCHES, getTeam } from '../data/worldcup';

type Tab = 'grupos' | 'partidos' | 'clasificados';

export function ResultsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('partidos');
  const [activeGroup, setActiveGroup] = useState('A');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'partidos', label: 'PARTIDOS' },
    { id: 'grupos', label: 'GRUPOS' },
    { id: 'clasificados', label: 'CLASIFICADOS' },
  ];

  const allConfTeams = {
    'CONCACAF': ['usa', 'can', 'mex', 'pan', 'crc', 'hon', 'jam'],
    'CONMEBOL': ['arg', 'bra', 'col', 'ecu', 'chi', 'uru', 'ven'],
    'UEFA': ['esp', 'fra', 'ger', 'por', 'ned', 'ita', 'bel', 'cro', 'sui', 'pol', 'aut', 'tur', 'srb', 'den', 'sco'],
    'CAF': ['mar', 'nga', 'sen', 'rsa', 'cmr', 'egy', 'tun', 'gha', 'civ'],
    'AFC': ['jpn', 'kor', 'irn', 'ksa', 'aus', 'uzb', 'jor', 'qat', 'kaz'],
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

      {/* Tab: Partidos */}
      {activeTab === 'partidos' && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
              PRÓXIMOS PARTIDOS — FASE DE GRUPOS
            </span>
          </div>
          <div>
            {UPCOMING_MATCHES.map((match, i) => {
              const home = getTeam(match.homeTeamId);
              const away = getTeam(match.awayTeamId);
              return (
                <div
                  key={match.id}
                  className="px-5 py-4 flex items-center gap-4"
                  style={{ borderBottom: i < UPCOMING_MATCHES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  {/* Date/time */}
                  <div className="flex-shrink-0 text-center" style={{ minWidth: '70px' }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', color: '#7eb89a', fontSize: '0.68rem' }}>{match.date}</div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', fontWeight: 600 }}>{match.time}</div>
                    <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: 'DM Mono' }}>Gr. {match.group}</div>
                  </div>

                  {/* Match */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span style={{ color: '#e0f0e8', fontSize: '0.88rem', fontFamily: 'Nunito Sans, sans-serif', fontWeight: 600 }}>{home.name}</span>
                      <span className="text-xl">{home.flag}</span>
                    </div>
                    <div className="flex-shrink-0 px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)', minWidth: '64px', textAlign: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: '#9cc4b2', fontSize: '0.85rem' }}>NC</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xl">{away.flag}</span>
                      <span style={{ color: '#e0f0e8', fontSize: '0.88rem', fontFamily: 'Nunito Sans, sans-serif', fontWeight: 600 }}>{away.name}</span>
                    </div>
                  </div>

                  {/* City */}
                  <div className="hidden sm:block flex-shrink-0 text-right" style={{ minWidth: '100px' }}>
                    <div style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono, monospace' }}>{match.city}</div>
                    <div className="mt-1 px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(212,242,38,0.08)', color: '#d4f226', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                      PRÓXIMO
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

          {/* Group table */}
          {GROUPS.filter(g => g.id === activeGroup).map(group => (
            <div key={group.id} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(245,166,35,0.08)', borderBottom: '1px solid rgba(245,166,35,0.15)' }}>
                <Trophy size={14} style={{ color: '#f5a623' }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.06em' }}>
                  GRUPO {group.id}
                </span>
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
                {group.teams.map((team, i) => (
                  <div
                    key={team.id}
                    className="px-5 py-3 grid gap-2 items-center"
                    style={{ gridTemplateColumns: '1fr 60px 60px 60px 60px 60px', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#4a7d65', fontSize: '0.75rem', fontFamily: 'DM Mono', minWidth: '16px' }}>{i + 1}</span>
                      <span className="text-lg">{team.flag}</span>
                      <span style={{ fontSize: '0.85rem', color: '#e0f0e8', fontFamily: 'Nunito Sans, sans-serif' }}>{team.name}</span>
                    </div>
                    {[0, 0, 0, 0, 0].map((_, j) => (
                      <div key={j} className="text-right" style={{ fontFamily: 'DM Mono, monospace', color: '#9cc4b2', fontSize: '0.85rem' }}>0</div>
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
          ))}
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

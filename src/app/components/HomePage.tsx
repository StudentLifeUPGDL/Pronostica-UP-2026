import { useState, useEffect } from 'react';
import { Users, Trophy, Calendar, Flame, Dice5 } from 'lucide-react';
import {
  FULL_SCHEDULE, GROUPS, getTeam, BIG_PRIZE_THRESHOLD,
  type Prediction, type Results, type AppConfig, type PublicStats,
} from '../data/worldcup';
import { computeScore, prizePool } from '../../lib/scoring';
import { leagueLabel } from '../../lib/payment';
import type { Page } from '../App';

interface HomePageProps {
  userName: string;
  onNavigate: (page: Page) => void;
  predictions: Prediction[];
  results: Results;
  config: AppConfig;
  stats: PublicStats;
}

function money(n: number, currency: string) {
  return `$${n.toLocaleString('es-MX')} ${currency}`;
}

// Live bote banner: below BIG_PRIZE_THRESHOLD it teases ("participa por grandes
// premios"); once any variant's published bote crosses it, the amounts are revealed.
function LiveBoteBanner({ config, stats, onNavigate }: { config: AppConfig; stats: PublicStats; onNavigate: (p: Page) => void }) {
  const botes = [
    { key: 'main', label: 'Principal', amount: prizePool(stats.mainPaid, config.fees.main, config.payoutPercent, config.payoutRoundTo).prize },
    { key: 'r32', label: 'Liga R32', amount: prizePool(stats.r32Paid, config.fees.r32, config.payoutPercent, config.payoutRoundTo).prize },
    { key: 'r16', label: 'Liga R16', amount: prizePool(stats.r16Paid, config.fees.r16, config.payoutPercent, config.payoutRoundTo).prize },
  ];
  const main = botes[0];
  const reveal = botes.some(b => b.amount >= BIG_PRIZE_THRESHOLD);

  return (
    <div className="rounded-2xl overflow-hidden mb-6" style={{ background: 'linear-gradient(135deg, #0d5035, #0b4730)', border: '1px solid rgba(245,166,35,0.3)' }}>
      <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.15)' }}>
          <Flame size={24} style={{ color: '#f5a623' }} />
        </div>
        {reveal ? (
          <div className="flex-1 min-w-0">
            <div style={{ color: '#7eb89a', fontSize: '0.68rem', fontFamily: 'DM Mono', letterSpacing: '0.12em' }}>BOTE EN VIVO · PRONOSTICA PANTERA</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {money(main.amount, config.currency)}
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {botes.slice(1).filter(b => b.amount > 0).map(b => (
                <span key={b.key} className="px-2 py-0.5 rounded-md" style={{ background: 'rgba(212,242,38,0.1)', color: '#d4f226', fontSize: '0.7rem', fontFamily: 'DM Mono' }}>
                  {b.label}: {money(b.amount, config.currency)}
                </span>
              ))}
              <span style={{ color: '#7eb89a', fontSize: '0.72rem', fontFamily: 'Nunito Sans' }}>
                · el único ganador se lleva el bote
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 }}>
              ¡PARTICIPA POR GRANDES PREMIOS!
            </div>
            <div style={{ color: '#9cc4b2', fontSize: '0.82rem', marginTop: '4px' }}>
              El bote crece con cada pronóstico pagado y se lo lleva un solo ganador. Entra ya y haz que valga la pena.
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
          <button onClick={() => onNavigate('my-predictions')} className="px-4 py-2 rounded-lg cursor-pointer" style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em' }}>
            JUGAR PRONOSTICA PANTERA
          </button>
          {config.rifaEnabled && (
            <button onClick={() => onNavigate('rifa')} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg cursor-pointer" style={{ border: '1px solid rgba(212,242,38,0.4)', color: '#d4f226', fontFamily: 'Oswald, sans-serif', fontSize: '0.78rem', letterSpacing: '0.04em' }}>
              <Dice5 size={13} /> QUINIELA · 1°: {money(config.rifaPrizes.first, config.currency)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountdownTimer({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const targetMs = new Date(target).getTime();
    const id = setInterval(() => {
      setNow(Date.now());
      // Stop ticking once we've reached the target.
      if (Date.now() >= targetMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const totalSec = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;

  return (
    <div className="flex items-center gap-4">
      {[{ val: days, label: 'DÍAS' }, { val: hrs, label: 'HRS' }, { val: min, label: 'MIN' }, { val: sec, label: 'SEG' }].map(t => (
        <div key={t.label} className="text-center" style={{ minWidth: '2.6rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2.2rem', fontWeight: 700, color: '#f5a623', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {String(t.val).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#7eb89a', letterSpacing: '0.15em', fontFamily: 'DM Mono, monospace' }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export function HomePage({ userName, onNavigate, predictions, results, config, stats }: HomePageProps) {
  const mains = predictions.filter(p => p.league === 'main');

  const qualifiedConfederations = [
    { name: 'UEFA', teams: 16, color: '#4a9eff' },
    { name: 'CONMEBOL', teams: 6, color: '#f5a623' },
    { name: 'CONCACAF', teams: 6, color: '#d4f226' },
    { name: 'CAF', teams: 10, color: '#ff6b6b' },
    { name: 'AFC', teams: 9, color: '#c084fc' },
    { name: 'OFC', teams: 1, color: '#4ade80' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ minHeight: '280px', background: '#062b1a' }}>
        <img src="https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=1200&h=400&fit=crop&auto=format" alt="Copa del Mundo FIFA 2026" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(6,43,26,0.95) 0%, rgba(10,61,40,0.7) 50%, rgba(6,43,26,0.9) 100%)' }} />
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'repeating-linear-gradient(90deg, #f5a623 0px, #f5a623 8px, #d4f226 8px, #d4f226 16px, transparent 16px, transparent 24px)' }} />
        <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.85rem', letterSpacing: '0.2em', marginBottom: '6px' }}>
              BIENVENIDO, {userName.toUpperCase()}
            </div>
            <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#ffffff', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '12px' }}>
              COPA DEL MUNDO<br /><span style={{ color: '#f5a623' }}>FIFA 2026</span>
            </h1>
            <p style={{ color: '#9cc4b2', fontSize: '0.9rem', maxWidth: '400px' }}>
              Estados Unidos · Canadá · México<br />11 de junio — 19 de julio de 2026
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button onClick={() => onNavigate('my-predictions')} className="px-5 py-2.5 rounded-lg cursor-pointer transition-all"
                style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                {mains.length > 0 ? 'VER MIS PRONÓSTICOS' : 'HACER MI PRONÓSTICO'}
              </button>
              <button onClick={() => onNavigate('results')} className="px-5 py-2.5 rounded-lg cursor-pointer transition-all"
                style={{ border: '1px solid rgba(245,166,35,0.4)', color: '#f5a623', fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                VER PARTIDOS
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div style={{ color: '#7eb89a', fontSize: '0.7rem', letterSpacing: '0.15em', fontFamily: 'DM Mono, monospace' }}>INICIA EN</div>
            <CountdownTimer target={config.lockDate} />
            <div className="w-full h-px mt-2" style={{ background: 'rgba(245,166,35,0.2)' }} />
            <div style={{ color: '#7eb89a', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: 'DM Mono, monospace' }}>JUEVES 11 JUN 2026</div>
          </div>
        </div>
      </div>

      {/* Live bote */}
      <LiveBoteBanner config={config} stats={stats} onNavigate={onNavigate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upcoming matches */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={14} style={{ color: '#f5a623' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', letterSpacing: '0.08em' }}>PRÓXIMOS PARTIDOS</span>
            </div>
            <button onClick={() => onNavigate('results')} style={{ color: '#7eb89a', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>ver todos →</button>
          </div>
          <div>
            {FULL_SCHEDULE.slice(0, 8).map(match => {
              const home = match.homeTeamId ? getTeam(match.homeTeamId) : null;
              const away = match.awayTeamId ? getTeam(match.awayTeamId) : null;
              return (
                <div key={match.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-center flex-shrink-0" style={{ minWidth: '56px' }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', color: '#7eb89a', fontSize: '0.7rem' }}>{match.date}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', color: '#f5a623', fontSize: '0.75rem', fontWeight: 500 }}>{match.time}</div>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{home ? home.flag : '⏳'}</span>
                      <span style={{ color: '#e0f0e8', fontSize: '0.82rem' }} className="truncate">{home ? home.shortName : match.homeLabel}</span>
                    </div>
                    <div className="flex-shrink-0 px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', fontFamily: 'DM Mono, monospace', color: '#9cc4b2', fontSize: '0.72rem' }}>VS</div>
                    <div className="flex items-center gap-1.5 min-w-0 flex-row-reverse">
                      <span className="text-base">{away ? away.flag : '⏳'}</span>
                      <span style={{ color: '#e0f0e8', fontSize: '0.82rem' }} className="truncate">{away ? away.shortName : match.awayLabel}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs flex-shrink-0" style={{ background: 'rgba(13,96,64,0.8)', color: '#7eb89a', fontSize: '0.65rem', fontFamily: 'DM Mono, monospace' }}>{match.group ? `Gr. ${match.group}` : `P${match.matchNum}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Own summary (standings are admin-only) */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: '#f5a623' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', letterSpacing: '0.08em' }}>MIS PRONÓSTICOS Y PUNTOS</span>
            </div>
            <button onClick={() => onNavigate('my-predictions')} style={{ color: '#7eb89a', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>gestionar →</button>
          </div>
          {predictions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Users size={36} style={{ color: '#2a5a3a', margin: '0 auto 12px' }} />
              <p style={{ color: '#7eb89a', fontSize: '0.85rem', marginBottom: '14px' }}>Aún no tienes pronósticos. ¡Crea el primero!</p>
              <button onClick={() => onNavigate('my-predictions')} className="px-4 py-2 rounded-lg cursor-pointer" style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.82rem' }}>
                CREAR PRONÓSTICO
              </button>
            </div>
          ) : (
            <div>
              {predictions.map((p, i) => {
                const pts = computeScore(p, results).total;
                const statusColor = p.paymentStatus === 'paid' ? '#4ade80' : p.paymentStatus === 'void' ? '#e63946' : '#f5a623';
                return (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} title={p.paymentStatus} />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: '#e0f0e8', fontSize: '0.84rem', fontWeight: 600, fontFamily: 'Nunito Sans' }} className="truncate">{p.name}</div>
                      <div style={{ color: '#4a7d65', fontSize: '0.66rem', fontFamily: 'DM Mono' }}>{p.league === 'main' ? 'Principal' : leagueLabel(p.league)}</div>
                    </div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', color: '#f5a623', fontWeight: 700 }}>
                      {pts} <span style={{ fontSize: '0.62rem', color: '#4a7d65' }}>pts</span>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>La clasificación general es privada del organizador.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confederations */}
      <div className="rounded-xl p-5" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={14} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', letterSpacing: '0.08em' }}>EQUIPOS CLASIFICADOS POR CONFEDERACIÓN</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {qualifiedConfederations.map(conf => (
            <div key={conf.name} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${conf.color}25` }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: conf.color, lineHeight: 1 }}>{conf.teams}</div>
              <div style={{ fontSize: '0.7rem', color: '#7eb89a', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', marginTop: '4px' }}>{conf.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Groups preview */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.05em' }}>GRUPOS</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
          <button onClick={() => onNavigate('results')} style={{ color: '#7eb89a', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace' }}>ver todo →</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {GROUPS.map(group => (
            <div key={group.id} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-3 py-1.5" style={{ background: 'rgba(245,166,35,0.1)', borderBottom: '1px solid rgba(245,166,35,0.15)' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.8rem', letterSpacing: '0.1em' }}>GRUPO {group.id}</span>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {group.teams.map(team => (
                  <div key={team.id} className="flex items-center gap-1.5">
                    <span className="text-sm">{team.flag}</span>
                    <span style={{ fontSize: '0.72rem', color: '#c0d8cc', fontFamily: 'Nunito Sans, sans-serif' }}>{team.shortName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

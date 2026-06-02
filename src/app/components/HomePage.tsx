import { useState, useEffect } from 'react';
import { Users, Trophy, Star, Calendar, Wallet, Swords } from 'lucide-react';
import { FULL_SCHEDULE, GROUPS, getTeam, type Prediction, type Results, type AppConfig } from '../data/worldcup';
import { computeScore } from '../../lib/scoring';
import { leagueLabel } from '../../lib/payment';
import type { Page } from '../App';

interface HomePageProps {
  userName: string;
  onNavigate: (page: Page) => void;
  predictions: Prediction[];
  results: Results;
  config: AppConfig;
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

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#0d5035', border: '1px solid rgba(245,166,35,0.15)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.15)' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', color: '#f5a623', fontWeight: 700, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: '#7eb89a', letterSpacing: '0.08em' }}>{label}</div>
      </div>
    </div>
  );
}

export function HomePage({ userName, onNavigate, predictions, results, config }: HomePageProps) {
  const mains = predictions.filter(p => p.league === 'main');
  const paidCount = mains.filter(p => p.paymentStatus === 'paid').length;
  const sideEntries = predictions.filter(p => p.league !== 'main');
  const msLeft = new Date(config.lockDate).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

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
                {mains.length > 0 ? 'VER MIS QUINIELAS' : 'HACER MI QUINIELA'}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Star size={18} style={{ color: '#d4f226' }} />} value={mains.length} label="TUS QUINIELAS" />
        <StatCard icon={<Wallet size={18} style={{ color: '#4ade80' }} />} value={paidCount} label="PAGADAS" />
        <StatCard icon={<Swords size={18} style={{ color: '#c084fc' }} />} value={sideEntries.length} label="LIGAS APARTE" />
        <StatCard icon={<Calendar size={18} style={{ color: '#7eb89a' }} />} value={daysLeft} label="DÍAS PARA EL INICIO" />
      </div>

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
              <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.9rem', letterSpacing: '0.08em' }}>MIS QUINIELAS Y PUNTOS</span>
            </div>
            <button onClick={() => onNavigate('my-predictions')} style={{ color: '#7eb89a', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>gestionar →</button>
          </div>
          {predictions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Users size={36} style={{ color: '#2a5a3a', margin: '0 auto 12px' }} />
              <p style={{ color: '#7eb89a', fontSize: '0.85rem', marginBottom: '14px' }}>Aún no tienes quinielas. ¡Crea la primera!</p>
              <button onClick={() => onNavigate('my-predictions')} className="px-4 py-2 rounded-lg cursor-pointer" style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.82rem' }}>
                CREAR QUINIELA
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

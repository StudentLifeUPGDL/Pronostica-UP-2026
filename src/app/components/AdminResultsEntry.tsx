import { useEffect, useState } from 'react';
import { Save, Settings, ListChecks, X, Check } from 'lucide-react';
import {
  GROUPS, TEAMS, getTeam, EMPTY_RESULTS,
  type AppConfig, type Results, type GroupResult,
} from '../data/worldcup';
import { fetchResults, saveResults, saveConfig } from '../../lib/predictions';

const ALL_TEAMS = Object.values(TEAMS).sort((a, b) => a.name.localeCompare(b.name));

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

const labelStyle = { fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.72rem', letterSpacing: '0.06em' } as const;
const inputStyle = { background: '#0b4730', border: '1px solid rgba(255,255,255,0.1)', color: '#e0f0e8', borderRadius: '8px', padding: '8px 10px', fontFamily: 'Nunito Sans', fontSize: '0.85rem', width: '100%' } as const;

function SingleTeam({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">—</option>
      {ALL_TEAMS.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
    </select>
  );
}

function MultiTeam({ label, expected, value, onChange }: {
  label: string; expected: number; value: string[]; onChange: (v: string[]) => void;
}) {
  const available = ALL_TEAMS.filter(t => !value.includes(t.id));
  const ok = value.length === expected;
  return (
    <div className="rounded-xl p-4" style={{ background: '#0b4730', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-2">
        <span style={labelStyle}>{label}</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: ok ? '#4ade80' : '#f5a623' }}>{value.length}/{expected}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(id => {
          const t = getTeam(id);
          return (
            <span key={id} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)' }}>
              <span style={{ fontSize: '0.8rem' }}>{t.flag}</span>
              <span style={{ fontSize: '0.72rem', color: '#f5a623', fontFamily: 'Nunito Sans' }}>{t.shortName}</span>
              <button onClick={() => onChange(value.filter(x => x !== id))} className="cursor-pointer" style={{ color: '#a07020' }}><X size={11} /></button>
            </span>
          );
        })}
        {value.length === 0 && <span style={{ color: '#3a6b55', fontSize: '0.75rem', fontStyle: 'italic' }}>Ningún equipo aún</span>}
      </div>
      <select value="" onChange={e => { if (e.target.value) onChange([...value, e.target.value]); }} style={inputStyle}>
        <option value="">+ agregar equipo…</option>
        {available.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
      </select>
    </div>
  );
}

export function AdminResultsEntry({ config, onSaved }: { config: AppConfig; onSaved: () => void }) {
  const [cfg, setCfg] = useState<AppConfig>(config);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setCfg(config); }, [config]);
  useEffect(() => { fetchResults().then(setResults).catch(() => {}); }, []);

  function setGroup(gid: string, patch: Partial<GroupResult>) {
    setResults(r => ({ ...r, groups: { ...r.groups, [gid]: { first: '', second: '', third: '', ...r.groups[gid], ...patch } } }));
  }

  async function handleSaveConfig() {
    setBusy(true); setMsg('');
    try { await saveConfig(cfg); setMsg('Configuración guardada.'); onSaved(); }
    catch (e) { setMsg((e as Error).message ?? 'Error al guardar la configuración.'); }
    finally { setBusy(false); }
  }
  async function handleSaveResults() {
    setBusy(true); setMsg('');
    try { await saveResults(results); setMsg('Resultados guardados. Los puntajes se recalcularán.'); onSaved(); }
    catch (e) { setMsg((e as Error).message ?? 'Error al guardar los resultados.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontSize: '0.82rem' }}>{msg}</div>
      )}

      {/* ── Config ── */}
      <section className="rounded-xl p-5" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.05em' }}>CONFIGURACIÓN</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['lockDate', 'Cierre quiniela principal (kickoff)'],
            ['paymentDeadline', 'Fecha límite de pago (anula pendientes)'],
            ['r32StartDate', 'Inicio R32 (cierra Liga R32)'],
            ['r16StartDate', 'Inicio R16 (cierra Liga R16)'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span style={labelStyle}>{label}</span>
              <input type="datetime-local" value={isoToLocal(cfg[key])}
                onChange={e => setCfg({ ...cfg, [key]: localToIso(e.target.value) || cfg[key] })} style={inputStyle} />
            </label>
          ))}
          {([
            ['main', 'Cuota principal'],
            ['r32', 'Cuota Liga R32'],
            ['r16', 'Cuota Liga R16'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span style={labelStyle}>{label} ({cfg.currency})</span>
              <input type="number" min={0} value={cfg.fees[key]}
                onChange={e => setCfg({ ...cfg, fees: { ...cfg.fees, [key]: Number(e.target.value) } })} style={inputStyle} />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span style={labelStyle}>% del bote que se reparte (0–1)</span>
            <input type="number" min={0} max={1} step={0.05} value={cfg.payoutPercent}
              onChange={e => setCfg({ ...cfg, payoutPercent: Number(e.target.value) })} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1">
            <span style={labelStyle}>Redondear premio hacia abajo a</span>
            <input type="number" min={1} value={cfg.payoutRoundTo}
              onChange={e => setCfg({ ...cfg, payoutRoundTo: Number(e.target.value) })} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1">
            <span style={labelStyle}>Máx. quinielas con pago pendiente</span>
            <input type="number" min={1} value={cfg.maxPendingPerUser}
              onChange={e => setCfg({ ...cfg, maxPendingPerUser: Number(e.target.value) })} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1">
            <span style={labelStyle}>Moneda</span>
            <input type="text" value={cfg.currency} onChange={e => setCfg({ ...cfg, currency: e.target.value })} style={inputStyle} />
          </label>
        </div>
        <button onClick={handleSaveConfig} disabled={busy} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50"
          style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.05em' }}>
          <Save size={14} /> GUARDAR CONFIGURACIÓN
        </button>
      </section>

      {/* ── Results ── */}
      <section className="rounded-xl p-5" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-2">
          <ListChecks size={16} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.05em' }}>RESULTADOS REALES</span>
        </div>
        <p style={{ color: '#7eb89a', fontSize: '0.78rem', marginBottom: '14px' }}>
          Captura los resultados conforme avanza el torneo. Los puntajes se calculan en vivo a partir de aquí.
        </p>

        <div style={{ ...labelStyle, marginBottom: '8px' }}>FASE DE GRUPOS (posición exacta)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {GROUPS.map(g => {
            const gr = results.groups[g.id] ?? { first: '', second: '', third: '' };
            return (
              <div key={g.id} className="rounded-xl p-3" style={{ background: '#0b4730', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.8rem', letterSpacing: '0.08em', marginBottom: '8px' }}>GRUPO {g.id}</div>
                {(['first', 'second', 'third'] as const).map((pos, i) => (
                  <div key={pos} className="flex items-center gap-2 mb-1.5">
                    <span style={{ fontFamily: 'DM Mono', color: ['#f5a623', '#d4f226', '#9cc4b2'][i], fontSize: '0.7rem', minWidth: '18px' }}>{i + 1}°</span>
                    <select value={gr[pos]} onChange={e => setGroup(g.id, { [pos]: e.target.value })} style={inputStyle}>
                      <option value="">—</option>
                      {g.teams.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mb-5">
          <MultiTeam label="Mejores 3ros que avanzan a R32 (arma los cruces de las ligas aparte)" expected={8} value={results.bestThirds ?? []} onChange={v => setResults(r => ({ ...r, bestThirds: v }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <MultiTeam label="Avanzan de R32 (Dieciseisavos)" expected={16} value={results.r32Winners} onChange={v => setResults(r => ({ ...r, r32Winners: v }))} />
          <MultiTeam label="Avanzan de R16 (Octavos)" expected={8} value={results.r16Winners} onChange={v => setResults(r => ({ ...r, r16Winners: v }))} />
          <MultiTeam label="Avanzan de Cuartos" expected={4} value={results.qfWinners} onChange={v => setResults(r => ({ ...r, qfWinners: v }))} />
          <MultiTeam label="Avanzan de Semifinal (finalistas)" expected={2} value={results.sfWinners} onChange={v => setResults(r => ({ ...r, sfWinners: v }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {([['champion', '🏆 Campeón'], ['runnerUp', '🥈 Subcampeón'], ['thirdPlace', '🥉 Tercer lugar']] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span style={labelStyle}>{label}</span>
              <SingleTeam value={results[key]} onChange={v => setResults(r => ({ ...r, [key]: v }))} />
            </label>
          ))}
        </div>

        <button onClick={handleSaveResults} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.05em', border: '1px solid rgba(74,222,128,0.3)' }}>
          <Check size={14} /> GUARDAR RESULTADOS
        </button>
      </section>
    </div>
  );
}

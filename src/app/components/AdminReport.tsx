import { useEffect, useMemo, useState } from 'react';
import { Trophy, Download, RefreshCw, AlertCircle, Crown } from 'lucide-react';
import {
  getTeam, type AppConfig, type Results, type Prediction, type League, type PaymentStatus,
} from '../data/worldcup';
import { rankPredictions, prizePool } from '../../lib/scoring';
import { leagueLabel } from '../../lib/payment';
import {
  fetchAllPredictions, fetchAllUsers, setPaymentStatus, applyVoids, type UserDoc,
} from '../../lib/predictions';
import { recomputePublicStats } from '../../lib/stats';

const LEAGUES: { key: League; label: string }[] = [
  { key: 'main', label: 'Liga Principal' },
  { key: 'r32', label: 'Liga R32 (Dieciseisavos)' },
  { key: 'r16', label: 'Liga R16 (Octavos)' },
];

function money(n: number, currency: string) {
  return `${n.toLocaleString('es-MX')} ${currency}`;
}

function teamFlag(id: string) {
  return id ? `${getTeam(id).flag} ${getTeam(id).shortName}` : '—';
}

export function AdminReport({ config, results }: { config: AppConfig; results: Results }) {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [users, setUsers] = useState<Record<string, UserDoc>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function load() {
    setError(''); setBusy(true);
    try {
      const [allPreds, allUsers] = await Promise.all([fetchAllPredictions(), fetchAllUsers()]);
      setPreds(allPreds);
      setUsers(Object.fromEntries(allUsers.map(u => [u.uid, u])));
    } catch {
      setError('No se pudieron cargar los datos. Necesitas el permiso de administrador: ejecuta scripts/setAdmin.mjs con tu correo y vuelve a iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function who(p: Prediction) {
    const u = users[p.uid];
    return {
      name: p.userDisplayName || u?.displayName || '—',
      email: p.userEmail || u?.email || '',
      code: u?.shortCode || '',
    };
  }

  const feeFor = (l: League) => config.fees[l];

  async function changeStatus(predId: string, status: PaymentStatus) {
    setBusy(true);
    try { await setPaymentStatus(predId, status); await load(); }
    catch { setError('No se pudo actualizar el estado de pago.'); }
    finally { setBusy(false); }
  }

  async function runVoids() {
    setBusy(true); setNote('');
    try {
      const n = await applyVoids();
      setNote(n > 0 ? `${n} pronóstico(s) pendiente(s) anulado(s) por vencimiento.` : 'No hay pendientes vencidas que anular.');
      await load();
    } catch {
      setError('No se pudieron aplicar las anulaciones.');
    } finally { setBusy(false); }
  }

  async function runPublishStats() {
    setBusy(true); setNote('');
    try {
      await recomputePublicStats();
      setNote('Bote público actualizado. Ya se ve en el inicio de los participantes.');
    } catch {
      setError('No se pudo publicar el bote público.');
    } finally { setBusy(false); }
  }

  function exportCsv() {
    const rows = [['Folio', 'Liga', 'Pronostico', 'Nombre', 'Email', 'Codigo', 'EstadoPago', 'Puntos', 'Campeon', 'Subcampeon', 'Tercero', 'Creado']];
    for (const p of preds) {
      const w = who(p);
      const pts = rankPredictions([p], results)[0]?.leagueTotal ?? 0;
      rows.push([
        p.id, leagueLabel(p.league), p.name, w.name, w.email, w.code, p.paymentStatus, String(pts),
        getTeam(p.champion).shortName || '', getTeam(p.runnerUp).shortName || '', getTeam(p.thirdPlace).shortName || '',
        p.createdAt,
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pronosticos-reporte.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const standings = useMemo(() => {
    return LEAGUES.map(lg => {
      const paid = preds.filter(p => p.league === lg.key && p.paymentStatus === 'paid');
      const ranked = rankPredictions(paid, results);
      const pool = prizePool(paid.length, feeFor(lg.key), config.payoutPercent, config.payoutRoundTo);
      return { ...lg, ranked, pool, paidCount: paid.length };
    });
    // eslint-disable-next-line
  }, [preds, results, config]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy size={18} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.05em' }}>REPORTE GENERAL (PRIVADO)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50" style={{ background: '#0d5035', color: '#9cc4b2', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Oswald, sans-serif', fontSize: '0.76rem' }}>
            <RefreshCw size={13} /> ACTUALIZAR
          </button>
          <button onClick={runPublishStats} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50" style={{ background: 'rgba(245,166,35,0.12)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)', fontFamily: 'Oswald, sans-serif', fontSize: '0.76rem' }}>
            <Trophy size={13} /> PUBLICAR BOTE
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(212,242,38,0.12)', color: '#d4f226', border: '1px solid rgba(212,242,38,0.3)', fontFamily: 'Oswald, sans-serif', fontSize: '0.76rem' }}>
            <Download size={13} /> EXPORTAR CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.25)' }}>
          <AlertCircle size={15} style={{ color: '#e63946', marginTop: '2px', flexShrink: 0 }} />
          <span style={{ color: '#e63946', fontSize: '0.82rem' }}>{error}</span>
        </div>
      )}

      {/* ── Standings per league ── */}
      {standings.map(s => (
        <section key={s.key} className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.05em' }}>{s.label}</span>
            <div className="flex items-center gap-4" style={{ fontFamily: 'DM Mono', fontSize: '0.72rem' }}>
              <span style={{ color: '#7eb89a' }}>{s.paidCount} pagada(s)</span>
              <span style={{ color: '#9cc4b2' }}>Bote: {money(s.pool.gross, config.currency)}</span>
              <span style={{ color: '#d4f226' }}>Premio: {money(s.pool.prize, config.currency)}</span>
            </div>
          </div>
          {s.ranked.length === 0 ? (
            <div className="px-5 py-6 text-center" style={{ color: '#4a7d65', fontSize: '0.82rem' }}>Sin pronósticos pagados en esta liga.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: 'Nunito Sans' }}>
                <thead>
                  <tr style={{ color: '#4a7d65', fontFamily: 'DM Mono', fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                    {['#', 'PARTICIPANTE', 'PRONÓSTICO', 'CAMP', 'SUB', '3°', 'PTS'].map(h => (
                      <th key={h} className="text-left px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.ranked.map(({ prediction: p, leagueTotal, rank }) => {
                    const w = who(p);
                    const isWinner = rank === 1;
                    return (
                      <tr key={p.id} style={{ background: isWinner ? 'rgba(245,166,35,0.08)' : 'transparent' }}>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="flex items-center gap-1" style={{ color: isWinner ? '#f5a623' : '#7eb89a', fontFamily: 'Oswald, sans-serif', fontWeight: 700 }}>
                            {isWinner && <Crown size={12} />}{rank}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ color: '#e0f0e8', fontSize: '0.82rem', fontWeight: 600 }}>{w.name}</div>
                          <div style={{ color: '#4a7d65', fontSize: '0.66rem', fontFamily: 'DM Mono' }}>{w.code || w.email}</div>
                        </td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9cc4b2', fontSize: '0.78rem' }}>{p.name}</td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>{teamFlag(p.champion)}</td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>{teamFlag(p.runnerUp)}</td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>{teamFlag(p.thirdPlace)}</td>
                        <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ color: '#f5a623', fontFamily: 'Oswald, sans-serif', fontWeight: 700 }}>{leagueTotal}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {/* ── Payment management ── */}
      <section className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.05em' }}>PAGOS ({preds.length} entradas)</span>
          <button onClick={runVoids} disabled={busy} className="px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50" style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', border: '1px solid rgba(230,57,70,0.25)', fontFamily: 'Oswald, sans-serif', fontSize: '0.74rem' }}>
            ANULAR PENDIENTES VENCIDAS
          </button>
        </div>
        {note && <div className="px-5 py-2" style={{ color: '#9cc4b2', fontSize: '0.78rem' }}>{note}</div>}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: 'Nunito Sans' }}>
            <thead>
              <tr style={{ color: '#4a7d65', fontFamily: 'DM Mono', fontSize: '0.62rem' }}>
                {['FOLIO', 'LIGA', 'PRONÓSTICO', 'PARTICIPANTE', 'CUOTA', 'ESTADO'].map(h => (
                  <th key={h} className="text-left px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preds.map(p => {
                const w = who(p);
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#d4f226', fontSize: '0.72rem', fontFamily: 'DM Mono', whiteSpace: 'nowrap' }}>{p.id}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9cc4b2', fontSize: '0.74rem' }}>{leagueLabel(p.league)}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e0f0e8', fontSize: '0.78rem' }}>{p.name}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ color: '#c0d8cc', fontSize: '0.78rem' }}>{w.name}</div>
                      <div style={{ color: '#4a7d65', fontSize: '0.64rem', fontFamily: 'DM Mono' }}>{w.email}</div>
                    </td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9cc4b2', fontSize: '0.74rem', fontFamily: 'DM Mono' }}>{money(feeFor(p.league), config.currency)}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <select value={p.paymentStatus} disabled={busy} onChange={e => changeStatus(p.id, e.target.value as PaymentStatus)}
                        style={{ background: '#0b4730', color: '#e0f0e8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>
                        <option value="pending">pendiente</option>
                        <option value="paid">pagado</option>
                        <option value="void">anulada</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

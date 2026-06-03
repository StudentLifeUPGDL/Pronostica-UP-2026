import { useEffect, useMemo, useState } from 'react';
import { Dice5, RefreshCw, Download, AlertCircle, Trophy, Coffee } from 'lucide-react';
import {
  getTeam, POOL_CAPACITY,
  type AppConfig, type Results, type Ticket, type Pool, type PaymentStatus,
} from '../data/worldcup';
import { fetchAllTickets, fetchPools, setTicketPayment, rifaPlaces, rifaCashTotal } from '../../lib/rifa';
import { fetchAllUsers, type UserDoc } from '../../lib/predictions';

function money(n: number, currency: string) {
  return `${n.toLocaleString('es-MX')} ${currency}`;
}
function teamFlag(id: string) {
  return id ? `${getTeam(id).flag} ${getTeam(id).shortName}` : '—';
}

export function AdminRifa({ config, results }: { config: AppConfig; results: Results }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [users, setUsers] = useState<Record<string, UserDoc>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(''); setBusy(true);
    try {
      const [allTickets, allPools, allUsers] = await Promise.all([fetchAllTickets(), fetchPools(), fetchAllUsers()]);
      setTickets(allTickets);
      setPools(allPools);
      setUsers(Object.fromEntries(allUsers.map(u => [u.uid, u])));
    } catch {
      setError('No se pudieron cargar los boletos. Necesitas el permiso de administrador (scripts/setAdmin.mjs) y volver a iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function who(t: Ticket) {
    const u = users[t.uid];
    return {
      name: t.userDisplayName || u?.displayName || '—',
      email: t.userEmail || u?.email || '',
      code: u?.shortCode || '',
    };
  }

  async function changeStatus(id: string, status: PaymentStatus) {
    setBusy(true);
    try { await setTicketPayment(id, status); await load(); }
    catch { setError('No se pudo actualizar el estado de pago.'); }
    finally { setBusy(false); }
  }

  // Owner of the ticket holding a given team. The Rifa is a single 48-team raffle,
  // so each team is held by exactly one ticket once assigned.
  function holderOf(teamId: string) {
    if (!teamId) return null;
    const t = tickets.find(x => x.teamId === teamId);
    return t ? who(t) : null;
  }

  const places = useMemo(() => rifaPlaces(results), [results]);

  function exportCsv() {
    const rows = [['Folio', 'Pool', 'Equipo', 'Nombre', 'Email', 'Codigo', 'EstadoPago', 'Notificado', 'Creado', 'Pagado']];
    for (const t of tickets) {
      const w = who(t);
      rows.push([
        t.id, t.poolIndex ? `#${t.poolIndex}` : '', t.teamId ? getTeam(t.teamId).name : '',
        w.name, w.email, w.code, t.paymentStatus, t.notified ? 'sí' : 'no', t.createdAt, t.paidAt ?? '',
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rifa-boletos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const paidWaiting = tickets.filter(t => t.paymentStatus === 'paid' && !t.teamId).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Dice5 size={18} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.05em' }}>QUINIELA (PRIVADO)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50" style={{ background: '#0d5035', color: '#9cc4b2', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.76rem' }}>
            <RefreshCw size={13} /> ACTUALIZAR
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(212,242,38,0.12)', color: '#d4f226', border: '1px solid rgba(212,242,38,0.3)', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.76rem' }}>
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

      <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', color: '#c9b07e', fontSize: '0.8rem' }}>
        La asignación de equipos y los correos los hace el cron automático (GitHub Actions · <code style={{ color: '#d4f226' }}>manage-pools.yml</code>) cuando un pool junta {POOL_CAPACITY} boletos pagados.
        Aquí solo confirmas pagos. Boletos pagados esperando asignación: <strong style={{ color: '#f5a623' }}>{paidWaiting}</strong>.
      </div>

      {/* ── Pools overview ── */}
      <section className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.05em' }}>POOLS ({pools.length})</span>
        </div>
        {pools.length === 0 ? (
          <div className="px-5 py-6 text-center" style={{ color: '#4a7d65', fontSize: '0.82rem' }}>Aún no hay pools. Se crean solos cuando hay boletos pagados.</div>
        ) : (
          <div className="flex flex-col">
            {pools.map(pool => (
              <div key={pool.id} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#e0f0e8', fontSize: '0.9rem', letterSpacing: '0.04em' }}>
                  Pool #{pool.index}
                  <span style={{ color: pool.status === 'assigned' ? '#4ade80' : '#f5a623', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.68rem', marginLeft: '8px' }}>
                    {pool.status === 'assigned' ? 'ASIGNADO' : `${pool.paidCount}/${POOL_CAPACITY} ABIERTO`}
                  </span>
                </span>
                <span style={{ fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.68rem', color: '#7eb89a' }}>
                  {money((pool.fee ?? config.rifaFee) * POOL_CAPACITY, config.currency)} recaudado si se llena
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Prizes & winners ── */}
      <section className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(245,166,35,0.2)' }}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="flex items-center gap-2" style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.05em' }}>
            <Trophy size={15} /> PREMIOS Y GANADORES
          </span>
          <span style={{ fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.68rem', color: '#7eb89a' }}>
            Efectivo total: {money(rifaCashTotal(config.rifaPrizes), config.currency)} + vales Nessu
          </span>
        </div>
        <div className="flex flex-col">
          {([
            ['🏆 1° Campeón', places.first, config.rifaPrizes.first],
            ['🥈 2° Subcampeón', places.second, config.rifaPrizes.second],
            ['🥉 3° Tercer lugar', places.third, config.rifaPrizes.third],
            ['4° Cuarto lugar', places.fourth, config.rifaPrizes.fourth],
          ] as const).map(([label, teamId, amount], i) => {
            const w = holderOf(teamId);
            return (
              <div key={i} className="px-5 py-2.5 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#e0f0e8', fontSize: '0.82rem', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", letterSpacing: '0.02em', minWidth: '150px' }}>
                  {label} <span style={{ color: '#d4f226', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.7rem' }}>{money(amount, config.currency)}</span>
                </span>
                <span style={{ color: '#9cc4b2', fontSize: '0.78rem' }}>
                  {teamId ? <>{getTeam(teamId).flag} {getTeam(teamId).shortName} · </> : null}
                  {w ? <strong style={{ color: '#e0f0e8' }}>{w.name}</strong> : <span style={{ color: '#4a7d65' }}>{teamId ? 'sin boleto asignado' : 'por definir'}</span>}
                  {w?.email ? <span style={{ color: '#4a7d65', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.66rem' }}> · {w.email}</span> : null}
                </span>
              </div>
            );
          })}
          {(places.quartersOut.length > 0 || places.roundOf16Out.length > 0) && (
            <div className="px-5 py-3" style={{ background: 'rgba(212,242,38,0.04)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Coffee size={13} style={{ color: '#d4f226' }} />
                <span style={{ color: '#d4f226', fontSize: '0.74rem', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", letterSpacing: '0.04em' }}>
                  VALES NESSU 5°–16° ({money(config.rifaPrizes.consolation, config.currency)} c/u)
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {[...places.quartersOut, ...places.roundOf16Out].map(id => {
                  const w = holderOf(id);
                  return (
                    <div key={id} className="flex items-center gap-2" style={{ fontSize: '0.76rem', color: '#9cc4b2' }}>
                      <span style={{ minWidth: '110px' }}>{getTeam(id).flag} {getTeam(id).shortName}</span>
                      {w ? <strong style={{ color: '#e0f0e8' }}>{w.name}</strong> : <span style={{ color: '#4a7d65' }}>sin boleto asignado</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Ticket payment management ── */}
      <section className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.05em' }}>BOLETOS ({tickets.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'" }}>
            <thead>
              <tr style={{ color: '#4a7d65', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.62rem' }}>
                {['FOLIO', 'POOL', 'EQUIPO', 'PARTICIPANTE', 'CUOTA', 'COMPROBANTE', 'ESTADO'].map(h => (
                  <th key={h} className="text-left px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => {
                const w = who(t);
                return (
                  <tr key={t.id}>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#d4f226', fontSize: '0.72rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", whiteSpace: 'nowrap' }}>{t.id}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9cc4b2', fontSize: '0.74rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{t.poolIndex ? `#${t.poolIndex}` : '—'}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>{teamFlag(t.teamId)}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ color: '#c0d8cc', fontSize: '0.78rem' }}>{w.name}</div>
                      <div style={{ color: '#4a7d65', fontSize: '0.64rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{w.email}</div>
                    </td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9cc4b2', fontSize: '0.74rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{money(config.rifaFee, config.currency)}</td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {t.proofUrl
                        ? <a href={t.proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.72rem', textDecoration: 'underline' }}>ver</a>
                        : <span style={{ color: '#4a7d65', fontSize: '0.72rem' }}>—</span>}
                    </td>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <select value={t.paymentStatus} disabled={busy} onChange={e => changeStatus(t.id, e.target.value as PaymentStatus)}
                        style={{ background: '#0b4730', color: '#e0f0e8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.72rem' }}>
                        <option value="pending">pendiente</option>
                        <option value="review">en revisión</option>
                        <option value="paid">pagado</option>
                        <option value="void">anulado</option>
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

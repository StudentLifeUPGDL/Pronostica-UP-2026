import { useState } from 'react';
import {
  Ticket as TicketIcon, Dice5, Trash2, Copy, Check, Loader2, Sparkles, Info,
} from 'lucide-react';
import {
  getTeam, POOL_CAPACITY,
  type Ticket, type Pool, type AppConfig, type Results, type PaymentStatus,
} from '../data/worldcup';
import { poolPrize, teamStatus } from '../../lib/rifa';
import { buildPaymentFormUrl, paymentFormConfigured, RIFA_LABEL } from '../../lib/payment';

interface RifaPageProps {
  tickets: Ticket[];
  pools: Pool[];
  config: AppConfig;
  results: Results;
  email?: string;
  onBuy: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_STYLE: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'PAGO PENDIENTE', color: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  paid: { label: 'PAGADO', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  void: { label: 'ANULADO', color: '#e63946', bg: 'rgba(230,57,70,0.12)' },
};

function money(n: number, currency: string) {
  return `${n.toLocaleString('es-MX')} ${currency}`;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, fontSize: '0.6rem', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}

function FolioChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — folio still visible */ }
  }
  return (
    <button onClick={copy} title="Copiar folio"
      className="inline-flex items-center gap-1.5 rounded-md cursor-pointer transition-all"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'DM Mono', color: '#d4f226', fontSize: '0.72rem', padding: '3px 8px' }}>
      {id}
      {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} style={{ color: '#7eb89a' }} />}
    </button>
  );
}

function PaymentLink({ ticketId, email }: { ticketId: string; email?: string }) {
  const url = buildPaymentFormUrl(ticketId, RIFA_LABEL, email);
  if (!paymentFormConfigured || !url) {
    return <span style={{ color: '#4a7d65', fontSize: '0.7rem', fontFamily: 'DM Mono' }}>formulario de pago no configurado</span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg cursor-pointer transition-all"
      style={{ background: 'rgba(212,242,38,0.12)', color: '#d4f226', border: '1px solid rgba(212,242,38,0.3)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em', fontSize: '0.72rem', padding: '4px 10px' }}>
      CONFIRMAR TRANSFERENCIA
    </a>
  );
}

function TicketCard({ ticket, results, email, onDelete }: {
  ticket: Ticket; results: Results; email?: string; onDelete: () => void;
}) {
  const team = ticket.teamId ? getTeam(ticket.teamId) : null;
  const status = team ? teamStatus(ticket.teamId, results) : null;
  const canDelete = ticket.paymentStatus === 'pending' && !ticket.poolId;
  const poolLabel = ticket.teamId
    ? `Pool #${ticket.poolIndex} · asignado`
    : ticket.poolId
      ? `Pool #${ticket.poolIndex} · esperando llenarse`
      : 'Sin pool aún';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: `1px solid ${team ? 'rgba(245,166,35,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: team ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.05)', fontSize: team ? '1.6rem' : undefined }}>
          {team ? team.flag : <TicketIcon size={20} style={{ color: '#7eb89a' }} />}
        </div>
        <div className="flex-1 min-w-0">
          {team ? (
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '1.05rem', letterSpacing: '0.03em' }}>{team.name}</div>
          ) : (
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#9cc4b2', fontSize: '1rem', letterSpacing: '0.03em' }}>Equipo por asignar</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span style={{ color: '#7eb89a', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>{poolLabel}</span>
            <StatusBadge status={ticket.paymentStatus} />
          </div>
        </div>
        {status && (
          <div className="text-right">
            <div style={{ color: status.color, fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', letterSpacing: '0.02em' }}>{status.label}</div>
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center gap-2.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <FolioChip id={ticket.id} />
        {ticket.paymentStatus === 'pending' && <PaymentLink ticketId={ticket.id} email={email} />}
        <div className="flex-1" />
        {canDelete && (
          <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(230,57,70,0.08)', color: '#e63946', fontFamily: 'Oswald, sans-serif', fontSize: '0.72rem', letterSpacing: '0.05em', border: '1px solid rgba(230,57,70,0.15)' }}>
            <Trash2 size={12} /> ELIMINAR
          </button>
        )}
      </div>
    </div>
  );
}

export function RifaPage({ tickets, pools, config, results, email, onBuy, onDelete }: RifaPageProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The pool currently filling (status 'open'); if none yet, show a 0/48 placeholder.
  const openPool = [...pools].filter(p => p.status === 'open').sort((a, b) => b.index - a.index)[0];
  const assignedPools = pools.filter(p => p.status === 'assigned').length;
  const currentIndex = openPool?.index ?? assignedPools + 1;
  const filled = openPool?.paidCount ?? 0;
  const progress = Math.min(100, Math.round((filled / POOL_CAPACITY) * 100));

  // Estimated prize for a FULL pool at the current fee/split (display).
  const samplePool: Pool = openPool ?? {
    id: '', index: currentIndex, status: 'open', capacity: POOL_CAPACITY,
    paidCount: filled, fee: config.rifaFee, payoutSplit: config.rifaPayoutSplit, createdAt: '',
  };
  const prize = poolPrize(samplePool, config.payoutPercent, config.payoutRoundTo);

  async function handleBuy() {
    setBusy(true); setError('');
    try { await onBuy(); }
    catch (e) { setError((e as Error).message ?? 'No se pudo comprar el boleto.'); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    setError('');
    try { await onDelete(id); }
    catch (e) { setError((e as Error).message ?? 'No se pudo eliminar el boleto.'); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <Dice5 size={22} style={{ color: '#f5a623' }} />
        <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>RIFA DE PAÍSES</h1>
      </div>
      <p style={{ color: '#7eb89a', fontSize: '0.85rem', marginBottom: '20px', maxWidth: '640px' }}>
        El modo tradicional: compra un boleto y se te asigna <strong style={{ color: '#d4f226' }}>una selección al azar</strong> del
        Mundial. Cuando un pool junta <strong>{POOL_CAPACITY} boletos pagados</strong>, se reparten los {POOL_CAPACITY} equipos al
        instante y te llega un correo con el tuyo. Puedes comprar <strong>los boletos que quieras</strong> y entrar a varios pools.
      </p>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.25)', color: '#e63946', fontSize: '0.82rem' }}>{error}</div>
      )}

      {/* ── Current pool + buy ── */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, #0d5035, #0b4730)', border: '1px solid rgba(245,166,35,0.25)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '1.1rem', letterSpacing: '0.04em' }}>POOL ACTUAL · #{currentIndex}</div>
            <div style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'DM Mono' }}>{filled}/{POOL_CAPACITY} boletos pagados</div>
          </div>
          <div className="text-right">
            <div style={{ color: '#4a7d65', fontSize: '0.64rem', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>PREMIO ESTIMADO (POOL LLENO)</div>
            <div style={{ color: '#d4f226', fontFamily: 'Oswald, sans-serif', fontSize: '1.05rem', fontWeight: 700 }}>{money(prize.distributable, config.currency)}</div>
          </div>
        </div>

        <div className="h-3 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #f5a623, #d4f226)' }} />
        </div>
        <div className="flex items-center justify-between mb-4" style={{ fontFamily: 'DM Mono', fontSize: '0.66rem', color: '#7eb89a' }}>
          <span>{progress}%</span>
          <span>faltan {Math.max(0, POOL_CAPACITY - filled)} para asignar</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleBuy} disabled={busy}
            className="flex items-center gap-2 px-5 py-3 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            COMPRAR BOLETO · {money(config.rifaFee, config.currency)}
          </button>
          <div className="flex items-center gap-1.5" style={{ color: '#7eb89a', fontSize: '0.74rem' }}>
            <Info size={13} />
            <span>Reparto del bote: {(config.rifaPayoutSplit[0] ?? 0) * 100}% campeón · {(config.rifaPayoutSplit[1] ?? 0) * 100}% subcampeón · {(config.rifaPayoutSplit[2] ?? 0) * 100}% 3°</span>
          </div>
        </div>
      </div>

      {/* ── My tickets ── */}
      <div className="flex items-center gap-2 mb-3">
        <TicketIcon size={16} style={{ color: '#f5a623' }} />
        <h2 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.05em' }}>MIS BOLETOS ({tickets.length})</h2>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#0d5035', border: '2px dashed rgba(245,166,35,0.2)' }}>
          <Dice5 size={40} style={{ color: '#2a5a3a', margin: '0 auto 14px' }} />
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#4a7d65', fontSize: '1.05rem', letterSpacing: '0.05em', marginBottom: '6px' }}>AÚN NO TIENES BOLETOS</div>
          <p style={{ color: '#3a6b55', fontSize: '0.84rem' }}>Compra tu primer boleto y deja que la suerte te dé tu selección.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map(t => (
            <TicketCard key={t.id} ticket={t} results={results} email={email} onDelete={() => handleDelete(t.id)} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl p-4" style={{ background: 'rgba(13,80,53,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ color: '#7eb89a', fontSize: '0.8rem' }}>
          <strong style={{ color: '#f5a623' }}>¿Cómo se asignan los equipos?</strong> Tras confirmar tu transferencia, tu boleto entra
          al pool actual. Cuando el pool llega a {POOL_CAPACITY} boletos <strong>pagados</strong>, el sistema sortea los {POOL_CAPACITY} equipos
          automáticamente (sorteo verificable con semilla), te avisa por correo y abre el siguiente pool. El pago real de premios lo
          coordina el organizador como en el resto de la quiniela.
        </p>
      </div>
    </div>
  );
}

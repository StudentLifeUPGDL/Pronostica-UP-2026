import { useState } from 'react';
import { Plus, Trophy, Trash2, Edit3, Star, ChevronRight, Lock, Swords, Copy, Check, UploadCloud, Clock, XCircle } from 'lucide-react';
import { type Prediction, type Results, type PaymentStatus, type League, getTeam, computeEliminatedTeams } from '../data/worldcup';
import { computeScore, leagueScore, POINTS, type ScoreBreakdown } from '../../lib/scoring';
import { leagueLabel, paymentConfigured } from '../../lib/payment';
import { PaymentCta } from './PaymentCta';

// Have any real results been loaded yet? Before kickoff everything is zeros/placeholders,
// so we show an explanatory note instead of a wall of "0 pts".
function tournamentStarted(r: Results): boolean {
  return Object.keys(r.groups).length > 0
    || (r.r32Winners?.length ?? 0) > 0 || (r.r16Winners?.length ?? 0) > 0
    || (r.qfWinners?.length ?? 0) > 0 || (r.sfWinners?.length ?? 0) > 0
    || !!r.champion;
}

// ─── Per-pick status (correct / eliminated / still alive) ──────────────────────
type PickStatus = 'correct' | 'eliminated' | 'alive' | 'pending';

function pickStatus(teamId: string, correct: boolean, eliminated: Set<string>, started: boolean): PickStatus {
  if (!teamId) return 'pending';
  if (correct) return 'correct';
  if (eliminated.has(teamId)) return 'eliminated';
  return started ? 'alive' : 'pending';
}

// A picked team shown with its live status: green when it landed exactly, struck through
// with an "ELIMINADO" tag when it's already out, otherwise neutral.
function PickTeam({ teamId, prefix, status }: { teamId: string; prefix?: string; status: PickStatus }) {
  const team = getTeam(teamId);
  const out = status === 'eliminated';
  const color = status === 'correct' ? '#4ade80' : out ? '#e07a82' : '#e0f0e8';
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span style={{ fontSize: '0.85rem' }}>{prefix}</span>}
      <span style={{ opacity: out ? 0.55 : 1 }}>{team.flag}</span>
      <span style={{
        fontSize: '0.8rem', color, fontFamily: "'Twemoji Country Flags', 'Nunito Sans'", fontWeight: 600,
        textDecoration: out ? 'line-through' : 'none', textDecorationColor: 'rgba(224,122,130,0.7)',
      }}>
        {team.shortName}
      </span>
      {status === 'correct' && <Check size={13} style={{ color: '#4ade80' }} />}
      {out && (
        <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(230,57,70,0.14)', color: '#e07a82', fontSize: '0.54rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", letterSpacing: '0.04em' }}>
          ELIMINADO
        </span>
      )}
    </div>
  );
}

// ─── Score breakdown ("cómo voy") ──────────────────────────────────────────────
const BREAKDOWN_ROWS: { key: keyof ScoreBreakdown; label: string; unit: number; binary?: boolean }[] = [
  { key: 'groups', label: 'Grupos', unit: POINTS.groupExact },
  { key: 'r32', label: 'Dieciseisavos', unit: POINTS.r32 },
  { key: 'r16', label: 'Octavos', unit: POINTS.r16 },
  { key: 'qf', label: 'Cuartos', unit: POINTS.qf },
  { key: 'sf', label: 'Semifinales', unit: POINTS.sf },
  { key: 'champion', label: 'Campeón', unit: POINTS.champion, binary: true },
  { key: 'runnerUp', label: 'Subcampeón', unit: POINTS.runnerUp, binary: true },
  { key: 'thirdPlace', label: 'Tercer lugar', unit: POINTS.thirdPlace, binary: true },
];

function inLeagueScope(key: keyof ScoreBreakdown, league: League): boolean {
  if (league === 'r32') return key !== 'groups';
  if (league === 'r16') return key !== 'groups' && key !== 'r32';
  return true;
}

function ScoreBreakdownPanel({ entry, results, accent }: { entry: Prediction; results: Results; accent: string }) {
  const started = tournamentStarted(results);
  const bd = computeScore(entry, results);
  const leaguePts = leagueScore(bd, entry.league);
  const rows = BREAKDOWN_ROWS.filter(r => inLeagueScope(r.key, entry.league));

  return (
    <div className="rounded-lg" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy size={12} style={{ color: accent }} />
        <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: accent, fontSize: '0.72rem', letterSpacing: '0.1em' }}>CÓMO VOY</span>
      </div>
      {!started ? (
        <p style={{ color: '#7eb89a', fontSize: '0.74rem' }}>
          Aún no hay resultados cargados. Aquí verás tus aciertos y puntos ronda por ronda conforme avance el Mundial.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map(r => {
            const pts = bd[r.key];
            const hit = pts > 0;
            const aciertos = r.unit ? Math.round(pts / r.unit) : 0;
            return (
              <div key={r.key} className="flex items-center gap-2" style={{ fontSize: '0.72rem' }}>
                <span style={{ flex: 1, color: '#c0d8cc', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'" }}>{r.label}</span>
                <span style={{ color: hit ? '#4ade80' : '#4a7d65', fontFamily: "'Twemoji Country Flags', 'DM Mono'", minWidth: '78px', textAlign: 'right' }}>
                  {r.binary ? (hit ? 'acertado ✓' : '—') : (aciertos > 0 ? `${aciertos} acierto${aciertos > 1 ? 's' : ''}` : '—')}
                </span>
                <span style={{ color: hit ? '#e0f0e8' : '#4a7d65', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, minWidth: '46px', textAlign: 'right' }}>
                  {pts} pts
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 mt-1 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ flex: 1, color: accent, fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.78rem', letterSpacing: '0.06em' }}>TOTAL</span>
            <span style={{ color: accent, fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{leaguePts} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MyPredictionsProps {
  predictions: Prediction[];
  results: Results;
  email?: string;
  lockPassed: boolean;
  r32JoinOpen: boolean;
  r16JoinOpen: boolean;
  maxPending: number;
  onNew: () => void;
  onEdit: (prediction: Prediction) => void;
  onDelete: (id: string) => void;
  onJoin: (round: 'r32' | 'r16') => void;
  onConfirmPayment: () => void;
}

const STATUS_STYLE: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'PAGO PENDIENTE', color: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  review: { label: 'CONFIRMANDO PAGO', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  paid: { label: 'PAGADO', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  void: { label: 'ANULADO', color: '#e63946', bg: 'rgba(230,57,70,0.12)' },
};

// Below the folio: the pay link while pending, or a "comprobante en revisión" note
// once the proof has been uploaded (review). Nothing once paid/void.
function PaymentRow({ entry, email }: { entry: Prediction; email?: string }) {
  if (entry.paymentStatus === 'review') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg"
        style={{ background: 'rgba(96,165,250,0.1)', color: '#7cc0ff', border: '1px solid rgba(96,165,250,0.3)', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", letterSpacing: '0.03em', fontSize: '0.72rem', padding: '4px 10px' }}>
        <Clock size={12} /> Comprobante enviado · en revisión
      </span>
    );
  }
  return <PaymentCta prediction={entry} email={email} />;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, fontSize: '0.6rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'", letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}

// Shows the entry's unique ID (folio) with a copy button. This is the same value
// the payment Google Form receives pre-filled, so quoting it lets the organizer
// match a transfer to this exact quiniela.
function FolioRow({ id, hint, compact }: { id: string; hint?: boolean; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context) — folio is still visible to copy by hand
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#7eb89a', fontSize: compact ? '0.58rem' : '0.62rem', letterSpacing: '0.1em' }}>FOLIO</span>
      <button onClick={copy} title="Copiar folio"
        className="inline-flex items-center gap-1.5 rounded-md cursor-pointer transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          fontFamily: "'Twemoji Country Flags', 'DM Mono'", color: '#d4f226',
          fontSize: compact ? '0.66rem' : '0.74rem', padding: compact ? '2px 7px' : '4px 9px',
        }}>
        {id}
        {copied
          ? <Check size={compact ? 11 : 12} style={{ color: '#4ade80' }} />
          : <Copy size={compact ? 11 : 12} style={{ color: '#7eb89a' }} />}
      </button>
      {copied && <span style={{ color: '#4ade80', fontSize: '0.62rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>copiado</span>}
      {hint && !copied && (
        <span style={{ color: '#4a7d65', fontSize: '0.66rem', fontFamily: "'Twemoji Country Flags', 'Nunito Sans'" }}>
          úsalo como referencia de tu pago
        </span>
      )}
    </div>
  );
}

function PodiumRow({ prediction, results, eliminated }: { prediction: Prediction; results: Results; eliminated: Set<string> }) {
  if (!prediction.champion) return null;
  const started = tournamentStarted(results);
  const slots = [
    { emoji: '🏆', teamId: prediction.champion, correct: !!results.champion && prediction.champion === results.champion },
    { emoji: '🥈', teamId: prediction.runnerUp, correct: !!results.runnerUp && prediction.runnerUp === results.runnerUp },
    { emoji: '🥉', teamId: prediction.thirdPlace, correct: !!results.thirdPlace && prediction.thirdPlace === results.thirdPlace },
  ];
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {slots.map(s => s.teamId
        ? <PickTeam key={s.emoji} teamId={s.teamId} prefix={s.emoji} status={pickStatus(s.teamId, s.correct, eliminated, started)} />
        : null)}
    </div>
  );
}

function SoloCard({ entry, results, eliminated, email, joinOpen, onEdit, onDelete }: {
  entry: Prediction;
  results: Results;
  eliminated: Set<string>;
  email?: string;
  joinOpen: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pts = leagueScore(computeScore(entry, results), entry.league);
  const createdAt = new Date(entry.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(192,132,252,0.25)' }}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(192,132,252,0.15)' }}>
          <Swords size={18} style={{ color: '#c084fc' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#e0f0e8', fontSize: '1rem', letterSpacing: '0.03em' }}>{entry.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ color: '#a07bd0', fontSize: '0.68rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>{leagueLabel(entry.league)}</span>
            <StatusBadge status={entry.paymentStatus} />
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#c084fc', fontSize: '1.2rem', fontWeight: 700 }}>{pts}</div>
          <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>PTS</div>
        </div>
      </div>

      <div className="px-5 pb-4"><PodiumRow prediction={entry} results={results} eliminated={eliminated} /></div>

      <div className="px-5 pb-4"><ScoreBreakdownPanel entry={entry} results={results} accent="#c084fc" /></div>

      <div className="px-5 pb-3 flex flex-col gap-2.5">
        <FolioRow id={entry.id} hint={entry.paymentStatus === 'pending'} />
        <PaymentRow entry={entry} email={email} />
      </div>

      <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ color: '#4a7d65', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.7rem' }}>Creado {createdAt}</span>
        <div className="flex-1" />
        {joinOpen ? (
          <>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(192,132,252,0.12)', color: '#c084fc', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(192,132,252,0.25)' }}>
              <Edit3 size={12} /> EDITAR
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(230,57,70,0.08)', color: '#e63946', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(230,57,70,0.15)' }}>
              <Trash2 size={12} /> ELIMINAR
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ color: '#4a7d65', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            <Lock size={11} /> BLOQUEADO
          </span>
        )}
      </div>
    </div>
  );
}

function MainCard({ main, results, eliminated, email, lockPassed, onEdit, onDelete }: {
  main: Prediction;
  results: Results;
  eliminated: Set<string>;
  email?: string;
  lockPassed: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pts = computeScore(main, results).total;
  const createdAt = new Date(main.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.15)' }}>
          <Star size={18} style={{ color: '#f5a623' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#e0f0e8', fontSize: '1rem', letterSpacing: '0.03em' }}>{main.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>Creado {createdAt}</span>
            <StatusBadge status={main.paymentStatus} />
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '1.2rem', fontWeight: 700 }}>{pts}</div>
          <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: "'Twemoji Country Flags', 'DM Mono'" }}>PTS</div>
        </div>
      </div>

      <div className="px-5 pb-4"><PodiumRow prediction={main} results={results} eliminated={eliminated} /></div>

      <div className="px-5 pb-4"><ScoreBreakdownPanel entry={main} results={results} accent="#f5a623" /></div>

      <div className="px-5 pb-3 flex flex-col gap-2.5">
        <FolioRow id={main.id} hint={main.paymentStatus === 'pending'} />
        <PaymentRow entry={main} email={email} />
      </div>

      {expanded && (
        <div className="px-5 pb-4">
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }} />
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#7eb89a', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '10px' }}>PICKS DE GRUPOS</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(main.groups).map(([gId, gPick]) => {
              const actual = results.groups[gId];
              const picks = [
                { pos: 1, teamId: gPick.first, correct: !!actual && !!gPick.first && gPick.first === actual.first },
                { pos: 2, teamId: gPick.second, correct: !!actual && !!gPick.second && gPick.second === actual.second },
              ];
              return (
                <div key={gId} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.68rem', marginBottom: '4px', letterSpacing: '0.1em' }}>GR. {gId}</div>
                  {picks.map(({ pos, teamId, correct }) => {
                    if (!teamId) return null;
                    const team = getTeam(teamId);
                    const out = !correct && eliminated.has(teamId);
                    const nameColor = correct ? '#4ade80' : out ? '#e07a82' : '#c0d8cc';
                    return (
                      <div key={pos} className="flex items-center gap-1">
                        <span style={{ fontFamily: "'Twemoji Country Flags', 'DM Mono'", color: pos === 1 ? '#f5a623' : '#d4f226', fontSize: '0.62rem' }}>{pos}°</span>
                        <span style={{ fontSize: '0.82rem', opacity: out ? 0.55 : 1 }}>{team.flag}</span>
                        <span style={{ fontSize: '0.68rem', color: nameColor, fontFamily: "'Twemoji Country Flags', 'Nunito Sans'", textDecoration: out ? 'line-through' : 'none', textDecorationColor: 'rgba(224,122,130,0.7)' }}>{team.shortName}</span>
                        {correct && <Check size={11} style={{ color: '#4ade80' }} />}
                        {out && <XCircle size={10} style={{ color: '#e07a82' }} />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 cursor-pointer" style={{ color: '#7eb89a', fontFamily: "'Twemoji Country Flags', 'DM Mono'", fontSize: '0.72rem' }}>
          {expanded ? 'ocultar detalles ▲' : 'ver detalles ▼'}
        </button>
        <div className="flex-1" />
        {lockPassed ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ color: '#4a7d65', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            <Lock size={11} /> BLOQUEADO
          </span>
        ) : (
          <>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(245,166,35,0.2)' }}>
              <Edit3 size={12} /> EDITAR
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(230,57,70,0.08)', color: '#e63946', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontSize: '0.75rem', letterSpacing: '0.05em', border: '1px solid rgba(230,57,70,0.15)' }}>
              <Trash2 size={12} /> ELIMINAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MyPredictions({
  predictions, results, email, lockPassed,
  r32JoinOpen, r16JoinOpen, maxPending,
  onNew, onEdit, onDelete, onJoin, onConfirmPayment,
}: MyPredictionsProps) {
  const mains = predictions.filter(p => p.league === 'main');
  // Standalone side-league entries (R32 / R16 tournaments, independent of the main).
  const solos = predictions.filter(p => p.league !== 'main');
  // Teams already knocked out of the tournament — used to flag eliminated picks.
  const eliminated = computeEliminatedTeams(results);
  const pendingCount = mains.filter(p => p.paymentStatus === 'pending').length;
  // Any unpaid entry (main or side-league) → offer the "subir comprobante" shortcut.
  const anyPending = predictions.some(p => p.paymentStatus === 'pending');
  // The pending cap only applies once payments are live (a payment link is set);
  // while it isn't, registration is unlimited.
  const capActive = paymentConfigured;
  const newDisabled = lockPassed || (capActive && pendingCount >= maxPending);
  const joinOpenFor = (l: Prediction['league']) => (l === 'r32' ? r32JoinOpen : r16JoinOpen);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>MIS PRONÓSTICOS</h1>
          <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginTop: '4px' }}>
            {mains.length} pronóstico{mains.length !== 1 ? 's' : ''}{capActive ? ` · ${pendingCount}/${maxPending} con pago pendiente` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-stretch sm:items-end">
          <button
            onClick={onNew}
            disabled={newDisabled}
            title={lockPassed ? 'El torneo ya inició' : capActive && pendingCount >= maxPending ? `Máximo ${maxPending} pendientes` : ''}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#f5a623', color: '#062b1a', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
            <Plus size={16} /> NUEVO PRONÓSTICO
          </button>
          {capActive && anyPending && (
            <button
              onClick={onConfirmPayment}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
              style={{ background: 'rgba(212,242,38,0.12)', color: '#d4f226', border: '1px solid rgba(212,242,38,0.35)', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em' }}>
              <UploadCloud size={16} /> YA PAGUÉ · SUBIR COMPROBANTE
            </button>
          )}
        </div>
      </div>

      {mains.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#0d5035', border: '2px dashed rgba(245,166,35,0.2)' }}>
          <Trophy size={48} style={{ color: '#2a5a3a', margin: '0 auto 16px' }} />
          <div style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#4a7d65', fontSize: '1.2rem', letterSpacing: '0.05em', marginBottom: '8px' }}>AÚN NO TIENES PRONÓSTICOS</div>
          <p style={{ color: '#3a6b55', fontSize: '0.85rem', marginBottom: '20px' }}>Crea tu primer pronóstico antes de que inicie el Mundial.</p>
          <button onClick={onNew} disabled={newDisabled} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl cursor-pointer disabled:opacity-40" style={{ background: '#f5a623', color: '#062b1a', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.9rem' }}>
            <Plus size={18} /> CREAR PRIMER PRONÓSTICO
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mains.map(main => (
            <MainCard
              key={main.id}
              main={main}
              results={results}
              eliminated={eliminated}
              email={email}
              lockPassed={lockPassed}
              onEdit={() => onEdit(main)}
              onDelete={() => onDelete(main.id)}
            />
          ))}
        </div>
      )}

      {mains.length > 0 && (
        <div className="mt-6 rounded-xl p-4" style={{ background: 'rgba(13,80,53,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ChevronRight size={14} style={{ color: '#f5a623' }} />
            <span style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#f5a623', fontSize: '0.85rem', letterSpacing: '0.06em' }}>CÓMO FUNCIONA</span>
          </div>
          <p style={{ color: '#7eb89a', fontSize: '0.8rem' }}>
            Tus puntos se actualizan con los resultados reales. Además del pronóstico principal, puedes
            entrar a las <strong style={{ color: '#c084fc' }}>Ligas Aparte</strong> (R32 y R16): torneos
            independientes de la eliminatoria, cada uno con su propio premio. La clasificación general es
            privada del organizador.
          </p>
        </div>
      )}

      {/* ── Ligas aparte (standalone side-leagues, no main needed) ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Swords size={16} style={{ color: '#c084fc' }} />
          <h2 style={{ fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", color: '#c084fc', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.04em' }}>LIGAS APARTE</h2>
        </div>
        <p style={{ color: '#7eb89a', fontSize: '0.8rem', marginBottom: '14px' }}>
          Compite solo en la eliminatoria, <strong style={{ color: '#c084fc' }}>sin necesidad del pronóstico principal</strong>. Eliges una
          combinación que arma tu cuadro; los equipos se actualizan solos conforme llegan los resultados, y
          puedes ajustar hasta antes del primer partido de la ronda.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {([['r32', 'UNIRME A R32 · DIECISEISAVOS', r32JoinOpen], ['r16', 'UNIRME A R16 · OCTAVOS', r16JoinOpen]] as const).map(([round, label, open]) => (
            <button key={round} onClick={() => onJoin(round)} disabled={!open}
              title={!open ? 'La ventana de esta liga ya cerró' : ''}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.35)', fontFamily: "'Twemoji Country Flags', 'Oswald', sans-serif", fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em' }}>
              <Plus size={15} /> {label}
            </button>
          ))}
        </div>

        {solos.length > 0 ? (
          <div className="flex flex-col gap-3">
            {solos.map(s => (
              <SoloCard
                key={s.id}
                entry={s}
                results={results}
                eliminated={eliminated}
                email={email}
                joinOpen={joinOpenFor(s.league)}
                onEdit={() => onEdit(s)}
                onDelete={() => onDelete(s.id)}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: '#4a7d65', fontSize: '0.78rem', fontStyle: 'italic' }}>
            Aún no participas en ninguna liga aparte.
          </p>
        )}
      </div>
    </div>
  );
}

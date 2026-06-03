import { useState, useMemo, Dispatch, SetStateAction } from 'react';
import {
  ChevronLeft, ChevronRight, Save, Check, CheckCircle2, Copy, Trophy, Star,
  XCircle, MapPin, Calendar, Lock, AlertCircle,
} from 'lucide-react';
import {
  GROUPS, OFFICIAL_R32, R16_PAIRS, QF_PAIRS, SF_PAIRS, FINAL_INFO, BRONZE_INFO,
  getTeam, makeFolio, Prediction, GroupPick, TeamSlot, Results, EMPTY_RESULTS,
} from '../data/worldcup';
import { resolveBest3rdAllocation } from '../data/r32ThirdsAllocation';
import { PaymentCta } from './PaymentCta';

// ─── Step config ──────────────────────────────────────────────────────────────

type Step = 'grupos' | 'terceros' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
const STEPS: Step[] = ['grupos', 'terceros', 'r32', 'r16', 'qf', 'sf', 'final'];
const STEP_LABELS: Record<Step, string> = {
  grupos:   'GRUPOS',
  terceros: '3° LUGAR',
  r32:      'DIECISÉISAVOS',
  r16:      'OCTAVOS',
  qf:       'CUARTOS',
  sf:       'SEMIFINAL',
  final:    'FINAL',
};

interface BracketWizardProps {
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  mode?: 'main' | 'joinR32' | 'joinR16';
  basePrediction?: Prediction | null;   // entry being edited (main or standalone side-league)
  results?: Results;                     // real results, overlaid onto side-league brackets
  onSave: (prediction: Prediction) => void | Promise<void>;
  onCancel: () => void;
  predictionName?: string;
}

// ─── BracketWizard ────────────────────────────────────────────────────────────

export function BracketWizard({
  userId, userEmail, userDisplayName,
  mode = 'main', basePrediction, results = EMPTY_RESULTS,
  onSave, onCancel, predictionName = 'Mi Pronóstico',
}: BracketWizardProps) {
  const name = mode === 'main' ? (basePrediction?.name ?? predictionName) : predictionName;

  // A standalone "join" entry (R32/R16 side-league): the player builds the whole
  // combination, and `overlay` means real tournament results progressively replace
  // the earlier-round picks (auto-update) so late joiners pick teams that advanced.
  const isJoin = mode === 'joinR32' || mode === 'joinR16';
  const overlay = isJoin;
  const entryRound: 'r32' | 'r16' | null =
    mode === 'joinR32' ? 'r32' : mode === 'joinR16' ? 'r16' : null;

  const realGroups = results.groups ?? {};
  const realBestThirds = results.bestThirds ?? [];
  const realR32Winners = results.r32Winners ?? [];
  const groupsAllReal = Object.keys(realGroups).length >= 12;
  const thirdsAllReal = realBestThirds.length >= 8;
  const r32AllReal = realR32Winners.length >= 16;

  // A join entry leaves the earlier phases editable (the combination) but locks each
  // one as its REAL result lands: groups → terceros → R32.
  const lockedSteps: Step[] = (() => {
    if (!isJoin) return [];
    const locked: Step[] = [];
    if (groupsAllReal) locked.push('grupos');
    if (thirdsAllReal) locked.push('terceros');
    if (mode === 'joinR16' && r32AllReal) locked.push('r32');
    return locked;
  })();
  const firstEditable: Step = STEPS.find(s => !lockedSteps.includes(s)) ?? 'grupos';
  const isLocked = (s: Step) => lockedSteps.includes(s);
  const [step, setStep] = useState<Step>(firstEditable);
  const [activeGroup, setActiveGroup] = useState('A');
  const [navError, setNavError] = useState('');
  // Save lifecycle: while saving, buttons disable; on success `saved` holds the
  // persisted entry so we can show the confirmation screen (with its folio).
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState<{ pred: Prediction; isEdit: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Prediction state ─────────────────────────────────────────────────────

  const [groups,         setGroups]        = useState<Record<string, GroupPick>>(basePrediction?.groups ?? {});
  const [elim3rd,        setElim3rd]       = useState<string[]>(basePrediction?.eliminatedThird ?? []);
  const [r32,            setR32]           = useState<Record<string, string>>(basePrediction?.r32 ?? {});
  const [r16,            setR16]           = useState<Record<string, string>>(basePrediction?.r16 ?? {});
  const [qf,             setQf]            = useState<Record<string, string>>(basePrediction?.qf ?? {});
  const [sf,             setSf]            = useState<Record<string, string>>(basePrediction?.sf ?? {});
  const [champion,       setChampion]      = useState(basePrediction?.champion ?? '');
  const [runnerUp,       setRunnerUp]      = useState(basePrediction?.runnerUp ?? '');
  const [thirdPlace,     setThirdPlace]    = useState(basePrediction?.thirdPlace ?? '');

  // ─── Derived data ─────────────────────────────────────────────────────────

  // For side-league entries, real group results override the player's combination
  // as they arrive; `main` entries are pre-tournament and never overlaid.
  const effectiveGroups = useMemo<Record<string, GroupPick>>(
    () => (overlay ? { ...groups, ...realGroups } : groups),
    [overlay, groups, realGroups],
  );

  // Once the real set of advancing thirds is published, it overrides the player's
  // elimination guess (eliminated = the group thirds that did NOT advance).
  const effectiveElim = useMemo<string[]>(() => {
    // Only override once the full real set of 8 advancing thirds is published.
    if (!overlay || realBestThirds.length < 8) return elim3rd;
    const thirds = GROUPS.map(g => effectiveGroups[g.id]?.third).filter(Boolean) as string[];
    return thirds.filter(t => !realBestThirds.includes(t));
  }, [overlay, realBestThirds, effectiveGroups, elim3rd]);

  const allThirds = useMemo(() =>
    GROUPS.map(g => ({ group: g.id, teamId: effectiveGroups[g.id]?.third ?? '' })).filter(t => t.teamId),
    [effectiveGroups],
  );

  const advancingThirds = useMemo(() =>
    allThirds.filter(t => !effectiveElim.includes(t.teamId)),
    [allThirds, effectiveElim],
  );

  // R32 best-third matchups are NOT a guess. Once the 8 advancing thirds are
  // known, FIFA's regulations (Annex C, 495 pre-published scenarios) fix exactly
  // which third plays each "group winner vs best third" match. So we derive the
  // assignment automatically from the (effective) group + 3rd-place data instead of
  // asking them to slot teams by hand.  matchId → teamId of the assigned third.
  const r32Thirds = useMemo<Record<string, string>>(() => {
    const advGroups = advancingThirds.map(t => t.group);
    if (advGroups.length !== 8) return {};
    const alloc = resolveBest3rdAllocation(advGroups); // matchId → group letter
    if (!alloc) return {};
    const out: Record<string, string> = {};
    for (const [matchId, groupId] of Object.entries(alloc)) {
      const teamId = effectiveGroups[groupId]?.third;
      if (teamId) out[matchId] = teamId;
    }
    return out;
  }, [advancingThirds, effectiveGroups]);

  // Resolve a slot to a team ID (uses the real-overlaid groups/thirds).
  function resolveSlot(slot: TeamSlot, matchId: string): string | undefined {
    if (slot.type === 'pos') {
      const pick = effectiveGroups[slot.group];
      if (!pick) return undefined;
      return (slot.pos === 1 ? pick.first : pick.second) || undefined;
    }
    return r32Thirds[matchId] || undefined;
  }

  // R16 matchups need each R32 match's winner. For an R16 side-league entry those
  // come from the REAL R32 results once known (each match's real winner is the one
  // participant that appears in r32Winners); otherwise the player's own R32 picks.
  const effectiveR32 = useMemo<Record<string, string>>(() => {
    if (entryRound !== 'r16' || realR32Winners.length === 0) return r32;
    const winners = new Set(realR32Winners);
    const out: Record<string, string> = { ...r32 };
    for (const m of OFFICIAL_R32) {
      const home = resolveSlot(m.home, m.id);
      const away = resolveSlot(m.away, m.id);
      const realWinner = [home, away].find(t => t && winners.has(t));
      if (realWinner) out[m.id] = realWinner;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryRound, realR32Winners, r32, effectiveGroups, r32Thirds]);

  // ─── Step completion ──────────────────────────────────────────────────────

  function gruposComplete() {
    return GROUPS.every(g => {
      const p = effectiveGroups[g.id];
      return p?.first && p?.second && p?.third;
    });
  }
  function tercerosComplete() { return effectiveElim.length === 4; }
  function r32Complete() {
    return OFFICIAL_R32.every(m => {
      const homeId = resolveSlot(m.home, m.id);
      const awayId = resolveSlot(m.away, m.id);
      if (!homeId || !awayId) return false;
      // The winner must be one of the two teams actually playing this match,
      // so changing earlier picks invalidates a now-impossible winner.
      return effectiveR32[m.id] === homeId || effectiveR32[m.id] === awayId;
    });
  }
  function r16Complete() { return R16_PAIRS.every(p => r16[p.id]); }
  function qfComplete()  { return QF_PAIRS.every(p => qf[p.id]); }
  function sfComplete()  { return SF_PAIRS.every(p => sf[p.id]); }
  function finalComplete(){ return !!champion; }

  function isStepComplete(s: Step): boolean {
    switch (s) {
      case 'grupos':   return gruposComplete();
      case 'terceros': return tercerosComplete();
      case 'r32':      return r32Complete();
      case 'r16':      return r16Complete();
      case 'qf':       return qfComplete();
      case 'sf':       return sfComplete();
      case 'final':    return finalComplete();
    }
  }

  // A step is accessible if all previous steps are complete
  function isStepAccessible(s: Step): boolean {
    const idx = STEPS.indexOf(s);
    for (let i = 0; i < idx; i++) {
      if (!isStepComplete(STEPS[i])) return false;
    }
    return true;
  }

  function getMissingMessage(s: Step): string {
    switch (s) {
      case 'grupos': {
        const miss = GROUPS.filter(g => { const p = effectiveGroups[g.id]; return !p?.first || !p?.second || !p?.third; });
        return `Completa los grupos: ${miss.map(g => g.id).join(', ')}`;
      }
      case 'terceros':
        return `Elimina ${4 - effectiveElim.length} equipo(s) más`;
      case 'r32': {
        const pending = OFFICIAL_R32.filter(m => {
          const homeId = resolveSlot(m.home, m.id);
          const awayId = resolveSlot(m.away, m.id);
          return !homeId || !awayId || (effectiveR32[m.id] !== homeId && effectiveR32[m.id] !== awayId);
        });
        return `Selecciona el ganador de ${pending.length} partido(s)`;
      }
      case 'r16': {
        const n = R16_PAIRS.filter(p => !r16[p.id]).length;
        return `Selecciona ${n} ganador(es) de octavos`;
      }
      case 'qf': {
        const n = QF_PAIRS.filter(p => !qf[p.id]).length;
        return `Selecciona ${n} ganador(es) de cuartos`;
      }
      case 'sf': {
        const n = SF_PAIRS.filter(p => !sf[p.id]).length;
        return `Selecciona ${n} finalista(s)`;
      }
      case 'final': return 'Selecciona al campeón del mundo';
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  const stepIdx = STEPS.indexOf(step);

  function handleNext() {
    if (!isStepComplete(step)) {
      setNavError(getMissingMessage(step));
      return;
    }
    setNavError('');
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  }

  function handlePrev() {
    setNavError('');
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  }

  function handleStepClick(s: Step) {
    if (!isStepAccessible(s) && STEPS.indexOf(s) > stepIdx) {
      setNavError(getMissingMessage(step));
      return;
    }
    setNavError('');
    setStep(s);
  }

  async function handleSave() {
    if (saving) return;
    const league: 'main' | 'r32' | 'r16' =
      mode === 'joinR32' ? 'r32' : mode === 'joinR16' ? 'r16' : 'main';
    // Re-editing an existing entry (a main, or a standalone side-league entry) keeps
    // its folio, creation time and payment status.
    const isEdit = !!basePrediction && basePrediction.league === league;
    // Re-edits keep their folio; new entries get a short, human-friendly one.
    const id = isEdit ? basePrediction!.id : makeFolio(league);
    const nowIso = new Date().toISOString();
    const pred: Prediction = {
      id,
      uid: userId,
      userEmail,
      userDisplayName,
      name,
      league,
      createdAt: isEdit ? basePrediction!.createdAt : nowIso,
      updatedAt: nowIso,
      groups: effectiveGroups, eliminatedThird: effectiveElim, r32Thirds,
      r32: effectiveR32, r16, qf, sf, champion, runnerUp, thirdPlace,
      paymentStatus: isEdit ? basePrediction!.paymentStatus : 'pending',
      paidAt: isEdit ? basePrediction!.paidAt : undefined,
      points: isEdit ? basePrediction!.points : 0,
    };
    setSaving(true);
    setSaveError('');
    try {
      await onSave(pred);
      // Keep the wizard mounted and reveal the confirmation screen with the folio.
      setSaved({ pred, isEdit });
    } catch (e) {
      setSaveError((e as Error)?.message ?? 'No se pudo guardar el pronóstico.');
    } finally {
      setSaving(false);
    }
  }

  async function copyFolio() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.pred.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable (insecure context) — folio is still visible to copy by hand
    }
  }

  // ─── Group picks ──────────────────────────────────────────────────────────

  // A group whose REAL result is already in can't be edited (it shows reality).
  const groupLocked = (groupId: string) => overlay && !!realGroups[groupId];

  function getGroupPos(groupId: string, teamId: string): '1°' | '2°' | '3°' | '' {
    const g = effectiveGroups[groupId];
    if (!g) return '';
    if (g.first  === teamId) return '1°';
    if (g.second === teamId) return '2°';
    if (g.third  === teamId) return '3°';
    return '';
  }

  function pickGroupTeam(groupId: string, teamId: string) {
    if (groupLocked(groupId)) return;
    const group = GROUPS.find(g => g.id === groupId)!;
    const cur = groups[groupId] ?? { first: '', second: '', third: '' };
    let { first, second, third } = cur;

    if      (teamId === first)  first  = '';
    else if (teamId === second) second = '';
    else if (teamId === third)  third  = '';
    else if (!first)            first  = teamId;
    else if (!second)           second = teamId;
    else if (!third)            third  = teamId;
    else                        third  = teamId;

    const picked = [first, second, third].filter(Boolean);
    const remaining = group.teams.map(t => t.id).filter(id => !picked.includes(id));
    if (!third && picked.length === 2 && remaining.length === 1) third = remaining[0];

    setGroups(g => ({ ...g, [groupId]: { first, second, third } }));
  }

  // ─── 3rd elimination ──────────────────────────────────────────────────────

  function toggleElim(teamId: string) {
    setElim3rd(prev => {
      if (prev.includes(teamId)) return prev.filter(id => id !== teamId);
      if (prev.length >= 4)      return prev;
      return [...prev, teamId];
    });
  }

  // ─── Winner pickers ───────────────────────────────────────────────────────

  function pickR32(matchId: string, teamId: string) {
    setR32(p => ({ ...p, [matchId]: teamId }));
    setNavError('');
  }

  // ─── STEP RENDERS ─────────────────────────────────────────────────────────

  function renderGrupos() {
    const group = GROUPS.find(g => g.id === activeGroup)!;

    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>
          Elige <strong style={{ color: '#f5a623' }}>1°</strong>, <strong style={{ color: '#d4f226' }}>2°</strong> y <strong style={{ color: '#9cc4b2' }}>3°</strong> lugar en cada uno de los 12 grupos.
          Los primeros dos avanzan directamente; el 3° puede pasar como mejor 3ro.
        </p>

        {/* Group tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {'ABCDEFGHIJKL'.split('').map(g => {
            const gp = effectiveGroups[g];
            const ok = gp?.first && gp?.second && gp?.third;
            return (
              <button key={g} onClick={() => setActiveGroup(g)}
                className="w-10 h-10 rounded-lg cursor-pointer transition-all relative"
                style={{
                  fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', fontWeight: 700,
                  background: activeGroup === g ? '#f5a623' : '#0d5035',
                  color: activeGroup === g ? '#062b1a' : ok ? '#c0d8cc' : '#7eb89a',
                  border: ok && activeGroup !== g ? '1.5px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                {g}
                {ok && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: '#4ade80' }} />}
              </button>
            );
          })}
        </div>

        {/* Active group */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#083524', border: '1px solid rgba(245,166,35,0.15)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(245,166,35,0.07)', borderBottom: '1px solid rgba(245,166,35,0.12)' }}>
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.06em' }}>
              GRUPO {activeGroup}
            </span>
            <span style={{ color: '#4a7d65', fontSize: '0.68rem', fontFamily: 'DM Mono' }}>Toca para asignar posición</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {group.teams.map(team => {
              const pos = getGroupPos(activeGroup, team.id);
              const clr: Record<string, string> = { '1°': '#f5a623', '2°': '#d4f226', '3°': '#9cc4b2' };
              const pc = clr[pos] ?? '';
              return (
                <button key={team.id} onClick={() => pickGroupTeam(activeGroup, team.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left cursor-pointer transition-all"
                  style={{
                    background: pos ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: pos ? `1.5px solid ${pc}35` : '1px solid rgba(255,255,255,0.05)',
                  }}>
                  <span className="text-2xl">{team.flag}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.9rem', color: '#e0f0e8', fontFamily: 'Nunito Sans, sans-serif', fontWeight: 600 }}>{team.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#3a6b55', fontFamily: 'DM Mono' }}>{team.confederation}</div>
                  </div>
                  {pos && (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${pc}18`, border: `1.5px solid ${pc}40` }}>
                      <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', color: pc, fontWeight: 700 }}>{pos}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {GROUPS.map(g => {
            const gp = effectiveGroups[g.id];
            const ok = gp?.first && gp?.second && gp?.third;
            return (
              <button key={g.id} onClick={() => setActiveGroup(g.id)}
                className="rounded-lg p-2.5 text-left cursor-pointer transition-all"
                style={{
                  background: activeGroup === g.id ? 'rgba(245,166,35,0.08)' : '#0d5035',
                  border: activeGroup === g.id ? '1px solid rgba(245,166,35,0.25)' : ok ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.68rem', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  GR. {g.id}
                </div>
                {(['first','second','third'] as const).map((pos, pi) => {
                  const tid = gp?.[pos];
                  const t = tid ? getTeam(tid) : null;
                  const pc = ['#f5a623','#d4f226','#9cc4b2'][pi];
                  return (
                    <div key={pos} className="flex items-center gap-1">
                      <span style={{ fontFamily: 'DM Mono', fontSize: '0.56rem', color: pc, minWidth: '14px' }}>{pi+1}°</span>
                      {t ? (<><span style={{ fontSize: '0.78rem' }}>{t.flag}</span><span style={{ fontSize: '0.65rem', color: '#a0c4b0', fontFamily: 'Nunito Sans' }}>{t.shortName}</span></>)
                         : (<span style={{ fontSize: '0.6rem', color: '#2a4a3a', fontStyle: 'italic' }}>—</span>)}
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── TERCEROS ────────────────────────────────────────────────────────────

  function renderTerceros() {
    const done = elim3rd.length === 4;
    const advancing = allThirds.filter(t => !elim3rd.includes(t.teamId));

    return (
      <div>
        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={14} style={{ color: '#e63946' }} />
            <span style={{ fontFamily: 'Oswald, sans-serif', color: '#e63946', fontSize: '0.88rem', letterSpacing: '0.05em' }}>
              SELECCIONA 4 TERCEROS QUE NO AVANZAN
            </span>
          </div>
          <p style={{ color: '#9cc4b2', fontSize: '0.8rem', fontFamily: 'Nunito Sans, sans-serif' }}>
            De los 12 equipos en 3er lugar, <strong style={{ color: '#4ade80' }}>8 avanzan</strong> a dieciséisavos y <strong style={{ color: '#e63946' }}>4 son eliminados</strong>. Haz clic en los 4 que no pasan.
          </p>
        </div>

        {/* Counters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', color: '#4ade80', fontWeight: 700, lineHeight: 1 }}>
              {advancing.length}<span style={{ fontSize: '0.8rem', color: '#1a5a3a' }}>/8</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#7eb89a', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginTop: '2px' }}>AVANZAN</div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(230,57,70,0.06)', border: `1px solid ${done ? 'rgba(230,57,70,0.4)' : 'rgba(230,57,70,0.15)'}` }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', color: '#e63946', fontWeight: 700, lineHeight: 1 }}>
              {elim3rd.length}<span style={{ fontSize: '0.8rem', color: '#5a1a1a' }}>/4</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#e63946', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginTop: '2px' }}>ELIMINADOS</div>
          </div>
        </div>

        {allThirds.length < 12 && (
          <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.15)' }}>
            <AlertCircle size={14} style={{ color: '#f5a623' }} />
            <span style={{ color: '#f5a623', fontSize: '0.8rem', fontFamily: 'Nunito Sans' }}>
              Regresa a Grupos para completarlos ({allThirds.length}/12 asignados).
            </span>
          </div>
        )}

        {/* 12 thirds grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GROUPS.map(g => {
            const gp = effectiveGroups[g.id];
            const teamId = gp?.third ?? '';
            const team = teamId ? getTeam(teamId) : null;
            const isElim = elim3rd.includes(teamId);
            const canElim = !isElim && elim3rd.length < 4 && !!teamId;

            return (
              <button key={g.id}
                onClick={() => teamId && toggleElim(teamId)}
                disabled={!teamId || (!canElim && !isElim)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  cursor: teamId && (canElim || isElim) ? 'pointer' : 'default',
                  background: isElim ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isElim ? '1.5px solid rgba(230,57,70,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  opacity: !teamId ? 0.35 : 1,
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isElim ? 'rgba(230,57,70,0.15)' : 'rgba(245,166,35,0.1)' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', fontWeight: 700,
                    color: isElim ? '#e63946' : '#f5a623' }}>{g.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {team ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{team.flag}</span>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'Nunito Sans', fontWeight: 600,
                          color: isElim ? '#e63946' : '#e0f0e8' }}>{team.name}</span>
                      </div>
                      <div style={{ fontSize: '0.63rem', color: isElim ? '#a03040' : '#3a6b55', fontFamily: 'DM Mono' }}>
                        3° Grupo {g.id}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#2a5040', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans' }}>Sin asignar (completa el grupo {g.id})</span>
                  )}
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: isElim ? 'rgba(230,57,70,0.15)' : teamId ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: isElim ? '#e63946' : '#4ade80', fontFamily: 'DM Mono', fontSize: '0.6rem' }}>
                  {isElim ? 'ELIMINADO' : teamId ? 'AVANZA' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Advancing summary */}
        {advancing.length > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: '#083524', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>
              EQUIPOS QUE AVANZAN ({advancing.length}/8)
            </div>
            <div className="flex flex-wrap gap-2">
              {advancing.map(t => {
                const team = getTeam(t.teamId);
                return (
                  <div key={t.teamId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
                    <span>{team.flag}</span>
                    <span style={{ fontSize: '0.75rem', color: '#4ade80', fontFamily: 'Nunito Sans', fontWeight: 600 }}>{team.shortName}</span>
                    <span style={{ fontSize: '0.58rem', color: '#2a5a3a', fontFamily: 'DM Mono' }}>3°{t.group}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── R32 ─────────────────────────────────────────────────────────────────

  function renderR32() {
    // Group by date
    const byDate = OFFICIAL_R32.reduce<Record<string, typeof OFFICIAL_R32>>((acc, m) => {
      (acc[m.date] ??= []).push(m);
      return acc;
    }, {});

    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>
          Los cruces se arman <span style={{ color: '#c084fc' }}>automáticamente</span> con tus picks de grupos
          y terceros: el equipo <span style={{ color: '#c084fc' }}>3° mejor</span> de cada partido lo define el
          reglamento oficial de la FIFA, no tú. Solo elige al ganador de cada partido.
          <br />
          <span style={{ color: '#4a7d65', fontSize: '0.72rem' }}>Fechas y horarios oficiales (hora del centro de México).</span>
        </p>

        <div className="flex flex-col gap-6">
          {Object.entries(byDate).map(([date, matches]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={12} style={{ color: '#f5a623' }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.82rem', letterSpacing: '0.08em' }}>
                  {date.toUpperCase()}
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matches.map(m => {
                  const homeId = resolveSlot(m.home, m.id);
                  const awayId = resolveSlot(m.away, m.id);
                  // For a best-3rd away slot, which group did the auto-assigned third come from.
                  const awayThirdGroup = m.away.type === 'best3rd'
                    ? advancingThirds.find(t => t.teamId === awayId)?.group
                    : undefined;

                  return (
                    <div key={m.id} className="rounded-xl overflow-hidden flex flex-col"
                      style={{ background: '#0b4730', border: r32[m.id] ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>

                      {/* Match header */}
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2"
                        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
                          P{m.matchNum}
                        </span>
                        <div className="flex items-center gap-2">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                            <Calendar size={8} />{m.date} · {m.time}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono',
                            maxWidth: '110px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            <MapPin size={8} />{m.stadium}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 flex flex-col gap-2 flex-1">
                        {/* Home team (always a position slot) */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {homeId ? (
                            <>
                              <span className="text-base">{getTeam(homeId).flag}</span>
                              <span style={{ fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: '#c0d8cc' }}>
                                {getTeam(homeId).name}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#3a6b55', fontFamily: 'DM Mono', fontStyle: 'italic' }}>
                              {m.home.type === 'pos' ? `1° Gr.${m.home.group}` : '?'} — pendiente
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#3a6b55', fontFamily: 'DM Mono' }}>
                            {m.home.type === 'pos' ? `${m.home.pos}°${m.home.group}` : ''}
                          </span>
                        </div>

                        <div className="text-center" style={{ color: '#2a5a3a', fontSize: '0.62rem', fontFamily: 'DM Mono', letterSpacing: '0.1em' }}>
                          VS
                        </div>

                        {/* Away slot — positional or auto-assigned best third (read-only) */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {awayId ? (
                            <>
                              <span className="text-base">{getTeam(awayId).flag}</span>
                              <span style={{ fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: '#c0d8cc' }}>
                                {getTeam(awayId).name}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: m.away.type === 'best3rd' ? '#c084fc' : '#3a6b55', fontFamily: 'DM Mono' }}>
                                {m.away.type === 'pos' ? `${m.away.pos}°${m.away.group}` : `3°${awayThirdGroup ?? ''}`}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#3a6b55', fontFamily: 'DM Mono', fontStyle: 'italic' }}>
                              {m.away.type === 'pos' ? `${m.away.pos}°Gr.${m.away.group}` : '3° mejor'} — pendiente
                            </span>
                          )}
                        </div>

                        {/* Winner picker — only when both teams are known */}
                        {homeId && awayId && (
                          <>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />
                            <div style={{ fontSize: '0.62rem', color: '#4a7d65', fontFamily: 'DM Mono', letterSpacing: '0.06em' }}>
                              GANADOR:
                            </div>
                            <div className="flex gap-1.5">
                              {[homeId, awayId].map(tid => {
                                const t = getTeam(tid);
                                const sel = r32[m.id] === tid;
                                return (
                                  <button key={tid} onClick={() => pickR32(m.id, tid)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg cursor-pointer transition-all"
                                    style={{
                                      background: sel ? 'rgba(245,166,35,0.18)' : 'rgba(255,255,255,0.03)',
                                      border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                    <span style={{ fontSize: '0.9rem' }}>{t.flag}</span>
                                    <span style={{ fontSize: '0.72rem', color: sel ? '#f5a623' : '#9cc4b2', fontFamily: 'Nunito Sans', fontWeight: 600 }}>
                                      {t.shortName}
                                    </span>
                                    {sel && <Check size={11} style={{ color: '#f5a623' }} />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── R16 ─────────────────────────────────────────────────────────────────

  function renderRound<P extends { id: string; matchNum: number; date: string; time: string; stadium: string }>(
    pairs: P[],
    getTeamA: (pair: P) => string | undefined,
    getTeamB: (pair: P) => string | undefined,
    picks: Record<string, string>,
    setPicks: Dispatch<SetStateAction<Record<string, string>>>,
  ) {
    // Group matches by date (same date separators as the R32 step).
    const byDate = pairs.reduce<Record<string, P[]>>((acc, pair) => {
      (acc[pair.date] ??= []).push(pair);
      return acc;
    }, {});

    return (
      <div className="flex flex-col gap-6">
        {Object.entries(byDate).map(([date, entries]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={12} style={{ color: '#f5a623' }} />
              <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.82rem', letterSpacing: '0.08em' }}>
                {date.toUpperCase()}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entries.map(pair => {
                const homeId = getTeamA(pair);
                const awayId = getTeamB(pair);
                const winner = picks[pair.id];
                const both   = homeId && awayId;
                return (
                  <div key={pair.id} className="rounded-xl overflow-hidden"
                    style={{ background: '#0b4730', border: winner ? '1px solid rgba(245,166,35,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2"
                style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
                  P{pair.matchNum}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono' }}>
                    <Calendar size={8} />{pair.date} · {pair.time}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#4a7d65', fontSize: '0.6rem', fontFamily: 'DM Mono',
                    maxWidth: '120px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <MapPin size={8} />{pair.stadium}
                  </span>
                </div>
              </div>
              <div className="p-2.5 flex flex-col gap-1.5">
                {both ? (
                  <>
                    {[homeId, awayId].map(tid => {
                      const t = getTeam(tid!);
                      const sel = winner === tid;
                      return (
                        <button key={tid} onClick={() => { setPicks(p => ({ ...p, [pair.id]: tid! })); setNavError(''); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left cursor-pointer transition-all"
                          style={{
                            background: sel ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.03)',
                            border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.05)',
                          }}>
                          <span className="text-xl">{t.flag}</span>
                          <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600,
                            color: sel ? '#f5a623' : '#c0d8cc' }}>{t.name}</span>
                          {sel && <Check size={13} style={{ color: '#f5a623' }} />}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="py-3 text-center" style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans' }}>
                    Completa la fase anterior
                  </div>
                )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderR16() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige el ganador de cada octavo de final.</p>
        {renderRound(
          R16_PAIRS,
          p => effectiveR32[p.r32a],
          p => effectiveR32[p.r32b],
          r16, setR16,
        )}
      </div>
    );
  }

  function renderQF() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige los cuatro semifinalistas.</p>
        {renderRound(
          QF_PAIRS,
          p => r16[p.r16a],
          p => r16[p.r16b],
          qf, setQf,
        )}
      </div>
    );
  }

  function renderSF() {
    return (
      <div>
        <p style={{ color: '#7eb89a', fontSize: '0.82rem', marginBottom: '14px' }}>Elige los dos finalistas.</p>
        {renderRound(
          SF_PAIRS,
          p => qf[p.qfa],
          p => qf[p.qfb],
          sf, setSf,
        )}
      </div>
    );
  }

  // ─── FINAL ────────────────────────────────────────────────────────────────

  function renderFinal() {
    const f1 = sf['sf-1'];
    const f2 = sf['sf-2'];
    const sf1Loser = f1 ? (qf['qf-1'] === f1 ? qf['qf-2'] : qf['qf-1']) : undefined;
    const sf2Loser = f2 ? (qf['qf-3'] === f2 ? qf['qf-4'] : qf['qf-3']) : undefined;

    return (
      <div>
        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)' }}>
          <Trophy size={28} style={{ color: '#f5a623', margin: '0 auto 6px' }} />
          <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.1rem', letterSpacing: '0.08em' }}>GRAN FINAL · P{FINAL_INFO.matchNum}</div>
          <p style={{ color: '#4a7d65', fontSize: '0.7rem', fontFamily: 'DM Mono', marginTop: '2px' }}>
            {FINAL_INFO.date} 2026 · {FINAL_INFO.time} h · {FINAL_INFO.stadium}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '8px' }}>🏆 FINAL — CAMPEÓN</div>
            <div className="grid grid-cols-1 gap-1.5">
              {[f1, f2].filter(Boolean).map(tid => {
                const t = getTeam(tid!);
                const sel = champion === tid;
                return (
                  <button key={tid} onClick={() => { setChampion(tid!); setRunnerUp(tid === f1 ? (f2 ?? '') : (f1 ?? '')); setNavError(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                    style={{ background: sel ? 'rgba(245,166,35,0.15)' : '#0b4730', border: sel ? '1.5px solid rgba(245,166,35,0.5)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-xl">{t.flag}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: sel ? '#f5a623' : '#c0d8cc' }}>{t.name}</span>
                    {sel && <><Check size={13} style={{ color: '#f5a623' }} /><span style={{ fontSize: '0.65rem', color: '#f5a623', fontFamily: 'DM Mono' }}>CAMPEÓN</span></>}
                  </button>
                );
              })}
              {!f1 && !f2 && <div style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans', textAlign: 'center', padding: '12px' }}>Completa las semis primero</div>}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#9cc4b2', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '2px' }}>🥉 3ER Y 4TO LUGAR · P{BRONZE_INFO.matchNum}</div>
            <div style={{ color: '#4a7d65', fontSize: '0.62rem', fontFamily: 'DM Mono', marginBottom: '8px' }}>{BRONZE_INFO.date} 2026 · {BRONZE_INFO.time} h · {BRONZE_INFO.stadium}</div>
            <div className="grid grid-cols-1 gap-1.5">
              {[sf1Loser, sf2Loser].filter(Boolean).map(tid => {
                const t = getTeam(tid!);
                const sel = thirdPlace === tid;
                return (
                  <button key={tid} onClick={() => { setThirdPlace(tid!); setNavError(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                    style={{ background: sel ? 'rgba(155,155,155,0.12)' : '#0b4730', border: sel ? '1.5px solid rgba(155,155,155,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-xl">{t.flag}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'Nunito Sans', fontWeight: 600, color: sel ? '#9cc4b2' : '#c0d8cc' }}>{t.name}</span>
                    {sel && <><Check size={13} style={{ color: '#9cc4b2' }} /><span style={{ fontSize: '0.65rem', color: '#9cc4b2', fontFamily: 'DM Mono' }}>3° LUG.</span></>}
                  </button>
                );
              })}
              {(!sf1Loser || !sf2Loser) && <div style={{ color: '#3a6b55', fontSize: '0.78rem', fontStyle: 'italic', fontFamily: 'Nunito Sans', textAlign: 'center', padding: '12px' }}>Completa las semis primero</div>}
            </div>
          </div>
        </div>

        {champion && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.78rem', letterSpacing: '0.08em', marginBottom: '8px' }}>RESUMEN</div>
            {[{ label: '🏆 Campeón', id: champion }, { label: '🥈 Subcampeón', id: runnerUp }, { label: '🥉 3er Lugar', id: thirdPlace }].map(({ label, id }) => {
              const t = id ? getTeam(id) : null;
              return (
                <div key={label} className="flex items-center gap-2 mb-1.5">
                  <span style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans', minWidth: '110px' }}>{label}</span>
                  {t ? <><span>{t.flag}</span><span style={{ fontSize: '0.88rem', color: '#e0f0e8', fontFamily: 'Nunito Sans', fontWeight: 600 }}>{t.name}</span></>
                     : <span style={{ color: '#2a5040', fontSize: '0.78rem', fontStyle: 'italic' }}>—</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const currentComplete = isStepComplete(step);
  const isLast = stepIdx === STEPS.length - 1;

  // ── Confirmation screen (shown after a successful save) ──
  if (saved) {
    const showPayment = saved.pred.paymentStatus !== 'paid';
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0d5035', border: '1px solid rgba(74,222,128,0.25)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(74,222,128,0.12)' }}>
            <CheckCircle2 size={30} style={{ color: '#4ade80' }} />
          </div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#4ade80', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            {saved.isEdit ? '¡PRONÓSTICO ACTUALIZADO!' : '¡PRONÓSTICO GUARDADO!'}
          </h1>
          <p style={{ color: '#9cc4b2', fontSize: '0.86rem', marginTop: '6px' }}>{saved.pred.name}</p>

          {/* Folio */}
          <div className="mt-6 rounded-xl p-5" style={{ background: '#083524', border: '1px solid rgba(245,166,35,0.25)' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '0.7rem', letterSpacing: '0.12em', marginBottom: '10px' }}>TU FOLIO</div>
            <button onClick={copyFolio} title="Copiar folio"
              className="inline-flex items-center gap-2.5 rounded-xl cursor-pointer transition-all"
              style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', padding: '10px 18px', fontFamily: 'DM Mono', color: '#f5a623', fontSize: '1.4rem', letterSpacing: '0.06em' }}>
              {saved.pred.id}
              {copied ? <Check size={18} style={{ color: '#4ade80' }} /> : <Copy size={18} style={{ color: '#9cc4b2' }} />}
            </button>
            <div style={{ color: copied ? '#4ade80' : '#4a7d65', fontSize: '0.72rem', fontFamily: 'DM Mono', marginTop: '10px' }}>
              {copied ? '✓ copiado al portapapeles' : 'toca para copiar'}
            </div>
          </div>

          {showPayment ? (
            <>
              <p style={{ color: '#c0d8cc', fontSize: '0.84rem', marginTop: '18px', lineHeight: 1.6 }}>
                Anota tu folio: lo necesitas para <strong style={{ color: '#d4f226' }}>confirmar tu pago</strong>. Ya viene
                incluido en el formulario, pero guárdalo por si tienes que escribirlo a mano.
              </p>
              <div className="mt-4 flex justify-center">
                <PaymentCta prediction={saved.pred} email={userEmail} />
              </div>
            </>
          ) : (
            <p style={{ color: '#c0d8cc', fontSize: '0.84rem', marginTop: '18px' }}>
              Este pronóstico ya está pagado. Tu folio queda como referencia.
            </p>
          )}

          <button onClick={onCancel}
            className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl cursor-pointer"
            style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.86rem', letterSpacing: '0.05em' }}>
            IR A MIS PRONÓSTICOS <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.04em' }}>{name}</h1>
          <p style={{ color: mode === 'main' ? '#4a7d65' : '#c084fc', fontSize: '0.7rem', fontFamily: 'DM Mono' }}>
            {mode === 'main'
              ? (userDisplayName ?? '')
              : `LIGA APARTE · ${entryRound === 'r32' ? 'DIECISEISAVOS (R32)' : 'OCTAVOS (R16)'}`}
          </p>
        </div>
        <button onClick={onCancel} style={{ color: '#7eb89a', fontSize: '0.76rem', fontFamily: 'DM Mono', cursor: 'pointer' }}>← Volver</button>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const done = isStepComplete(s);
          const accessible = isStepAccessible(s);
          const isCurrent = step === s;
          const locked = !accessible && !isCurrent;
          return (
            <div key={s} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleStepClick(s)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all"
                style={{
                  cursor: locked ? 'not-allowed' : 'pointer',
                  fontFamily: 'Oswald, sans-serif', fontSize: '0.64rem', letterSpacing: '0.07em',
                  background: isCurrent ? '#f5a623' : done ? 'rgba(74,222,128,0.12)' : locked ? 'rgba(255,255,255,0.03)' : '#083524',
                  color: isCurrent ? '#062b1a' : done ? '#4ade80' : locked ? '#2a4a3a' : '#4a7d65',
                  border: done && !isCurrent ? '1px solid rgba(74,222,128,0.2)' : locked ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  opacity: locked ? 0.5 : 1,
                }}>
                {locked ? <Lock size={8} /> : done && !isCurrent ? <Check size={9} /> : null}
                {STEP_LABELS[s]}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={9} style={{ color: '#1a4a2a', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl p-5 mb-4" style={{ background: '#083524', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Star size={13} style={{ color: '#f5a623' }} />
          <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.95rem', letterSpacing: '0.06em' }}>
            {STEP_LABELS[step]}
          </span>
          {/* Completion badge */}
          <span className="ml-auto px-2 py-0.5 rounded-full"
            style={{
              background: currentComplete ? 'rgba(74,222,128,0.1)' : 'rgba(245,166,35,0.08)',
              color: currentComplete ? '#4ade80' : '#f5a623',
              fontSize: '0.62rem', fontFamily: 'DM Mono',
            }}>
            {currentComplete ? '✓ completo' : getMissingMessage(step).split(' ').slice(0, 4).join(' ') + '…'}
          </span>
        </div>

        {isLocked(step) ? (
          <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)' }}>
            <Lock size={20} style={{ color: '#c084fc', margin: '0 auto 8px' }} />
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#c084fc', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              FASE DEFINIDA
            </div>
            <p style={{ color: '#9cc4b2', fontSize: '0.82rem', marginTop: '6px', fontFamily: 'Nunito Sans' }}>
              Los resultados reales ya definieron esta fase. Avanza para armar tu cuadro desde {STEP_LABELS[firstEditable]}.
            </p>
          </div>
        ) : (
          <>
            {step === 'grupos'   && renderGrupos()}
            {step === 'terceros' && renderTerceros()}
            {step === 'r32'      && renderR32()}
            {step === 'r16'      && renderR16()}
            {step === 'qf'       && renderQF()}
            {step === 'sf'       && renderSF()}
            {step === 'final'    && renderFinal()}
          </>
        )}
      </div>

      {/* Nav error banner */}
      {navError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3"
          style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.22)' }}>
          <AlertCircle size={14} style={{ color: '#e63946', flexShrink: 0 }} />
          <span style={{ color: '#e63946', fontSize: '0.8rem', fontFamily: 'Nunito Sans, sans-serif' }}>
            {navError}
          </span>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3"
          style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.22)' }}>
          <AlertCircle size={14} style={{ color: '#e63946', flexShrink: 0 }} />
          <span style={{ color: '#e63946', fontSize: '0.8rem', fontFamily: 'Nunito Sans, sans-serif' }}>
            {saveError}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={handlePrev} disabled={stepIdx === 0 || saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-30"
          style={{ background: '#0d5035', color: '#7eb89a', fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.07)' }}>
          <ChevronLeft size={15} /> ANTERIOR
        </button>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50"
          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em', border: '1px solid rgba(74,222,128,0.22)' }}>
          <Save size={14} /> {saving ? 'GUARDANDO…' : 'GUARDAR'}
        </button>

        <button onClick={isLast ? handleSave : handleNext} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
          style={{
            background: isLast ? '#f5a623' : currentComplete ? '#0d5035' : 'rgba(255,255,255,0.04)',
            color: isLast ? '#062b1a' : currentComplete ? '#7eb89a' : '#3a6b55',
            fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.05em',
            border: currentComplete || isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
          }}>
          {!currentComplete && !isLast && <Lock size={13} />}
          {isLast ? <><Save size={14}/> {saving ? 'GUARDANDO…' : 'FINALIZAR'}</> : <>SIGUIENTE <ChevronRight size={15}/></>}
        </button>
      </div>
    </div>
  );
}

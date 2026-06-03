// Rifa de Países — pool manager. NOT part of the app bundle; runs on a schedule
// (GitHub Actions) or by hand. This is the ONLY place that bins paid tickets into
// pools and draws teams, so players can never assign themselves a team.
//
// What it does each run (idempotent):
//   1. Reads every ticket + pool.
//   2. Takes PAID tickets that don't yet have a team, in payment order, and groups
//      them into pools of 48.
//   3. For each FULL group of 48 → randomly assigns the 48 World Cup teams
//      (seeded Fisher–Yates; the seed is stored on the pool for auditability),
//      writes teamId/poolId on each ticket, marks the pool 'assigned'.
//   4. The remaining (<48) tickets form the current 'open' pool (progress display).
//   5. Emails (via Gmail SMTP) every newly-assigned ticket owner their team, once.
//
// Usage:
//   node scripts/managePools.mjs --dry-run     # compute + print, write nothing (default)
//   node scripts/managePools.mjs --write       # write Firestore + send emails
//   node scripts/managePools.mjs --write --no-email   # write, skip emails
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON string (GH Action). Falls back to
//                             scripts/serviceAccount.json for local runs.
//   GMAIL_USER                the Gmail address that sends the emails (also the From).
//   GMAIL_APP_PASSWORD        a Google "App Password" (NOT your normal password) —
//                             requires 2-Step Verification enabled on that account.
//   GMAIL_FROM_NAME           optional display name (default 'Pantera Mundialista').
//   APP_URL                   optional — link shown in the email (e.g. https://tu-app.vercel.app).

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const POOL_CAPACITY = 48;

// The 48 teams (id, display name, flag) — must match src/app/data/worldcup.ts.
const TEAMS = [
  ['mex', 'México', '🇲🇽'], ['rsa', 'Sudáfrica', '🇿🇦'], ['kor', 'Corea del Sur', '🇰🇷'], ['cze', 'República Checa', '🇨🇿'],
  ['can', 'Canadá', '🇨🇦'], ['bih', 'Bosnia y Herzegovina', '🇧🇦'], ['qat', 'Qatar', '🇶🇦'], ['sui', 'Suiza', '🇨🇭'],
  ['bra', 'Brasil', '🇧🇷'], ['mar', 'Marruecos', '🇲🇦'], ['hai', 'Haití', '🇭🇹'], ['sco', 'Escocia', '🏴'],
  ['usa', 'Estados Unidos', '🇺🇸'], ['par', 'Paraguay', '🇵🇾'], ['aus', 'Australia', '🇦🇺'], ['tur', 'Turquía', '🇹🇷'],
  ['ger', 'Alemania', '🇩🇪'], ['cuw', 'Curazao', '🇨🇼'], ['civ', 'Costa de Marfil', '🇨🇮'], ['ecu', 'Ecuador', '🇪🇨'],
  ['ned', 'Países Bajos', '🇳🇱'], ['jpn', 'Japón', '🇯🇵'], ['swe', 'Suecia', '🇸🇪'], ['tun', 'Túnez', '🇹🇳'],
  ['bel', 'Bélgica', '🇧🇪'], ['egy', 'Egipto', '🇪🇬'], ['irn', 'Irán', '🇮🇷'], ['nzl', 'Nueva Zelanda', '🇳🇿'],
  ['esp', 'España', '🇪🇸'], ['cpv', 'Cabo Verde', '🇨🇻'], ['ksa', 'Arabia Saudita', '🇸🇦'], ['uru', 'Uruguay', '🇺🇾'],
  ['fra', 'Francia', '🇫🇷'], ['sen', 'Senegal', '🇸🇳'], ['irq', 'Irak', '🇮🇶'], ['nor', 'Noruega', '🇳🇴'],
  ['arg', 'Argentina', '🇦🇷'], ['alg', 'Argelia', '🇩🇿'], ['aut', 'Austria', '🇦🇹'], ['jor', 'Jordania', '🇯🇴'],
  ['por', 'Portugal', '🇵🇹'], ['cod', 'RD Congo', '🇨🇩'], ['uzb', 'Uzbekistán', '🇺🇿'], ['col', 'Colombia', '🇨🇴'],
  ['eng', 'Inglaterra', '🏴'], ['cro', 'Croacia', '🇭🇷'], ['gha', 'Ghana', '🇬🇭'], ['pan', 'Panamá', '🇵🇦'],
];
const TEAM_IDS = TEAMS.map(t => t[0]);
const TEAM_INFO = Object.fromEntries(TEAMS.map(([id, name, flag]) => [id, { name, flag }]));

// ─── seeded shuffle (reproducible from the stored seed) ─────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded(arr, seedHex) {
  const rng = mulberry32(parseInt(seedHex.slice(0, 8), 16));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── firebase-admin (lazy) ──────────────────────────────────────────────────────

async function getDb() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount;
  try {
    serviceAccount = saJson
      ? JSON.parse(saJson)
      : JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url), 'utf8'));
  } catch {
    throw new Error('No service account: set FIREBASE_SERVICE_ACCOUNT or provide scripts/serviceAccount.json.');
  }
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

// ─── Gmail SMTP email (nodemailer) ──────────────────────────────────────────────

let _transporter; // memoized — created on first send
async function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  // Google shows app passwords as "abcd efgh ijkl mnop" — the spaces are cosmetic.
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD.');
  const { default: nodemailer } = await import('nodemailer');
  _transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return _transporter;
}

async function sendAssignmentEmail(ticket) {
  if (!ticket.userEmail) return false;
  const transporter = await getTransporter();
  const fromName = process.env.GMAIL_FROM_NAME || 'Pantera Mundialista';
  const from = `${fromName} <${process.env.GMAIL_USER}>`;

  const t = TEAM_INFO[ticket.teamId] ?? { name: ticket.teamId, flag: '⚽' };
  const appUrl = process.env.APP_URL || '';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;background:#0a3d28;color:#e0f0e8;border-radius:14px;overflow:hidden">
      <div style="height:6px;background:repeating-linear-gradient(90deg,#f5a623 0 8px,#d4f226 8px 16px,#0a3d28 16px 24px)"></div>
      <div style="padding:28px 24px;text-align:center">
        <div style="font-size:13px;letter-spacing:2px;color:#7eb89a">PANTERA MUNDIALISTA · QUINIELA</div>
        <h1 style="color:#f5a623;font-size:22px;margin:14px 0 6px">¡Ya tienes selección!</h1>
        <p style="color:#9cc4b2;font-size:14px;margin:0 0 20px">Tu pool (#${ticket.poolIndex}) se llenó y el sorteo te asignó:</p>
        <div style="font-size:56px;line-height:1">${t.flag}</div>
        <div style="font-family:Arial;font-size:24px;font-weight:bold;color:#d4f226;margin:8px 0 18px">${t.name}</div>
        <div style="font-size:12px;color:#7eb89a">Folio del boleto: <b style="color:#e0f0e8">${ticket.id}</b></div>
        ${appUrl ? `<a href="${appUrl}" style="display:inline-block;margin-top:22px;background:#f5a623;color:#062b1a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;font-size:14px">VER MIS BOLETOS</a>` : ''}
        <p style="color:#4a7d65;font-size:11px;margin-top:24px">Mundial FIFA 2026 · Mientras más lejos llegue tu país, mejor premio (1°–4° en efectivo; 5°–16° vale Nessu).</p>
      </div>
    </div>`;

  await transporter.sendMail({
    from,
    to: ticket.userEmail,
    subject: `🎲 Tu selección del Mundial — ${t.flag} ${t.name} (Pool #${ticket.poolIndex})`,
    html,
  });
  return true;
}

// ─── core logic ─────────────────────────────────────────────────────────────────

function planAssignments(tickets, pools) {
  // Tickets already assigned a team are frozen; their pools are done.
  const assignedPoolCount = pools.filter(p => p.status === 'assigned').length;
  const startIndex = Math.max(assignedPoolCount, Math.floor(tickets.filter(t => t.teamId).length / POOL_CAPACITY));

  // Paid tickets without a team, in payment order (stable tie-breakers).
  const waiting = tickets
    .filter(t => t.paymentStatus === 'paid' && !t.teamId)
    .sort((a, b) =>
      (a.paidAt ?? a.createdAt ?? '').localeCompare(b.paidAt ?? b.createdAt ?? '')
      || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      || a.id.localeCompare(b.id));

  const chunks = [];
  for (let i = 0; i < waiting.length; i += POOL_CAPACITY) {
    chunks.push(waiting.slice(i, i + POOL_CAPACITY));
  }
  return { startIndex, chunks };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has('--write');
  const noEmail = args.has('--no-email');

  const db = await getDb();

  // Config snapshot (fee + split go onto each pool; defaults if config absent).
  const cfgSnap = await db.collection('config').doc('app').get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const rifaFee = cfg.rifaFee ?? 50;
  const rifaPayoutSplit = cfg.rifaPayoutSplit ?? [0.7, 0.2, 0.1];

  const [ticketsSnap, poolsSnap] = await Promise.all([
    db.collection('tickets').get(),
    db.collection('pools').get(),
  ]);
  const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pools = poolsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const poolById = Object.fromEntries(pools.map(p => [p.id, p]));

  const { startIndex, chunks } = planAssignments(tickets, pools);
  const nowIso = new Date().toISOString();

  const ticketUpdates = []; // { id, patch }
  const poolUpsserts = [];  // { id, data }
  let newlyAssigned = 0;

  chunks.forEach((chunk, j) => {
    const index = startIndex + j + 1;
    const poolId = `pool-${index}`;
    const existing = poolById[poolId];
    const full = chunk.length === POOL_CAPACITY;

    if (full && existing?.status === 'assigned') return; // already done

    if (full) {
      const seed = randomBytes(16).toString('hex');
      const shuffled = shuffleSeeded(TEAM_IDS, seed);
      chunk.forEach((t, i) => {
        ticketUpdates.push({ id: t.id, patch: { teamId: shuffled[i], poolId, poolIndex: index } });
      });
      poolUpsserts.push({
        id: poolId,
        data: {
          id: poolId, index, status: 'assigned', capacity: POOL_CAPACITY, paidCount: POOL_CAPACITY,
          fee: rifaFee, payoutSplit: rifaPayoutSplit, assignedAt: nowIso, assignedSeed: seed,
          createdAt: existing?.createdAt ?? nowIso,
        },
      });
      newlyAssigned += chunk.length;
    } else {
      // Current open pool — record membership + progress (no teams yet).
      chunk.forEach(t => {
        if (t.poolId !== poolId || t.poolIndex !== index) {
          ticketUpdates.push({ id: t.id, patch: { poolId, poolIndex: index } });
        }
      });
      poolUpsserts.push({
        id: poolId,
        data: {
          id: poolId, index, status: 'open', capacity: POOL_CAPACITY, paidCount: chunk.length,
          fee: rifaFee, payoutSplit: rifaPayoutSplit, createdAt: existing?.createdAt ?? nowIso,
        },
      });
    }
  });

  // Report.
  console.log(`\n── Rifa de Países ─────────────────────────────────`);
  console.log(`  Boletos: ${tickets.length}  ·  pagados sin equipo: ${tickets.filter(t => t.paymentStatus === 'paid' && !t.teamId).length}`);
  console.log(`  Pools existentes: ${pools.length} (asignados: ${pools.filter(p => p.status === 'assigned').length})`);
  console.log(`  Cambios: ${ticketUpdates.length} boleto(s), ${poolUpsserts.length} pool(s), ${newlyAssigned} recién asignado(s)`);
  for (const p of poolUpsserts) console.log(`    → ${p.id}: ${p.data.status} (${p.data.paidCount}/${POOL_CAPACITY})`);
  console.log(`───────────────────────────────────────────────────`);

  if (!write) {
    console.log('(dry run — nada escrito. Usa --write para aplicar.)');
    return;
  }

  // Write tickets + pools in a batch.
  if (ticketUpdates.length || poolUpsserts.length) {
    const batch = db.batch();
    for (const u of ticketUpdates) batch.update(db.collection('tickets').doc(u.id), u.patch);
    for (const p of poolUpsserts) batch.set(db.collection('pools').doc(p.id), p.data, { merge: true });
    await batch.commit();
    console.log('✅ Firestore actualizado.');
  }

  // Email every assigned-but-not-notified ticket (covers retries from earlier runs).
  if (!noEmail) {
    const assignedTickets = tickets.map(t => {
      const u = ticketUpdates.find(x => x.id === t.id);
      return u ? { ...t, ...u.patch } : t;
    }).filter(t => t.teamId && t.notified !== true && t.userEmail);

    let sent = 0;
    for (const t of assignedTickets) {
      try {
        const ok = await sendAssignmentEmail(t);
        if (ok) {
          await db.collection('tickets').doc(t.id).update({ notified: true });
          sent++;
        }
      } catch (e) {
        console.warn(`  ⚠️  correo falló para ${t.id} (${t.userEmail}): ${e.message ?? e}`);
      }
    }
    console.log(`📧 Correos enviados: ${sent}/${assignedTickets.length}`);
  } else {
    console.log('(--no-email — se omitieron los correos.)');
  }
}

main().catch((e) => { console.error('\n❌', e.message ?? e); process.exit(1); });

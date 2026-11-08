// Payment reminders — Pronostica & Rifa. NOT part of the app bundle; runs on the
// same schedule as managePools (GitHub Actions · manage-pools.yml) or by hand. There
// is no web backend, so the admin can't send mail from the browser: instead the app
// queues a 'pending' mailJob in Firestore and this script picks it up, emails every
// owner of an UNPAID (pending) entry to complete payment before config.paymentDeadline,
// then marks the job 'sent'. Job types:
//   - 'rifa-reminder'         → owners of pending Rifa tickets (collection 'tickets').
//   - 'pronostica-reminder'   → owners of pending Pronostica entries (collection 'predictions').
//   - 'results-announcement'  → ONE email with the final results (Top 4 per league +
//                               podio del Mundial) to every PAID participant of both
//                               modes, sent via BCC so addresses stay private. No
//                               prize amounts — winners are contacted directly.
//
// One email per person (a player may hold several pending entries → listed together).
// Entries in 'review' (proof already uploaded) are NOT reminded.
//
// Usage:
//   node scripts/sendReminders.mjs --dry-run   # default; compute + print, write nothing
//   node scripts/sendReminders.mjs --write      # send emails + mark jobs done
//   node scripts/sendReminders.mjs --preview=out.html   # (dry-run) also dump the
//                                               results-announcement HTML to a file
//
// Env (same as managePools.mjs):
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON string (GH Action). Falls back to
//                             scripts/serviceAccount.json for local runs.
//   GMAIL_USER / GMAIL_APP_PASSWORD   Gmail address + Google "App Password".
//   GMAIL_FROM_NAME           optional display name (default 'Pantera Mundialista').
//   APP_URL                   optional — link shown in the email (where they pay).

import { readFileSync, writeFileSync } from 'node:fs';

const LEAGUE_LABEL = {
  main: 'Liga Principal',
  r32: 'Liga R32 (Dieciseisavos)',
  r16: 'Liga R16 (Octavos)',
};

// The 48 teams (id, display name, flag) — must match src/app/data/worldcup.ts.
// Same duplication as managePools.mjs: these scripts are standalone and can't
// import from src/.
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
const TEAM_INFO = Object.fromEntries(TEAMS.map(([id, name, flag]) => [id, { name, flag }]));
const teamLabel = (id) => (TEAM_INFO[id] ? `${TEAM_INFO[id].flag} ${TEAM_INFO[id].name}` : '—');

// ─── firebase-admin (lazy) — mirrors managePools.mjs (both scripts are standalone) ──

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

// ─── Gmail SMTP email (nodemailer) — mirrors managePools.mjs ─────────────────────

let _transporter; // memoized — created on first send
async function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  // Google shows app passwords as "abcd efgh ijkl mnop" — the spaces are cosmetic.
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD.');
  const { default: nodemailer } = await import('nodemailer');
  // Reminders send to the whole list at once (dozens–hundreds of mails). Without
  // pooling, nodemailer opens a fresh SMTP connection (a new LOGIN) per message and
  // Gmail rejects the burst with "454-4.7.0 Too many login attempts". A single
  // pooled, rate-limited connection reuses one login and stays under Gmail's caps.
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
    rateLimit: 5,      // ≤ 5 messages…
    rateDelta: 1000,   // …per second
  });
  return _transporter;
}

function money(n, currency) {
  return `${Number(n).toLocaleString('es-MX')} ${currency}`;
}

function fmtDeadline(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
  });
}

// Wrap the per-mode body in the shared branded shell. The footer defaults to the
// payment-reminder disclaimer; announcements pass their own.
function shell(innerHtml, footer = 'Mundial FIFA 2026 · Si ya pagaste, ignora este correo (tu confirmación puede tardar en revisarse).') {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;background:#0a3d28;color:#e0f0e8;border-radius:14px;overflow:hidden">
      <div style="height:6px;background:repeating-linear-gradient(90deg,#f5a623 0 8px,#d4f226 8px 16px,#0a3d28 16px 24px)"></div>
      <div style="padding:28px 24px;text-align:center">
        <div style="font-size:13px;letter-spacing:2px;color:#7eb89a">PANTERA MUNDIALISTA</div>
        ${innerHtml}
        <p style="color:#4a7d65;font-size:11px;margin-top:24px">${footer}</p>
      </div>
    </div>`;
}

function payButton(appUrl) {
  return appUrl
    ? `<a href="${appUrl}" style="display:inline-block;margin-top:22px;background:#f5a623;color:#062b1a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;font-size:14px">PAGAR AHORA</a>`
    : '';
}

function deadlineLine(deadline) {
  return deadline
    ? `Paga antes del <b style="color:#f5a623">${deadline}</b> o tu lugar se cancelará.`
    : 'Completa el pago para asegurar tu lugar.';
}

async function sendEmail(to, subject, html, bcc) {
  const transporter = await getTransporter();
  const fromName = process.env.GMAIL_FROM_NAME || 'Pantera Mundialista';
  await transporter.sendMail({
    from: `${fromName} <${process.env.GMAIL_USER}>`,
    to, subject, html,
    ...(bcc && bcc.length ? { bcc } : {}),
  });
}

// ─── Rifa reminder email ──────────────────────────────────────────────────────

async function sendRifaReminderEmail(recipient, ctx) {
  const count = recipient.items.length;
  const folioList = recipient.items.map(t => `<b style="color:#e0f0e8">${t.id}</b>`).join(' · ');
  const total = money(count * ctx.rifaFee, ctx.currency);
  const feeEach = money(ctx.rifaFee, ctx.currency);
  const name = recipient.name || 'participante';

  const inner = `
    <h1 style="color:#f5a623;font-size:22px;margin:14px 0 6px">⏰ Te falta completar tu pago</h1>
    <p style="color:#9cc4b2;font-size:14px;margin:0 0 18px">Hola ${name}, tienes ${count === 1 ? 'un boleto' : `${count} boletos`} de la Quiniela sin pagar.</p>
    <div style="background:#062b1a;border-radius:10px;padding:16px 18px;text-align:left;font-size:13px;color:#9cc4b2">
      <div style="margin-bottom:6px">Folio${count === 1 ? '' : 's'}: ${folioList}</div>
      <div style="margin-bottom:6px">Cuota: <b style="color:#d4f226">${feeEach}</b> c/u</div>
      <div>Total por pagar: <b style="color:#d4f226">${total}</b></div>
    </div>
    <p style="color:#9cc4b2;font-size:13px;margin:18px 0 0">${deadlineLine(ctx.deadline)}</p>
    ${payButton(ctx.appUrl)}`;

  await sendEmail(
    recipient.email,
    `⏰ Completa el pago de tu boleto${count === 1 ? '' : 's'} — Pantera Mundialista`,
    shell(inner),
  );
}

// ─── Pronostica reminder email ────────────────────────────────────────────────

async function sendPronosticaReminderEmail(recipient, ctx) {
  const count = recipient.items.length;
  const rows = recipient.items.map(p => {
    const fee = money(ctx.fees?.[p.league] ?? 0, ctx.currency);
    const liga = LEAGUE_LABEL[p.league] ?? p.league;
    return `<div style="margin-bottom:6px"><b style="color:#e0f0e8">${p.id}</b> · ${liga} · <b style="color:#d4f226">${fee}</b></div>`;
  }).join('');
  const total = money(recipient.items.reduce((s, p) => s + (ctx.fees?.[p.league] ?? 0), 0), ctx.currency);
  const name = recipient.name || 'participante';

  const inner = `
    <h1 style="color:#f5a623;font-size:22px;margin:14px 0 6px">⏰ Te falta completar tu pago</h1>
    <p style="color:#9cc4b2;font-size:14px;margin:0 0 18px">Hola ${name}, tienes ${count === 1 ? 'un pronóstico' : `${count} pronósticos`} sin pagar.</p>
    <div style="background:#062b1a;border-radius:10px;padding:16px 18px;text-align:left;font-size:13px;color:#9cc4b2">
      ${rows}
      <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">Total por pagar: <b style="color:#d4f226">${total}</b></div>
    </div>
    <p style="color:#9cc4b2;font-size:13px;margin:18px 0 0">${deadlineLine(ctx.deadline)}</p>
    ${payButton(ctx.appUrl)}`;

  await sendEmail(
    recipient.email,
    `⏰ Completa el pago de tu pronóstico${count === 1 ? '' : 's'} — Pantera Mundialista`,
    shell(inner),
  );
}

// ─── Results announcement (fin del torneo) ────────────────────────────────────
// Ports of src/lib/scoring.ts (computeScore / leagueScore / rankPredictions) and
// src/lib/rifa.ts (rifaPlaces) — must stay in sync with them.

const POINTS = { groupExact: 2, r32: 3, r16: 5, qf: 8, sf: 13, champion: 25, runnerUp: 10, thirdPlace: 7 };

// How many distinct teams the user picked to win this round actually advanced.
function correctAdvances(predictedWinners, actualAdvancing) {
  const actual = new Set((actualAdvancing ?? []).filter(Boolean));
  const counted = new Set();
  let n = 0;
  for (const id of predictedWinners) {
    if (id && actual.has(id) && !counted.has(id)) { counted.add(id); n++; }
  }
  return n;
}

function computeScore(p, r) {
  let groups = 0;
  for (const groupId of Object.keys(r.groups ?? {})) {
    const actual = r.groups[groupId];
    const pick = p.groups?.[groupId];
    if (!pick || !actual) continue;
    if (pick.first && pick.first === actual.first) groups += POINTS.groupExact;
    if (pick.second && pick.second === actual.second) groups += POINTS.groupExact;
    if (pick.third && pick.third === actual.third) groups += POINTS.groupExact;
  }
  const r32 = correctAdvances(Object.values(p.r32 ?? {}), r.r32Winners) * POINTS.r32;
  const r16 = correctAdvances(Object.values(p.r16 ?? {}), r.r16Winners) * POINTS.r16;
  const qf = correctAdvances(Object.values(p.qf ?? {}), r.qfWinners) * POINTS.qf;
  const sf = correctAdvances(Object.values(p.sf ?? {}), r.sfWinners) * POINTS.sf;
  const champion = p.champion && p.champion === r.champion ? POINTS.champion : 0;
  const runnerUp = p.runnerUp && p.runnerUp === r.runnerUp ? POINTS.runnerUp : 0;
  const thirdPlace = p.thirdPlace && p.thirdPlace === r.thirdPlace ? POINTS.thirdPlace : 0;
  const total = groups + r32 + r16 + qf + sf + champion + runnerUp + thirdPlace;
  return { groups, r32, r16, qf, sf, champion, runnerUp, thirdPlace, total };
}

// Each league is scored only from its own round onward (see src/lib/scoring.ts).
function leagueScore(b, league) {
  if (league === 'r32') return b.total - b.groups;
  if (league === 'r16') return b.total - b.groups - b.r32;
  return b.total;
}

// Ranks by league-scoped points DESC, ties broken by earliest submission.
function rankPredictions(preds, results) {
  const scored = preds.map(p => {
    const score = computeScore(p, results);
    return { prediction: p, score, leagueTotal: leagueScore(score, p.league) };
  });
  scored.sort((a, b) => {
    if (b.leagueTotal !== a.leagueTotal) return b.leagueTotal - a.leagueTotal;
    return (a.prediction.createdAt ?? '').localeCompare(b.prediction.createdAt ?? '');
  });
  return scored.map((e, i) => ({ ...e, rank: i + 1 }));
}

// Final 1°–4° of the Mundial (4° = the semifinalist that isn't on the podium).
function rifaPlaces(r) {
  const qf = (r.qfWinners ?? []).filter(Boolean);
  const podium = new Set([r.champion, r.runnerUp, r.thirdPlace].filter(Boolean));
  const fourth = r.thirdPlace ? (qf.find(t => !podium.has(t)) ?? '') : '';
  return { first: r.champion ?? '', second: r.runnerUp ?? '', third: r.thirdPlace ?? '', fourth };
}

// Public display name for the Top 4 — never a full email address.
function publicName(p, userById) {
  const u = userById[p.uid] || {};
  const name = p.userDisplayName || u.displayName;
  if (name) return name;
  const email = p.userEmail || u.email || '';
  const [local, domain] = email.split('@');
  return local ? `${local.slice(0, 3)}…@${domain ?? ''}` : 'participante';
}

// One deduped email list: every PAID participant of either mode. The message is
// identical for everyone, so a single BCC'd mail (in batches) keeps addresses private.
function collectAnnouncementEmails(paidItems, userById) {
  const seen = new Map();
  for (const it of paidItems) {
    const u = userById[it.uid] || {};
    const email = (it.userEmail || u.email || '').trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!seen.has(key)) seen.set(key, email);
  }
  return [...seen.values()];
}

const MEDALS = ['🥇', '🥈', '🥉', '4°'];

function buildAnnouncementHtml(places, leagueTops) {
  const podiumRows = [
    ['🥇 Campeón', places.first], ['🥈 Subcampeón', places.second],
    ['🥉 Tercer lugar', places.third], ['4° Cuarto lugar', places.fourth],
  ].map(([label, teamId]) => `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#9cc4b2">${label}</span>
        <b style="color:#e0f0e8">${teamLabel(teamId)}</b>
      </div>`).join('');

  const leagueBlocks = leagueTops.map(lg => `
    <div style="background:#062b1a;border-radius:10px;padding:16px 18px;text-align:left;font-size:13px;margin-top:10px">
      <div style="color:#d4f226;font-size:12px;letter-spacing:1px;margin-bottom:10px">${lg.label.toUpperCase()} — TOP ${lg.top.length}</div>
      ${lg.top.map(e => `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:${e.rank === 1 ? '#f5a623' : '#9cc4b2'}">${MEDALS[e.rank - 1] ?? `${e.rank}°`} ${e.name}</span>
        <b style="color:${e.rank === 1 ? '#f5a623' : '#e0f0e8'}">${e.points} pts</b>
      </div>`).join('')}
    </div>`).join('');

  const inner = `
    <h1 style="color:#f5a623;font-size:22px;margin:14px 0 6px">🏆 ¡El Mundial 2026 llegó a su fin!</h1>
    <p style="color:#9cc4b2;font-size:14px;margin:0 0 18px">Gracias por participar. Estos son los resultados oficiales de nuestras dos dinámicas.</p>

    <div style="color:#7eb89a;font-size:12px;letter-spacing:1px;margin:18px 0 8px;text-align:left">🌍 RIFA DE PAÍSES — PODIO DEL MUNDIAL</div>
    <div style="background:#062b1a;border-radius:10px;padding:16px 18px;text-align:left;font-size:13px">
      ${podiumRows}
    </div>

    <div style="color:#7eb89a;font-size:12px;letter-spacing:1px;margin:18px 0 -2px;text-align:left">🐾 PRONOSTICA PANTERA — TABLA FINAL</div>
    ${leagueBlocks}

    <p style="color:#e0f0e8;font-size:13px;margin:20px 0 0">🎁 Nos pondremos en contacto directamente con los ganadores para la entrega de sus premios.</p>`;

  return shell(inner, 'Mundial FIFA 2026 · ¡Gracias por ser parte de Pantera Mundialista!');
}

// Gmail caps recipients per message — send the identical announcement in BCC
// batches well under the cap. Every batch failure is logged; the job is only
// 'error' if nothing at all went out.
const BCC_BATCH = 80;

async function processAnnouncement(db, jobs, emails, subject, html, nowIso, write) {
  console.log(`\n── Resultados finales ─────────────────────`);
  console.log(`  Trabajos en cola: ${jobs.length}  ·  destinatarios (CCO): ${emails.length}`);

  if (!write) {
    for (const e of emails) console.log(`    → ${e}`);
    return;
  }

  let sent = 0;
  let lastError = '';
  for (let i = 0; i < emails.length; i += BCC_BATCH) {
    const batch = emails.slice(i, i + BCC_BATCH);
    try {
      // to: = the sender itself; every real recipient goes in BCC.
      await sendEmail(process.env.GMAIL_USER, subject, html, batch);
      sent += batch.length;
    } catch (e) {
      lastError = e?.message ?? String(e);
      console.warn(`  ⚠️  lote CCO de ${batch.length} correo(s) falló: ${lastError}`);
    }
  }
  console.log(`  📧 enviados (CCO): ${sent}/${emails.length}`);

  const status = sent === 0 && emails.length > 0 ? 'error' : 'sent';
  const batchW = db.batch();
  for (const job of jobs) {
    batchW.update(db.collection('mailJobs').doc(job.id), {
      status,
      recipientCount: emails.length,
      sentCount: sent,
      finishedAt: nowIso,
      ...(status === 'error' ? { error: lastError || 'no se pudo enviar ningún correo' } : {}),
    });
  }
  await batchW.commit();
  console.log(`  ✅ ${jobs.length} trabajo(s) marcado(s) como '${status}'.`);
}

// Group every owner of a pending entry by email, listing their entries. Falls back
// to the users doc for the email/name when the entry didn't capture them.
function collectRecipients(items, userById) {
  const byEmail = new Map();
  for (const it of items) {
    if (it.paymentStatus !== 'pending') continue;
    const u = userById[it.uid] || {};
    const email = it.userEmail || u.email;
    if (!email) continue;
    const name = it.userDisplayName || u.displayName || '';
    const entry = byEmail.get(email) || { email, name, items: [] };
    if (!entry.name && name) entry.name = name;
    entry.items.push(it);
    byEmail.set(email, entry);
  }
  return [...byEmail.values()];
}

// Send to every recipient once and mark every queued job of this type with the
// outcome. In dry-run, just prints who would be emailed.
async function processReminder(db, label, jobs, recipients, sendFn, nowIso, write) {
  console.log(`\n── ${label} ──────────────────────────────`);
  console.log(`  Trabajos en cola: ${jobs.length}  ·  destinatarios (por correo): ${recipients.length}`);

  if (!write) {
    for (const r of recipients) console.log(`    → ${r.email} (${r.items.length})`);
    return;
  }

  let sent = 0;
  let lastError = '';
  for (const r of recipients) {
    try {
      await sendFn(r);
      sent++;
    } catch (e) {
      lastError = e?.message ?? String(e);
      console.warn(`  ⚠️  correo falló para ${r.email}: ${lastError}`);
    }
  }
  console.log(`  📧 enviados: ${sent}/${recipients.length}`);

  const status = sent === 0 && recipients.length > 0 ? 'error' : 'sent';
  const batch = db.batch();
  for (const job of jobs) {
    batch.update(db.collection('mailJobs').doc(job.id), {
      status,
      recipientCount: recipients.length,
      sentCount: sent,
      finishedAt: nowIso,
      ...(status === 'error' ? { error: lastError || 'no se pudo enviar ningún correo' } : {}),
    });
  }
  await batch.commit();
  console.log(`  ✅ ${jobs.length} trabajo(s) marcado(s) como '${status}'.`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has('--write');

  const db = await getDb();

  // Only do work if there's a queued reminder job — keeps the common run cheap.
  const jobsSnap = await db.collection('mailJobs').get();
  const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => j.status === 'pending');
  const rifaJobs = jobs.filter(j => j.type === 'rifa-reminder');
  const pronoJobs = jobs.filter(j => j.type === 'pronostica-reminder');
  const resultJobs = jobs.filter(j => j.type === 'results-announcement');

  if (rifaJobs.length === 0 && pronoJobs.length === 0 && resultJobs.length === 0) {
    console.log('── Recordatorios ──  Sin trabajos pendientes. Nada que hacer.');
    return;
  }

  // Live config + users (recipients are computed fresh, not snapshotted).
  const [cfgSnap, usersSnap] = await Promise.all([
    db.collection('config').doc('app').get(),
    db.collection('users').get(),
  ]);
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const ctx = {
    rifaFee: cfg.rifaFee ?? 50,
    fees: cfg.fees ?? {},
    currency: cfg.currency ?? 'MXN',
    deadline: fmtDeadline(cfg.paymentDeadline),
    appUrl: process.env.APP_URL || '',
  };
  const userById = Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data()]));
  const nowIso = new Date().toISOString();
  if (ctx.deadline) console.log(`Fecha límite: ${ctx.deadline}`);

  if (rifaJobs.length) {
    const ticketsSnap = await db.collection('tickets').get();
    const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const recipients = collectRecipients(tickets, userById);
    await processReminder(db, 'Rifa', rifaJobs, recipients, r => sendRifaReminderEmail(r, ctx), nowIso, write);
  }

  if (pronoJobs.length) {
    const predsSnap = await db.collection('predictions').get();
    const preds = predsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const recipients = collectRecipients(preds, userById);
    await processReminder(db, 'Pronostica', pronoJobs, recipients, r => sendPronosticaReminderEmail(r, ctx), nowIso, write);
  }

  if (resultJobs.length) {
    const [resSnap, predsSnap, ticketsSnap] = await Promise.all([
      db.collection('results').doc('official').get(),
      db.collection('predictions').get(),
      db.collection('tickets').get(),
    ]);
    const results = resSnap.exists ? resSnap.data() : {};

    if (!results.champion) {
      // Never announce before the tournament is actually decided.
      console.warn('\n── Resultados finales ──  ⚠️  results/official aún no tiene campeón; no se envía.');
      if (write) {
        const batchW = db.batch();
        for (const job of resultJobs) {
          batchW.update(db.collection('mailJobs').doc(job.id), {
            status: 'error', finishedAt: nowIso,
            error: 'results/official aún no tiene campeón — el torneo no ha terminado',
          });
        }
        await batchW.commit();
      }
    } else {
      const preds = predsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const paidPreds = preds.filter(p => p.paymentStatus === 'paid');
      const paidTickets = tickets.filter(t => t.paymentStatus === 'paid');

      // Top 4 per league — only leagues that actually had paid entries.
      const leagueTops = ['main', 'r32', 'r16'].map(key => ({
        key,
        label: LEAGUE_LABEL[key],
        top: rankPredictions(paidPreds.filter(p => p.league === key), results)
          .slice(0, 4)
          .map(e => ({ rank: e.rank, points: e.leagueTotal, name: publicName(e.prediction, userById) })),
      })).filter(lg => lg.top.length > 0);

      const places = rifaPlaces(results);
      const emails = collectAnnouncementEmails([...paidPreds, ...paidTickets], userById);
      const html = buildAnnouncementHtml(places, leagueTops);
      const subject = '🏆 Resultados finales del Mundial 2026 — Pantera Mundialista';

      const previewArg = process.argv.find(a => a.startsWith('--preview='));
      if (previewArg) {
        writeFileSync(previewArg.slice('--preview='.length), html, 'utf8');
        console.log(`  (vista previa HTML escrita en ${previewArg.slice('--preview='.length)})`);
      }
      for (const lg of leagueTops) {
        console.log(`  ${lg.label}: ${lg.top.map(e => `${e.rank}° ${e.name} (${e.points} pts)`).join(' · ')}`);
      }

      await processAnnouncement(db, resultJobs, emails, subject, html, nowIso, write);
    }
  }

  if (!write) console.log('\n(dry run — nada enviado. Usa --write para enviar.)');

  // Close the pooled SMTP connection so the process can exit promptly.
  if (_transporter) _transporter.close();
}

main().catch((e) => { console.error('\n❌', e.message ?? e); process.exit(1); });

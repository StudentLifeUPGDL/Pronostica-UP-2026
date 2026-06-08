// Payment reminders — Pronostica & Rifa. NOT part of the app bundle; runs on the
// same schedule as managePools (GitHub Actions · manage-pools.yml) or by hand. There
// is no web backend, so the admin can't send mail from the browser: instead the app
// queues a 'pending' mailJob in Firestore and this script picks it up, emails every
// owner of an UNPAID (pending) entry to complete payment before config.paymentDeadline,
// then marks the job 'sent'. Two job types:
//   - 'rifa-reminder'       → owners of pending Rifa tickets (collection 'tickets').
//   - 'pronostica-reminder' → owners of pending Pronostica entries (collection 'predictions').
//
// One email per person (a player may hold several pending entries → listed together).
// Entries in 'review' (proof already uploaded) are NOT reminded.
//
// Usage:
//   node scripts/sendReminders.mjs --dry-run   # default; compute + print, write nothing
//   node scripts/sendReminders.mjs --write      # send emails + mark jobs done
//
// Env (same as managePools.mjs):
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON string (GH Action). Falls back to
//                             scripts/serviceAccount.json for local runs.
//   GMAIL_USER / GMAIL_APP_PASSWORD   Gmail address + Google "App Password".
//   GMAIL_FROM_NAME           optional display name (default 'Pantera Mundialista').
//   APP_URL                   optional — link shown in the email (where they pay).

import { readFileSync } from 'node:fs';

const LEAGUE_LABEL = {
  main: 'Liga Principal',
  r32: 'Liga R32 (Dieciseisavos)',
  r16: 'Liga R16 (Octavos)',
};

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
  _transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
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

// Wrap the per-mode body in the shared branded shell.
function shell(innerHtml) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;background:#0a3d28;color:#e0f0e8;border-radius:14px;overflow:hidden">
      <div style="height:6px;background:repeating-linear-gradient(90deg,#f5a623 0 8px,#d4f226 8px 16px,#0a3d28 16px 24px)"></div>
      <div style="padding:28px 24px;text-align:center">
        <div style="font-size:13px;letter-spacing:2px;color:#7eb89a">PANTERA MUNDIALISTA</div>
        ${innerHtml}
        <p style="color:#4a7d65;font-size:11px;margin-top:24px">Mundial FIFA 2026 · Si ya pagaste, ignora este correo (tu confirmación puede tardar en revisarse).</p>
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

async function sendEmail(to, subject, html) {
  const transporter = await getTransporter();
  const fromName = process.env.GMAIL_FROM_NAME || 'Pantera Mundialista';
  await transporter.sendMail({ from: `${fromName} <${process.env.GMAIL_USER}>`, to, subject, html });
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

  if (rifaJobs.length === 0 && pronoJobs.length === 0) {
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

  if (!write) console.log('\n(dry run — nada enviado. Usa --write para enviar.)');
}

main().catch((e) => { console.error('\n❌', e.message ?? e); process.exit(1); });

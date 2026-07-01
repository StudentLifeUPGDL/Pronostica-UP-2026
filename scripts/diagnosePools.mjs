// Read-only diagnostic for the Rifa de Países. Prints the real state of every
// pool + its tickets so we can see the anomaly (a ticket binned into an assigned
// pool but left without a team, and which team went unused). Writes NOTHING.
//
//   node scripts/diagnosePools.mjs

import { readFileSync } from 'node:fs';

const POOL_CAPACITY = 48;

const TEAMS = [
  ['mex', 'México'], ['rsa', 'Sudáfrica'], ['kor', 'Corea del Sur'], ['cze', 'República Checa'],
  ['can', 'Canadá'], ['bih', 'Bosnia y Herzegovina'], ['qat', 'Qatar'], ['sui', 'Suiza'],
  ['bra', 'Brasil'], ['mar', 'Marruecos'], ['hai', 'Haití'], ['sco', 'Escocia'],
  ['usa', 'Estados Unidos'], ['par', 'Paraguay'], ['aus', 'Australia'], ['tur', 'Turquía'],
  ['ger', 'Alemania'], ['cuw', 'Curazao'], ['civ', 'Costa de Marfil'], ['ecu', 'Ecuador'],
  ['ned', 'Países Bajos'], ['jpn', 'Japón'], ['swe', 'Suecia'], ['tun', 'Túnez'],
  ['bel', 'Bélgica'], ['egy', 'Egipto'], ['irn', 'Irán'], ['nzl', 'Nueva Zelanda'],
  ['esp', 'España'], ['cpv', 'Cabo Verde'], ['ksa', 'Arabia Saudita'], ['uru', 'Uruguay'],
  ['fra', 'Francia'], ['sen', 'Senegal'], ['irq', 'Irak'], ['nor', 'Noruega'],
  ['arg', 'Argentina'], ['alg', 'Argelia'], ['aut', 'Austria'], ['jor', 'Jordania'],
  ['por', 'Portugal'], ['cod', 'RD Congo'], ['uzb', 'Uzbekistán'], ['col', 'Colombia'],
  ['eng', 'Inglaterra'], ['cro', 'Croacia'], ['gha', 'Ghana'], ['pan', 'Panamá'],
];
const TEAM_IDS = TEAMS.map(t => t[0]);
const TEAM_NAME = Object.fromEntries(TEAMS);

async function getDb() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccount = saJson
    ? JSON.parse(saJson)
    : JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url), 'utf8'));
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

const short = t => `${t.id} ${t.paymentStatus.padEnd(7)} team=${(t.teamId || '—').padEnd(5)} ${t.userDisplayName || t.userEmail || t.uid}`;

async function main() {
  const db = await getDb();
  const [ticketsSnap, poolsSnap] = await Promise.all([
    db.collection('tickets').get(),
    db.collection('pools').get(),
  ]);
  const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pools = poolsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.index - b.index);

  console.log(`\nBoletos: ${tickets.length} · Pools: ${pools.length}\n`);

  for (const p of pools) {
    const members = tickets.filter(t => t.poolId === p.id);
    const withTeam = members.filter(t => t.teamId);
    const noTeam = members.filter(t => !t.teamId);
    const usedTeams = new Set(withTeam.map(t => t.teamId));
    const missingTeams = TEAM_IDS.filter(id => !usedTeams.has(id));
    const dupTeams = withTeam.map(t => t.teamId).filter((id, i, a) => a.indexOf(id) !== i);

    const byStatus = members.reduce((m, t) => { m[t.paymentStatus] = (m[t.paymentStatus] || 0) + 1; return m; }, {});
    const paidMembers = members.filter(t => t.paymentStatus === 'paid');
    const notPaidWithTeam = members.filter(t => t.paymentStatus !== 'paid' && t.teamId);

    console.log(`━━ ${p.id}  status=${p.status}  paidCount=${p.paidCount}  miembros=${members.length} (con equipo ${withTeam.length}, sin equipo ${noTeam.length})`);
    console.log(`   por estado: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  ')}  ·  pagados=${paidMembers.length}`);
    if (notPaidWithTeam.length) {
      console.log(`   ⚠️  NO pagados que SÍ tienen equipo (lugar recuperable):`);
      for (const t of notPaidWithTeam) console.log(`        ${short(t)}`);
    }
    if (noTeam.length) {
      console.log(`   ⚠️  SIN EQUIPO:`);
      for (const t of noTeam) console.log(`        ${short(t)}`);
    }
    if (p.status === 'assigned' && missingTeams.length) {
      console.log(`   ⚠️  Equipos NO usados en este pool: ${missingTeams.map(id => `${id}(${TEAM_NAME[id]})`).join(', ')}`);
    }
    if (dupTeams.length) console.log(`   ⚠️  Equipos DUPLICADOS: ${dupTeams.join(', ')}`);
    if (p.assignedSeed) console.log(`   seed=${p.assignedSeed}`);
  }

  const totalByStatus = tickets.reduce((m, t) => { m[t.paymentStatus] = (m[t.paymentStatus] || 0) + 1; return m; }, {});
  console.log(`\nTotales por estado: ${Object.entries(totalByStatus).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  const paidTotal = tickets.filter(t => t.paymentStatus === 'paid').length;
  const paidWithTeam = tickets.filter(t => t.paymentStatus === 'paid' && t.teamId).length;
  console.log(`Pagados: ${paidTotal}  ·  pagados con equipo: ${paidWithTeam}  ·  pagados sin equipo: ${paidTotal - paidWithTeam}`);

  const orphanPaid = tickets.filter(t => t.paymentStatus === 'paid' && !t.teamId && !t.poolId);
  const voidedWithTeam = tickets.filter(t => t.paymentStatus === 'void' && t.teamId);
  console.log(`\nPagados sin pool (esperando sorteo): ${orphanPaid.length}`);
  if (voidedWithTeam.length) {
    console.log(`\n⚠️  Boletos ANULADOS que aún tienen equipo:`);
    for (const t of voidedWithTeam) console.log(`   ${short(t)} pool=${t.poolId}`);
  }
  console.log('');
}

main().catch(e => { console.error('❌', e.message ?? e); process.exit(1); });

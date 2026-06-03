import { ReactNode, useState } from 'react';
import { Trophy, Star, Target, Award, HelpCircle, CheckCircle2, Zap, Dice5, Coffee, ShieldCheck } from 'lucide-react';
import { POOL_CAPACITY, type AppConfig } from '../data/worldcup';
import { rifaPrizeLadder } from '../../lib/rifa';
import { paymentConfigured } from '../../lib/payment';

function money(n: number, currency: string) {
  return `$${n.toLocaleString('es-MX')} ${currency}`;
}

interface Section {
  icon: ReactNode;
  title: string;
  content: ReactNode;
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0d5035', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.15)' }}>
          {icon}
        </div>
        <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

function BulletItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <CheckCircle2 size={14} style={{ color: '#4ade80', marginTop: '3px', flexShrink: 0 }} />
      <span style={{ color: '#c0d8cc', fontSize: '0.85rem', fontFamily: 'Nunito Sans, sans-serif', lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}

function PointRow({ label, pts, desc }: { label: string; pts: number; desc: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="w-12 text-center rounded-lg py-1" style={{ background: 'rgba(245,166,35,0.12)', fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1rem', fontWeight: 700 }}>
        {pts}
      </div>
      <div className="flex-1">
        <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem', letterSpacing: '0.03em' }}>{label}</div>
        <div style={{ color: '#4a7d65', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>{desc}</div>
      </div>
    </div>
  );
}

// ─── Quiniela (Rifa de Países) rules ──────────────────────────────────────────
function QuinielaRules({ config }: { config: AppConfig }) {
  const ladder = rifaPrizeLadder(config.rifaPrizes);
  return (
    <div className="grid gap-5">
      <Card icon={<Dice5 size={16} style={{ color: '#f5a623' }} />} title="¿QUÉ ES LA QUINIELA?">
        <p style={{ color: '#c0d8cc', fontSize: '0.88rem', fontFamily: 'Nunito Sans', lineHeight: 1.6, marginBottom: '12px' }}>
          La Quiniela es la modalidad de azar de Pantera Mundialista: compras un boleto y se te asigna
          <strong style={{ color: '#d4f226' }}> una selección al azar</strong> del Mundial. Ganas según
          <strong> qué tan lejos llegue tu país</strong>. No hay que predecir nada: solo seguir a tu equipo.
        </p>
        <BulletItem>Boleto de <strong>{money(config.rifaFee, config.currency)}</strong>; puedes comprar los que quieras.</BulletItem>
        <BulletItem>La rifa <strong>solo corre si se venden los {POOL_CAPACITY} boletos</strong> (uno por país). Si no se llena, <strong>se te regresa tu dinero</strong>.</BulletItem>
        <BulletItem>Registro y pago <strong>antes del primer partido</strong> (11 junio 2026).</BulletItem>
        <BulletItem>El equipo se asigna por <strong>sorteo verificable</strong> (semilla auditable) y te llega por correo.</BulletItem>
      </Card>

      <Card icon={<Trophy size={16} style={{ color: '#f5a623' }} />} title="PREMIOS · SEGÚN QUÉ TAN LEJOS LLEGUE TU PAÍS">
        <div className="flex flex-col">
          {ladder.map(tier => (
            <div key={tier.place} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-16 text-center rounded-lg py-1 flex-shrink-0" style={{ background: tier.kind === 'cash' ? 'rgba(245,166,35,0.12)' : 'rgba(212,242,38,0.08)', fontFamily: 'Oswald, sans-serif', color: tier.kind === 'cash' ? '#f5a623' : '#d4f226', fontWeight: 700, fontSize: '0.9rem' }}>
                {tier.place}
              </div>
              <div className="flex-1 flex items-center gap-2">
                {tier.kind === 'cash' ? <Trophy size={13} style={{ color: '#f5a623' }} /> : <Coffee size={13} style={{ color: '#d4f226' }} />}
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem' }}>{tier.label}</span>
              </div>
              <span style={{ color: tier.kind === 'cash' ? '#f5a623' : '#d4f226', fontFamily: tier.kind === 'cash' ? 'Oswald, sans-serif' : 'DM Mono', fontSize: tier.kind === 'cash' ? '0.92rem' : '0.72rem', fontWeight: tier.kind === 'cash' ? 700 : 400 }}>
                {tier.kind === 'cash' ? money(tier.amount, config.currency) : `vale ${money(tier.amount, config.currency)} Nessu · ×${tier.seats}`}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-lg flex items-start gap-2" style={{ background: 'rgba(212,242,38,0.06)', border: '1px solid rgba(212,242,38,0.15)' }}>
          <ShieldCheck size={14} style={{ color: '#4ade80', marginTop: '2px', flexShrink: 0 }} />
          <span style={{ color: '#9cc4b2', fontSize: '0.78rem' }}>
            Los premios son <strong style={{ color: '#d4f226' }}>fijos y garantizados</strong> por la organización (la UP cubre la diferencia):
            no dependen de cuántos jueguen. Los 12 países eliminados en Cuartos (5°–8°) y Octavos (9°–16°) reciben vale para el Nessu.
          </span>
        </div>
      </Card>

      <Card icon={<Target size={16} style={{ color: '#d4f226' }} />} title="¿CÓMO PARTICIPAR?">
        <div className="flex flex-col gap-3">
          {[
            { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate con tu correo y contraseña.' },
            { step: '2', title: 'Compra tu boleto', desc: `Ve a la Quiniela y compra uno o varios boletos de ${money(config.rifaFee, config.currency)}.` },
            { step: '3', title: 'Confirma tu pago', desc: 'Usa "Confirmar transferencia" y sube tu comprobante antes del primer partido.' },
            { step: '4', title: 'Recibe tu país', desc: `Cuando se llenan los ${POOL_CAPACITY} boletos, el sorteo te asigna una selección y te avisa por correo.` },
            { step: '5', title: 'Sigue a tu equipo', desc: 'Mientras más lejos llegue tu país, mejor premio. Ve "Cómo va el premio" en vivo.' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(212,242,38,0.15)', border: '1px solid rgba(212,242,38,0.2)' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.8rem', fontWeight: 700 }}>{item.step}</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem', letterSpacing: '0.03em' }}>{item.title}</div>
                <div style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans', marginTop: '2px' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card icon={<HelpCircle size={16} style={{ color: '#7eb89a' }} />} title="PREGUNTAS FRECUENTES">
        {[
          { q: '¿Qué pasa si no se llenan los 48 boletos?', a: 'La rifa no se realiza y se te regresa íntegro tu dinero. Solo corre cuando se vende un boleto por cada país.' },
          { q: '¿Hasta cuándo me registro y pago?', a: 'Antes del primer partido del Mundial: jueves 11 de junio de 2026. Registro y pago cierran ese día.' },
          { q: '¿Puedo escoger mi país?', a: 'No. El país se asigna al azar mediante un sorteo verificable con semilla auditable; nadie puede elegir o cambiar su selección.' },
          { q: '¿Cómo se reparten los premios?', a: '1° a 4° lugar reciben premio en efectivo según la posición final de su país en el Mundial; los eliminados en Cuartos y Octavos (lugares 5° a 16°) reciben un vale para el Nessu.' },
          { q: '¿Cómo veo cómo va mi premio?', a: 'En la página de la Quiniela ves tu país, qué tan lejos va y la sección "Cómo va el premio" que se actualiza con los resultados.' },
        ].map((faq, i, arr) => (
          <div key={i} className="py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.85rem', letterSpacing: '0.03em', marginBottom: '4px' }}>{faq.q}</div>
            <div style={{ color: '#9cc4b2', fontSize: '0.82rem', fontFamily: 'Nunito Sans', lineHeight: 1.5 }}>{faq.a}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ExplanationsPage({ config }: { config: AppConfig }) {
  const [mode, setMode] = useState<'pantera' | 'quiniela'>('pantera');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 p-6" style={{ background: 'linear-gradient(135deg, #062b1a 0%, #0a3d28 100%)', border: '1px solid rgba(245,166,35,0.2)' }}>
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'repeating-linear-gradient(90deg, #f5a623 0px, #f5a623 8px, #d4f226 8px, #d4f226 16px, #0a3d28 16px, #0a3d28 24px)' }} />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5a623, #e8890f)' }}>
            <HelpCircle size={28} style={{ color: '#062b1a' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              CÓMO FUNCIONA {mode === 'pantera' ? 'PRONOSTICA PANTERA' : 'LA QUINIELA'}
            </h1>
            <p style={{ color: '#7eb89a', fontSize: '0.85rem' }}>
              <strong>Pantera Mundialista</strong> (Mundial FIFA 2026, Universidad Panamericana) tiene dos modalidades:
              <strong> Pronostica Pantera</strong> (predices resultados y ganas por puntos) y la <strong>Quiniela</strong>
              (te asignan una selección al azar). Elige abajo las reglas que quieres revisar.
            </p>
          </div>
        </div>
      </div>

      {/* Mode switch */}
      <div className="flex gap-2 mb-6">
        {([
          ['pantera', 'Pronostica Pantera', <Zap size={14} key="z" />],
          ['quiniela', 'Quiniela', <Dice5 size={14} key="d" />],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setMode(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg cursor-pointer transition-all"
            style={{
              fontFamily: 'Oswald, sans-serif', fontSize: '0.82rem', letterSpacing: '0.04em',
              background: mode === key ? '#f5a623' : '#0d5035',
              color: mode === key ? '#062b1a' : '#9cc4b2',
              border: '1px solid rgba(245,166,35,0.25)',
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'quiniela' && <QuinielaRules config={config} />}

      {mode === 'pantera' && (
      <div className="grid gap-5">
        {/* Qué es */}
        <Card icon={<Star size={16} style={{ color: '#f5a623' }} />} title="¿QUÉ ES PRONOSTICA PANTERA?">
          <p style={{ color: '#c0d8cc', fontSize: '0.88rem', fontFamily: 'Nunito Sans, sans-serif', lineHeight: 1.6, marginBottom: '12px' }}>
            Pronostica Pantera es una de las dos modalidades de Pantera Mundialista (Mundial FIFA 2026, Universidad Panamericana): un torneo de pronósticos deportivos donde cada participante predice los resultados. Ganas puntos cuando tus pronósticos coinciden con los resultados reales. La otra modalidad es la <strong>Quiniela</strong>, en la que te asignan una selección al azar.
          </p>
          <p style={{ color: '#9cc4b2', fontSize: '0.84rem', fontFamily: 'Nunito Sans, sans-serif', lineHeight: 1.6, marginBottom: '12px' }}>
            El Mundial 2026 son <strong>48 equipos en 12 grupos de 4</strong>: avanzan los 2 primeros de cada grupo más los 8 mejores terceros (32 en total) y de ahí es eliminación directa (<strong style={{ color: '#d4f226' }}>Dieciseisavos → Octavos → Cuartos → Semifinal → Final</strong>).
          </p>
          <BulletItem>Crea <strong>múltiples pronósticos</strong>{paymentConfigured ? ` (máx. ${config.maxPendingPerUser} con pago pendiente a la vez)` : ' (los que quieras)'}.</BulletItem>
          <BulletItem>Accede con tu <strong>correo y contraseña</strong>.</BulletItem>
          <BulletItem>Regístrate y haz tus picks <strong>antes del inicio del torneo</strong> (11 junio 2026); el <strong>pago</strong> se confirma a más tardar el <strong>14 junio 2026</strong>.</BulletItem>
          <BulletItem>Hay <strong>un solo ganador</strong> por variante: el de mayor puntaje (y, en empate, quien se registró primero).</BulletItem>
          <BulletItem>Entra a las <strong>Ligas Aparte</strong> de R32 y R16: torneos independientes de la eliminatoria, sin necesidad del pronóstico principal.</BulletItem>
        </Card>

        {/* Cómo participar */}
        <Card icon={<Target size={16} style={{ color: '#d4f226' }} />} title="¿CÓMO PARTICIPAR?">
          <div className="flex flex-col gap-3">
            {[
              { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate con tu correo y contraseña.' },
              { step: '2', title: 'Crea tus pronósticos', desc: `En "Mis Pronósticos" crea los pronósticos que quieras${paymentConfigured ? ` (máx. ${config.maxPendingPerUser} con pago pendiente a la vez)` : ''}.` },
              { step: '3', title: 'Llena los grupos', desc: 'Para cada grupo A–L, elige qué equipos terminan en 1°, 2° y 3° lugar.' },
              { step: '4', title: 'Pronostica los cruces', desc: 'Avanza por las rondas: dieciséisavos, octavos, cuartos, semis y gran final.' },
              { step: '5', title: 'Paga y confirma', desc: 'Guarda tu pronóstico y confirma tu transferencia en el formulario. Editas hasta el inicio del torneo (11 jun); pagas a más tardar el 14 jun 2026.' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(212,242,38,0.15)', border: '1px solid rgba(212,242,38,0.2)' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.8rem', fontWeight: 700 }}>{item.step}</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem', letterSpacing: '0.03em' }}>{item.title}</div>
                  <div style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans, sans-serif', marginTop: '2px' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sistema de puntos */}
        <Card icon={<Zap size={16} style={{ color: '#f5a623' }} />} title="SISTEMA DE PUNTOS">
          <p style={{ color: '#7eb89a', fontSize: '0.8rem', fontFamily: 'Nunito Sans', marginBottom: '12px' }}>
            Los puntos se otorgan según el acierto de tu pronóstico y la dificultad de la ronda:
          </p>
          <PointRow label="Grupo — posición exacta" pts={2} desc="por cada 1°, 2° y 3° exacto" />
          <PointRow label="Ganador en Dieciséisavos (R32)" pts={3} desc="por equipo que avanza" />
          <PointRow label="Ganador en Octavos (R16)" pts={5} desc="por equipo que avanza" />
          <PointRow label="Ganador en Cuartos" pts={8} desc="por equipo que avanza" />
          <PointRow label="Ganador en Semifinal" pts={13} desc="por equipo que avanza" />
          <PointRow label="Campeón del Mundo" pts={25} desc="si aciertas el campeón" />
          <PointRow label="Subcampeón" pts={10} desc="si aciertas el subcampeón" />
          <PointRow label="Tercer Lugar" pts={7} desc="si aciertas el 3er lugar" />
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.12)' }}>
            <span style={{ color: '#f5a623', fontSize: '0.78rem', fontFamily: 'Nunito Sans' }}>
              En grupos cuenta la <strong>posición exacta</strong> (1°, 2° y 3°). En eliminatorias ganas los
              puntos por cada equipo que pusiste como ganador y que realmente avanzó en esa ronda. Tu puntaje
              se suma en vivo conforme se capturan los resultados oficiales.
            </span>
          </div>
        </Card>

        {/* Cómo se determina el ganador */}
        <Card icon={<Award size={16} style={{ color: '#f5a623' }} />} title="CÓMO SE DETERMINA EL GANADOR">
          <p style={{ color: '#c0d8cc', fontSize: '0.86rem', fontFamily: 'Nunito Sans', lineHeight: 1.6, marginBottom: '12px' }}>
            En Pronostica Pantera hay <strong style={{ color: '#d4f226' }}>un solo ganador</strong>. Se determina así, en orden:
          </p>
          <div className="flex flex-col gap-2.5">
            {[
              { n: '1', t: 'Mayor puntaje total', d: 'Gana el pronóstico con más puntos sumados al terminar el Mundial (con el sistema de puntos de arriba).' },
              { n: '2', t: 'Desempate: quien registró primero', d: 'Si dos o más empatan en puntos, gana quien creó su pronóstico antes (fecha y hora de registro).' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.25)' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.8rem', fontWeight: 700 }}>{s.n}</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem', letterSpacing: '0.03em' }}>{s.t}</div>
                  <div style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans', marginTop: '2px' }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(212,242,38,0.06)', border: '1px solid rgba(212,242,38,0.15)' }}>
            <span style={{ color: '#d4f226', fontSize: '0.78rem', fontFamily: 'Nunito Sans' }}>
              Como el desempate usa la fecha exacta de registro (única para cada pronóstico),
              <strong> siempre queda un único ganador</strong>, nunca un empate. Esto aplica igual a cada variante
              (Principal, Liga R32 y Liga R16): cada una tiene su propio ganador y su propio bote.
            </span>
          </div>
        </Card>

        {/* Premios */}
        <Card icon={<Trophy size={16} style={{ color: '#f5a623' }} />} title="PREMIOS · EL GANADOR SE LLEVA EL BOTE">
          <p style={{ color: '#c0d8cc', fontSize: '0.88rem', fontFamily: 'Nunito Sans', lineHeight: 1.6, marginBottom: '14px' }}>
            Pronostica Pantera es <strong style={{ color: '#d4f226' }}>"el ganador se lleva todo"</strong>: el único ganador de cada
            variante se queda con el bote de esa variante. El <strong>bote</strong> es la suma de todos los boletos pagados
            (boletos pagados × cuota). Publicamos como premio el <strong style={{ color: '#d4f226' }}>{Math.round(config.payoutPercent * 100)}%</strong> de
            ese bote — dejamos un pequeño margen por si algo sale mal, así el premio anunciado siempre se cumple.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'main', label: 'Principal', desc: 'Pronóstico completo, desde la fase de grupos.', color: '#f5a623' },
              { key: 'r32', label: 'Liga R32', desc: 'Liga aparte de Dieciseisavos.', color: '#d4f226' },
              { key: 'r16', label: 'Liga R16', desc: 'Liga aparte de Octavos.', color: '#9cc4b2' },
            ].map(v => (
              <div key={v.key} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${v.color}20` }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: v.color, fontSize: '1rem', letterSpacing: '0.05em' }}>{v.label}</div>
                <div style={{ color: '#7eb89a', fontSize: '0.74rem', fontFamily: 'Nunito Sans', marginTop: '4px', minHeight: '32px' }}>{v.desc}</div>
                <div className="mt-2 py-1.5 px-3 rounded-lg" style={{ background: `${v.color}12`, color: v.color, fontSize: '0.7rem', fontFamily: 'DM Mono' }}>
                  bote propio · 1 ganador
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg flex items-start gap-2" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.15)' }}>
            <Star size={14} style={{ color: '#f5a623', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ color: '#f5a623', fontSize: '0.78rem', fontFamily: 'Nunito Sans' }}>
              No hay 2° ni 3° lugar: el premio completo es para <strong>un solo ganador</strong> por variante. El bote
              crece conforme se confirman los pagos y lo puedes seguir <strong>en vivo desde el inicio</strong>.
            </span>
          </div>
        </Card>

        {/* FAQ */}
        <Card icon={<HelpCircle size={16} style={{ color: '#7eb89a' }} />} title="PREGUNTAS FRECUENTES">
          {[
            { q: '¿Hasta cuándo me puedo registrar?', a: 'Tus pronósticos se bloquean al inicio del primer partido: jueves 11 de junio de 2026. Hasta ese momento puedes crear y editar tus pronósticos cuantas veces quieras.' },
            { q: '¿Hasta cuándo tengo para pagar?', a: 'El registro de los picks cierra el 11 de junio (inicio del torneo), pero tienes hasta el domingo 14 de junio de 2026 para confirmar tu pago. Los pronósticos con pago pendiente después de esa fecha se anulan.' },
            { q: '¿Cómo se decide el ganador?', a: 'Gana el pronóstico con más puntos al terminar el Mundial. Si hay empate, gana quien se registró primero, de modo que siempre hay un único ganador. Cada variante (Principal, Liga R32 y Liga R16) tiene su propio ganador y su propio bote.' },
            { q: '¿Qué son las Ligas Aparte de R32 y R16?', a: 'Son torneos independientes de la fase eliminatoria, que no requieren el pronóstico principal. Eliges una combinación que arma tu cuadro desde dieciseisavos (R32) u octavos (R16); los equipos se actualizan solos conforme avanzan los resultados, así que quien entra más tarde ya sabe qué equipos pasaron y elige mejor. Cada liga tiene su propio bote y su propio ganador.' },
            { q: '¿Cómo veo quién va ganando?', a: 'La clasificación general es privada del organizador. Tú ves los puntos de tus propios pronósticos en el inicio.' },
            { q: '¿Cómo confirmo mi pago?', a: 'Al guardar un pronóstico, usa el botón "Confirmar transferencia" para enviar tu comprobante en el formulario. El organizador marca tu pago como confirmado.' },
          ].map((faq, i, arr) => (
            <div key={i} className="py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', color: '#d4f226', fontSize: '0.85rem', letterSpacing: '0.03em', marginBottom: '4px' }}>
                {faq.q}
              </div>
              <div style={{ color: '#9cc4b2', fontSize: '0.82rem', fontFamily: 'Nunito Sans, sans-serif', lineHeight: 1.5 }}>
                {faq.a}
              </div>
            </div>
          ))}
        </Card>
      </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
          <Trophy size={14} style={{ color: '#f5a623', opacity: 0.5 }} />
          <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
        </div>
        <p style={{ color: '#3a6b55', fontSize: '0.72rem', fontFamily: 'DM Mono' }}>
          PANTERA MUNDIALISTA · UNIVERSIDAD PANAMERICANA · MUNDIAL 2026 · ESTADOS UNIDOS · CANADÁ · MÉXICO
        </p>
      </div>
    </div>
  );
}

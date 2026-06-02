import { ReactNode } from 'react';
import { Trophy, Star, Target, Award, HelpCircle, CheckCircle2, Zap } from 'lucide-react';
import type { AppConfig } from '../data/worldcup';

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

export function ExplanationsPage({ config }: { config: AppConfig }) {
  const phases = [
    { num: 1, label: 'Fase de Grupos', desc: '48 equipos · 12 grupos de 4 · Top 2 de cada grupo + 8 mejores 3ros clasifican' },
    { num: 2, label: 'Dieciséisavos (Ronda de 32)', desc: '32 equipos · 16 partidos del 28 jun al 3 jul · eliminación directa' },
    { num: 3, label: 'Octavos de Final', desc: '16 equipos · 8 partidos' },
    { num: 4, label: 'Cuartos de Final', desc: '8 equipos · 4 partidos' },
    { num: 5, label: 'Semifinal', desc: '4 equipos · 2 partidos' },
    { num: 6, label: 'Final y 3er Lugar', desc: '2 partidos · Campeón del Mundo' },
  ];

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
              CÓMO FUNCIONA LA QUINELA
            </h1>
            <p style={{ color: '#7eb89a', fontSize: '0.85rem' }}>
              Guía completa para participar en la Quinela del Mundial FIFA 2026
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {/* Qué es */}
        <Card icon={<Star size={16} style={{ color: '#f5a623' }} />} title="¿QUÉ ES LA QUINELA?">
          <p style={{ color: '#c0d8cc', fontSize: '0.88rem', fontFamily: 'Nunito Sans, sans-serif', lineHeight: 1.6, marginBottom: '12px' }}>
            La quinela es un torneo de pronósticos deportivos donde cada participante predice los resultados del Mundial FIFA 2026. Ganas puntos cuando tus pronósticos coinciden con los resultados reales.
          </p>
          <BulletItem>Crea <strong>múltiples quinelas</strong> (máx. {config.maxPendingPerUser} con pago pendiente a la vez).</BulletItem>
          <BulletItem>Accede con tu <strong>correo y contraseña</strong>, con verificación por email.</BulletItem>
          <BulletItem>Los picks deben hacerse <strong>antes del inicio del torneo</strong> (11 junio 2026).</BulletItem>
          <BulletItem>Tras el inicio puedes comprar <strong>arreglos</strong> de R32 y R16 que compiten en ligas aparte.</BulletItem>
        </Card>

        {/* Cómo participar */}
        <Card icon={<Target size={16} style={{ color: '#d4f226' }} />} title="¿CÓMO PARTICIPAR?">
          <div className="flex flex-col gap-3">
            {[
              { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate con tu correo y contraseña, y confirma el correo de verificación que te enviamos.' },
              { step: '2', title: 'Crea tus quinelas', desc: `En "Mis Pronósticos" crea las quinelas que quieras (máx. ${config.maxPendingPerUser} con pago pendiente a la vez).` },
              { step: '3', title: 'Llena los grupos', desc: 'Para cada grupo A–L, elige qué equipos terminan en 1°, 2° y 3° lugar.' },
              { step: '4', title: 'Pronostica los cruces', desc: 'Avanza por las rondas: dieciséisavos, octavos, cuartos, semis y gran final.' },
              { step: '5', title: 'Paga y confirma', desc: 'Guarda tu quinela y confirma tu transferencia en el formulario. Editable hasta el inicio del torneo.' },
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
              puntos por cada equipo que pusiste como ganador y que realmente avanzó en esa ronda. Si hay
              empate en puntos, gana quien registró su quinela primero — así siempre hay un único ganador.
            </span>
          </div>
        </Card>

        {/* Formato del torneo */}
        <Card icon={<Trophy size={16} style={{ color: '#f5a623' }} />} title="FORMATO DEL MUNDIAL 2026">
          <div className="flex flex-col gap-2">
            {phases.map(phase => (
              <div key={phase.num} className="flex items-center gap-3 py-2" style={{ borderBottom: phase.num < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.1)' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '0.8rem', fontWeight: 700 }}>{phase.num}</span>
                </div>
                <div className="flex-1">
                  <div style={{ fontFamily: 'Oswald, sans-serif', color: '#e0f0e8', fontSize: '0.85rem' }}>{phase.label}</div>
                  <div style={{ color: '#4a7d65', fontSize: '0.7rem', fontFamily: 'DM Mono' }}>{phase.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(212,242,38,0.05)', border: '1px solid rgba(212,242,38,0.12)' }}>
            <p style={{ color: '#d4f226', fontSize: '0.78rem', fontFamily: 'Nunito Sans' }}>
              🌍 Esta es la primera Copa del Mundo con 48 equipos, 12 grupos y una nueva fase de dieciséisavos. De los 12 terceros lugares, 8 avanzan (los mejores clasificados) y 4 quedan eliminados.
            </p>
          </div>
        </Card>

        {/* Premios */}
        <Card icon={<Award size={16} style={{ color: '#f5a623' }} />} title="PREMIOS Y RECONOCIMIENTOS">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { pos: '1°', icon: '🥇', label: 'Primer Lugar', reward: 'Premio mayor', color: '#f5a623' },
              { pos: '2°', icon: '🥈', label: 'Segundo Lugar', reward: 'Premio segundo', color: '#9cc4b2' },
              { pos: '3°', icon: '🥉', label: 'Tercer Lugar', reward: 'Premio tercero', color: '#cd7f32' },
            ].map(p => (
              <div key={p.pos} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}20` }}>
                <div className="text-3xl mb-2">{p.icon}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', color: p.color, fontSize: '0.9rem', letterSpacing: '0.05em' }}>{p.pos} LUGAR</div>
                <div style={{ color: '#7eb89a', fontSize: '0.78rem', fontFamily: 'Nunito Sans', marginTop: '4px' }}>{p.label}</div>
                <div className="mt-3 py-1.5 px-3 rounded-lg" style={{ background: `${p.color}12`, color: p.color, fontSize: '0.72rem', fontFamily: 'DM Mono' }}>
                  {p.reward}
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: '#4a7d65', fontSize: '0.75rem', fontFamily: 'Nunito Sans', marginTop: '12px', textAlign: 'center' }}>
            Cada liga reparte el {Math.round(config.payoutPercent * 100)}% del bote acumulado (redondeado). Los premios los define el organizador.
          </p>
        </Card>

        {/* FAQ */}
        <Card icon={<HelpCircle size={16} style={{ color: '#7eb89a' }} />} title="PREGUNTAS FRECUENTES">
          {[
            { q: '¿Cuándo cierran los pronósticos?', a: 'Los picks se bloquean al inicio del primer partido: jueves 11 de junio de 2026.' },
            { q: '¿Puedo cambiar mi quinela antes del cierre?', a: 'Sí, puedes editarla cuantas veces quieras hasta el cierre.' },
            { q: '¿Qué son los "arreglos" de R32 y R16?', a: 'Tras el inicio del torneo puedes pagar para volver a pronosticar desde dieciseisavos (R32) u octavos (R16). Cada arreglo compite en su propia liga con premio aparte; no afecta tu quinela principal.' },
            { q: '¿Cómo veo quién va ganando?', a: 'La clasificación general es privada del organizador. Tú ves los puntos de tus propias quinelas en el inicio.' },
            { q: '¿Cómo confirmo mi pago?', a: 'Al guardar una quinela, usa el botón "Confirmar transferencia" para enviar tu comprobante en el formulario. El organizador marca tu pago como confirmado.' },
          ].map((faq, i) => (
            <div key={i} className="py-3" style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
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

      {/* Footer */}
      <div className="mt-6 text-center">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
          <Trophy size={14} style={{ color: '#f5a623', opacity: 0.5 }} />
          <div className="flex-1 h-px" style={{ background: 'rgba(245,166,35,0.15)' }} />
        </div>
        <p style={{ color: '#3a6b55', fontSize: '0.72rem', fontFamily: 'DM Mono' }}>
          PRONOSTICA PANTERA · MUNDIAL 2026 · ESTADOS UNIDOS · CANADÁ · MÉXICO
        </p>
      </div>
    </div>
  );
}

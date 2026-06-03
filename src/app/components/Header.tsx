import { Trophy, Menu, X, User, LogOut, Shield } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../App';

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userName: string;
  isAdmin: boolean;
  showRifa: boolean;
  onLogout: () => void;
}

const BASE_NAV: { label: string; page: Page }[] = [
  { label: 'Inicio', page: 'home' },
  { label: 'Partidos', page: 'results' },
  { label: 'Mis Pronósticos', page: 'my-predictions' },
  { label: 'Reglas', page: 'explanations' },
];

export function Header({ currentPage, onNavigate, userName, isAdmin, showRifa, onLogout }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = [
    ...BASE_NAV.slice(0, 3),
    ...(showRifa ? [{ label: 'Quiniela', page: 'rifa' as Page }] : []),
    ...BASE_NAV.slice(3),
    ...(isAdmin ? [{ label: 'Admin', page: 'admin' as Page }] : []),
  ];

  return (
    <header className="sticky top-0 z-50" style={{ background: '#062b1a', borderBottom: '2px solid rgba(245,166,35,0.3)' }}>
      <div className="h-1.5 w-full" style={{ background: 'repeating-linear-gradient(90deg, #f5a623 0px, #f5a623 8px, #d4f226 8px, #d4f226 16px, #0a3d28 16px, #0a3d28 24px)' }} />

      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <button onClick={() => onNavigate('home')} className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#f5a623' }}>
            <Trophy size={16} style={{ color: '#062b1a' }} />
          </div>
          <div className="leading-none">
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#f5a623', fontSize: '14px', fontWeight: 700, letterSpacing: '0.05em' }}>PANTERA MUNDIALISTA</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', color: '#7eb89a', fontSize: '10px', letterSpacing: '0.1em' }}>MUNDIAL 2026</div>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className="px-3 py-1.5 rounded transition-all duration-150 flex items-center gap-1"
              style={{
                fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '0.06em',
                color: currentPage === item.page ? '#f5a623' : '#b8d4c4',
                background: currentPage === item.page ? 'rgba(245,166,35,0.12)' : 'transparent',
                borderBottom: currentPage === item.page ? '2px solid #f5a623' : '2px solid transparent',
              }}>
              {item.page === 'admin' && <Shield size={12} />}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => onNavigate('my-predictions')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
              style={{ background: '#f5a623', color: '#062b1a', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.05em', fontWeight: 700, maxWidth: '160px' }}>
              <User size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
            </button>
            <button onClick={onLogout} title="Cerrar sesión" className="p-1.5 rounded transition-colors cursor-pointer" style={{ color: '#7eb89a' }}>
              <LogOut size={14} />
            </button>
          </div>

          <button className="md:hidden p-1 rounded cursor-pointer" style={{ color: '#f5a623' }} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-1" style={{ background: '#062b1a' }}>
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => { onNavigate(item.page); setMenuOpen(false); }}
              className="text-left px-3 py-2 rounded flex items-center gap-2"
              style={{
                fontFamily: 'Oswald, sans-serif', fontSize: '15px',
                color: currentPage === item.page ? '#f5a623' : '#b8d4c4',
                background: currentPage === item.page ? 'rgba(245,166,35,0.1)' : 'transparent',
              }}>
              {item.page === 'admin' && <Shield size={13} />}
              {item.label}
            </button>
          ))}
          <button onClick={() => { onLogout(); setMenuOpen(false); }} className="text-left px-3 py-2 rounded flex items-center gap-2" style={{ color: '#7eb89a', fontFamily: 'Oswald, sans-serif', fontSize: '14px' }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      )}

      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, #f5a623, transparent)' }} />
    </header>
  );
}

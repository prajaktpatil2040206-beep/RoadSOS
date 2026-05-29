import { NavLink } from 'react-router-dom';
import {
  Home, MapPin, Navigation, Route, AlertTriangle,
  LayoutDashboard, User, History
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';

const NAV = [
  { to: '/',               icon: Home,            label: 'Home' },
  { to: '/nearme',         icon: MapPin,           label: 'Near Me' },
  { to: '/navigation',     icon: Navigation,       label: 'Navigate' },
  { to: '/journey',        icon: Route,            label: 'Journey' },
  { to: '/report',         icon: AlertTriangle,    label: 'Report SOS' },
  { to: '/dashboard',      icon: LayoutDashboard,  label: 'Incidents' },
  { to: '/report-history', icon: History,          label: 'History' },
  { to: '/profile',        icon: User,             label: 'Profile' },
];

export default function Sidebar() {
  const { user } = useUserStore();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{
        padding: 'var(--sp-5) var(--sp-4)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'
      }}>
        <span style={{ fontSize: '1.6rem' }}>🚨</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>ROADSOS</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 500 }}>Emergency Platform</div>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div style={{
          padding: 'var(--sp-4)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        }}>
          {user.photoBase64 ? (
            <img src={user.photoBase64} alt="avatar"
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--primary-soft)', border: '2px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', flexShrink: 0,
            }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)' }} className="truncate">{user.name}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{user.sosId || ''}</div>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="nav-section" style={{ flex: 1 }}>
        <div className="nav-label">Navigation</div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'center' }}>
          ROADSOS v1.0 · Global Emergency Platform
        </div>
      </div>
    </aside>
  );
}

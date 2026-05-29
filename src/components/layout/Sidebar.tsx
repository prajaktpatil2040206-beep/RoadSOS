import { NavLink } from 'react-router-dom';
import {
  Home, MapPin, Navigation, Route, AlertTriangle,
  LayoutDashboard, User, History, Zap, ChevronRight
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';

const NAV = [
  { to: '/',               icon: Home,           label: 'Home',      end: true },
  { to: '/nearme',         icon: MapPin,         label: 'Near Me',   end: false },
  { to: '/navigation',     icon: Navigation,     label: 'Navigate',  end: false },
  { to: '/journey',        icon: Route,          label: 'Journey',   end: false },
  { to: '/report',         icon: AlertTriangle,  label: 'Report SOS',end: false },
  { to: '/dashboard',      icon: LayoutDashboard,label: 'Incidents', end: false },
  { to: '/report-history', icon: History,        label: 'History',   end: false },
  { to: '/profile',        icon: User,           label: 'Profile',   end: false },
];

export default function Sidebar() {
  const { user } = useUserStore();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{
        padding: '1.25rem 1rem',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: '0.625rem',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Zap size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#0F172A', lineHeight: 1.2 }}>
            ROAD<span style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SOS</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 500, letterSpacing: '0.04em' }}>Emergency Platform</div>
        </div>
      </div>

      {/* User card */}
      {user && (
        <div style={{
          margin: '0.75rem',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: '1px solid #C7D2FE',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          {user.photoBase64 ? (
            <img src={user.photoBase64} alt="avatar"
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #4F46E5' }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
            }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1E1B4B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: '0.65rem', color: '#6366F1', fontFamily: 'monospace', fontWeight: 500 }}>{user.sosId || 'No SOS ID'}</div>
          </div>
          <ChevronRight size={14} color="#6366F1" />
        </div>
      )}

      {/* Navigation */}
      <nav className="nav-section" style={{ flex: 1 }}>
        <div className="nav-label">Navigation</div>
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={16} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.875rem 1rem',
        borderTop: '1px solid #E2E8F0',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 500 }}>
          ROADSOS v1.0 · Global Emergency Platform
        </div>
      </div>
    </aside>
  );
}

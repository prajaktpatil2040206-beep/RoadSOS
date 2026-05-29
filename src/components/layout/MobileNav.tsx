import { NavLink } from 'react-router-dom';
import { Home, MapPin, AlertTriangle, History, User } from 'lucide-react';

const ITEMS = [
  { to: '/',               icon: Home,          label: 'Home',    end: true  },
  { to: '/nearme',         icon: MapPin,        label: 'Near',    end: false },
  { to: '/report',         icon: AlertTriangle, label: 'SOS',     end: false },
  { to: '/report-history', icon: History,       label: 'History', end: false },
  { to: '/profile',        icon: User,          label: 'Profile', end: false },
];

export default function MobileNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            {label === 'SOS' ? (
              /* Prominent floating SOS button */
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -24,
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.45)',
                border: '3px solid #FFFFFF',
                flexShrink: 0,
              }}>
                <Icon size={20} color="#fff" />
              </div>
            ) : (
              <Icon size={20} strokeWidth={1.75} />
            )}
            {label !== 'SOS' && (
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em' }}>{label}</span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

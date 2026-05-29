import { NavLink } from 'react-router-dom';
import { Home, MapPin, AlertTriangle, History, User } from 'lucide-react';

const ITEMS = [
  { to: '/',              icon: Home,          label: 'Home'    },
  { to: '/nearme',        icon: MapPin,        label: 'Near'    },
  { to: '/report',        icon: AlertTriangle, label: 'SOS'     },
  { to: '/report-history',icon: History,       label: 'History' },
  { to: '/profile',       icon: User,          label: 'Profile' },
];

export default function MobileNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            {label === 'SOS'
              ? <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--red)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  marginTop: -20, boxShadow: '0 4px 16px rgba(239,68,68,0.5)',
                }}>
                  <Icon size={20} color="#fff" />
                </div>
              : <Icon size={20} />
            }
            {label !== 'SOS' && <span>{label}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

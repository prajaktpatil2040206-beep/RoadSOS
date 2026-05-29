import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import NetworkBadge from '../common/NetworkBadge';
import { LogOut, User, Zap } from 'lucide-react';

export default function Header() {
  const { user, setUser } = useUserStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    navigate('/login');
  }

  return (
    <header className="header">
      {/* Logo */}
      <Link to="/" className="header-logo" style={{ textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Zap size={17} color="#fff" fill="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#0F172A' }}>
          ROAD<span style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SOS</span>
        </span>
      </Link>

      {/* Center space */}
      <div style={{ flex: 1 }} />

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <NetworkBadge />

        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.25rem 0.75rem 0.25rem 0.375rem',
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 'var(--r-full)', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            {user.photoBase64 ? (
              <img src={user.photoBase64} alt="avatar"
                style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              }}>
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name?.split(' ')[0]}
            </span>
          </div>
        )}

        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={handleLogout}
          title="Sign out"
          style={{ color: '#64748B' }}
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}

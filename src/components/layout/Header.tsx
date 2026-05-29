import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import NetworkBadge from '../common/NetworkBadge';
import { Bell, LogOut, User } from 'lucide-react';

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
      <Link to="/" className="header-logo">
        <span style={{ fontSize: '1.4rem' }}>🚨</span>
        <span>ROAD<span style={{ color: '#fff' }}>SOS</span></span>
      </Link>

      <div style={{ flex: 1 }} />

      <NetworkBadge />

      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/profile')}>
        <User size={18} />
      </button>

      <button className="btn btn-ghost btn-icon btn-sm" onClick={handleLogout} title="Logout">
        <LogOut size={18} />
      </button>
    </header>
  );
}

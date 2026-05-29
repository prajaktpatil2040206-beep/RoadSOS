import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { AlertCircle, Eye, EyeOff, Shield, Siren } from 'lucide-react';
import { auth } from '../firebase';
import { saveUserProfile, getUserProfile } from '../services/userService';
import { useUserStore } from '../store/userStore';
import toast from 'react-hot-toast';
import type { UserRole } from '../types';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useUserStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const profile = await getUserProfile(cred.user.uid);
        if (profile) {
          setUser(profile);
          toast.success(`Welcome back, ${profile.name}!`);
          navigate('/');
        } else {
          navigate('/profile/edit');
        }
      } else {
        if (!name.trim()) throw new Error('Name is required');
        if (!phone.trim()) throw new Error('Phone number is required');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
          uid: cred.user.uid,
          email,
          name: name.trim(),
          phone: phone.trim(),
          role,
          createdAt: Date.now(),
        };
        await saveUserProfile(profile);
        setUser(profile);
        toast.success('Account created! Complete your profile.');
        navigate('/profile/edit');
      }
    } catch (err: any) {
      const msg = err.message || 'Something went wrong';
      setError(
        msg.includes('user-not-found') ? 'No account with this email' :
        msg.includes('wrong-password') ? 'Incorrect password' :
        msg.includes('email-already') ? 'Email already registered' :
        msg.includes('weak-password') ? 'Password must be at least 6 characters' :
        msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 'var(--sp-4)',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)', border: '2px solid var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 32,
          }}>🚨</div>
          <h1 style={{ color: 'var(--primary)', letterSpacing: '0.05em' }}>ROADSOS</h1>
          <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Emergency Response Platform</p>
        </div>

        <div className="card">
          {/* Mode tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-base)',
            borderRadius: 'var(--r-md)', padding: 3, marginBottom: 24,
          }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, height: 36, border: 'none', borderRadius: 'var(--r-sm)',
                  background: mode === m ? 'var(--primary)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-2)',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="label">Full Name *</label>
                  <input className="input" type="text" value={name}
                    onChange={e => setName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div className="form-group">
                  <label className="label">Phone Number *</label>
                  <input className="input" type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" required />
                </div>
                <div className="form-group">
                  <label className="label">Account Type</label>
                  <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                    <option value="user">🚗 Road User / Commuter</option>
                    <option value="hospital">🏥 Hospital / Medical</option>
                    <option value="police">🚔 Police Station</option>
                    <option value="fire">🚒 Fire Station</option>
                    <option value="towing">🚛 Towing Service</option>
                    <option value="mechanic">🔧 Mechanic / Puncture Shop</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="label">Email Address *</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>

            <div className="form-group">
              <label className="label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                    display: 'flex', alignItems: 'center',
                  }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'var(--red-soft)', borderRadius: 'var(--r-md)',
                color: 'var(--red)', fontSize: '0.84rem',
              }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <><div className="spinner" /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</> :
                mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{
            marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <Link to="/responder/login"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-2)' }}>
              <Shield size={14} />
              Hospital / Police Responder Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

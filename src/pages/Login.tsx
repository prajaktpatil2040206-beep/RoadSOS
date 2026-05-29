import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { AlertCircle, Eye, EyeOff, Shield, Zap, ArrowRight } from 'lucide-react';
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
      minHeight: '100vh',
      display: 'flex',
      background: '#F8FAFC',
      overflow: 'auto',
    }}>
      {/* Left panel — decorative (hidden on mobile) */}
      <div style={{
        display: 'none',
        width: '45%',
        flexShrink: 0,
        background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 40%, #7C3AED 100%)',
        padding: '3rem',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left-panel">
        {/* Blobs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', position: 'relative' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={22} color="#fff" fill="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>ROADSOS</span>
        </div>

        {/* Copy */}
        <div style={{ position: 'relative' }}>
          <h1 style={{
            color: '#fff', fontSize: '2.25rem', fontWeight: 800,
            lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '1rem',
          }}>
            Emergency help,<br />one tap away.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            Find hospitals, police, towing services and more — instantly. Report road incidents and help save lives.
          </p>
          {/* Feature badges */}
          {['Find nearby emergency services', 'Report road incidents', 'Real-time navigation', 'Offline journey planning'].map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '0.625rem',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', fontWeight: 500 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', position: 'relative' }}>
          Trusted by thousands of road users across India
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile brand */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)',
            }}>
              <Zap size={26} color="#fff" fill="#fff" />
            </div>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
              {mode === 'login' ? 'Sign in to your ROADSOS account' : 'Join the emergency response network'}
            </p>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex',
            background: '#F1F5F9',
            borderRadius: 'var(--r-full)',
            padding: 3,
            marginBottom: '1.5rem',
            gap: 3,
          }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, height: 38, border: 'none',
                  borderRadius: 'var(--r-full)',
                  background: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#0F172A' : '#64748B',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94A3B8', display: 'flex', alignItems: 'center', padding: 0,
                  }}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width: '100%', marginTop: '0.25rem' }}>
              {loading
                ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={17} /></>
              }
            </button>
          </form>

          {/* Responder portal link */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #E2E8F0',
            textAlign: 'center',
          }}>
            <Link to="/responder/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.82rem', color: '#64748B',
                padding: '0.5rem 1rem', borderRadius: 'var(--r-full)',
                border: '1px solid #E2E8F0', background: '#F8FAFC',
                transition: 'all 0.2s',
                textDecoration: 'none',
              }}>
              <Shield size={14} />
              Hospital / Police Responder Portal
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Show left panel on md+ */}
      <style>{`
        @media (min-width: 768px) {
          .login-left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

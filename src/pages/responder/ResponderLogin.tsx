import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { saveUserProfile, getUserProfile } from '../../services/userService';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserRole } from '../../types';

const RESPONDER_ROLES: { value: UserRole; label: string; icon: string }[] = [
  { value: 'hospital', label: 'Hospital / Medical Centre', icon: '🏥' },
  { value: 'police',   label: 'Police Station',             icon: '🚔' },
  { value: 'fire',     label: 'Fire Station',               icon: '🚒' },
  { value: 'towing',   label: 'Towing / Rescue Service',   icon: '🚛' },
  { value: 'mechanic', label: 'Mechanic / Puncture Shop',  icon: '🔧' },
];

export default function ResponderLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('hospital');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [orgName, setOrgName]   = useState('');
  const [address, setAddress]   = useState('');
  const [capacity, setCapacity] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const profile = await getUserProfile(cred.user.uid);
        if (!profile) { setError('No profile found. Please register first.'); setLoading(false); return; }
        if (profile.role === 'user') { setError('This account is not a responder account.'); setLoading(false); return; }
        // Store responder session
        localStorage.setItem('roadsos-responder', JSON.stringify({ uid: cred.user.uid, role: profile.role, name: profile.name, orgName: profile.responderName }));
        toast.success(`Welcome, ${profile.responderName || profile.name}!`);
        navigate('/responder/dashboard');
      } else {
        if (!orgName.trim()) { setError('Organisation name is required'); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
          uid: cred.user.uid,
          email,
          name: name || orgName,
          phone,
          role,
          responderName: orgName,
          responderType: role,
          responderAddress: address,
          responderPhone: phone,
          responderCapacity: parseInt(capacity) || 10,
          createdAt: Date.now(),
        };
        await saveUserProfile(profile);
        localStorage.setItem('roadsos-responder', JSON.stringify({ uid: cred.user.uid, role, name: orgName, orgName }));
        toast.success('Responder account created!');
        navigate('/responder/dashboard');
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
      background: '#F8FAFC', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 480, margin: '2rem 0' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#EEF2FF', border: '3px solid #4F46E5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '2rem', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.2)'
          }}>🛡️</div>
          <h1 style={{ color: '#0F172A', fontWeight: 800, fontSize: '1.6rem' }}>Responder Portal</h1>
          <p style={{ fontSize: '0.9rem', color: '#64748B', marginTop: 4, fontWeight: 500 }}>ROADSOS Emergency Response System</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 'var(--r-md)', padding: 4, marginBottom: 24, border: '1px solid #E2E8F0' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, height: 40, border: 'none', borderRadius: 'var(--r-sm)',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#0F172A' : '#64748B',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  boxShadow: mode === m ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <>
                {/* Role selector */}
                <div className="form-group">
                  <label className="label">Service Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {RESPONDER_ROLES.map(r => (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        style={{
                          padding: '12px 10px', border: `2px solid ${role === r.value ? '#4F46E5' : '#E2E8F0'}`,
                          borderRadius: 'var(--r-md)', background: role === r.value ? '#EEF2FF' : '#F8FAFC',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                        <span style={{ fontSize: '1.4rem' }}>{r.icon}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: role === r.value ? '#4F46E5' : '#64748B', lineHeight: 1.2 }}>
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Organisation / Station Name *</label>
                  <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g., AIIMS Hospital, Koregaon Park Police" required />
                </div>

                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Contact Person</label>
                    <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
                  </div>
                  <div className="form-group">
                    <label className="label">Phone *</label>
                    <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Address</label>
                  <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" />
                </div>

                <div className="form-group">
                  <label className="label">Capacity (beds / units)</label>
                  <input className="input" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g., 50" min="1" />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="label">Email *</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="responder@hospital.com" required />
            </div>

            <div className="form-group">
              <label className="label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--r-md)', color: '#EF4444', fontSize: '0.85rem', fontWeight: 600 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button className="btn btn-lg btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}>
              {loading
                ? <><div className="spinner" style={{ borderWidth: 2 }} /> {mode === 'login' ? 'Signing in…' : 'Registering…'}</>
                : mode === 'login' ? 'Access Dashboard' : 'Register as Responder'
              }
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
            <a href="/login" style={{ fontSize: '0.85rem', color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>← Back to User Login</a>
          </div>
        </div>
      </div>
    </div>
  );
}

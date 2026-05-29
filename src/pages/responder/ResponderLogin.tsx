import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { saveUserProfile, getUserProfile } from '../../services/userService';
import { AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
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
      background: 'var(--bg-base)', padding: 'var(--sp-4)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(59,130,246,0.15)', border: '2px solid var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: '2rem',
          }}>🛡️</div>
          <h1 style={{ color: 'var(--blue)' }}>Responder Portal</h1>
          <p style={{ fontSize: '0.84rem', marginTop: 4 }}>ROADSOS Emergency Response System</p>
        </div>

        <div className="card">
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: 3, marginBottom: 20 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, height: 36, border: 'none', borderRadius: 'var(--r-sm)',
                  background: mode === m ? 'var(--blue)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-2)',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <>
                {/* Role selector */}
                <div className="form-group">
                  <label className="label">Service Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {RESPONDER_ROLES.map(r => (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        style={{
                          padding: '10px 8px', border: `2px solid ${role === r.value ? 'var(--blue)' : 'var(--border)'}`,
                          borderRadius: 'var(--r-md)', background: role === r.value ? 'var(--blue-soft)' : 'var(--bg-card2)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                        <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: role === r.value ? 'var(--blue)' : 'var(--text-2)' }}>
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

                <div className="grid-2" style={{ gap: 10 }}>
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
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--red-soft)', borderRadius: 'var(--r-md)', color: 'var(--red)', fontSize: '0.84rem' }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button className="btn btn-lg" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', background: 'var(--blue)', color: '#fff', border: 'none' }}>
              {loading
                ? <><div className="spinner" /> {mode === 'login' ? 'Signing in…' : 'Registering…'}</>
                : mode === 'login' ? 'Access Dashboard' : 'Register as Responder'
              }
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <a href="/login" style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>← Back to User Login</a>
          </div>
        </div>
      </div>
    </div>
  );
}

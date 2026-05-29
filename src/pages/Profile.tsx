import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import {
  User, Phone, MapPin, Droplets, Car, Users,
  Edit3, LogOut, Shield, Download, Copy, Check
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser } = useUserStore();
  const navigate = useNavigate();
  const qrRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    navigate('/login');
  }

  if (!user) return null;

  const initials = user.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const roleLabel: Record<string, string> = {
    user: '🚗 Road User',
    hospital: '🏥 Hospital',
    police: '🚔 Police',
    fire: '🚒 Fire Station',
    towing: '🚛 Towing Service',
    mechanic: '🔧 Mechanic',
  };

  // QR code data: public profile URL (encodes key info)
  const publicProfileData = JSON.stringify({
    sosId: user.sosId,
    name: user.name,
    phone: user.phone,
    bloodGroup: user.bloodGroup,
    address: user.address,
    city: user.city,
    country: user.country,
    emergencyContact: user.emergencyContacts?.[0]
      ? `${user.emergencyContacts[0].name}: ${user.emergencyContacts[0].phone}`
      : null,
    vehicle: user.vehicles?.[0]
      ? `${user.vehicles[0].make} ${user.vehicles[0].model} (${user.vehicles[0].registration})`
      : null,
  });

  function copySOSId() {
    if (!user || !user.sosId) return;
    navigator.clipboard.writeText(user.sosId).then(() => {
      setCopied(true);
      toast.success('SOS ID copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadQR() {
    if (!user || !qrRef.current) return;
    const svgData = new XMLSerializer().serializeToString(qrRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user.sosId || 'roadsos'}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('QR Code downloaded!');
  }

  return (
    <div className="page">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1>My Profile</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/profile/edit')}>
              <Edit3 size={14} /> Edit
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--red)' }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Avatar + basic */}
        <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 18, alignItems: 'center' }}>
          {user.photoBase64 ? (
            <img
              src={user.photoBase64}
              alt="Profile"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--primary-soft)', border: '3px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 4 }}>{user.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{roleLabel[user.role] || user.role}</span>
              {user.bloodGroup && <span className="badge badge-red">🩸 {user.bloodGroup}</span>}
            </div>
            {user.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4 }}>{user.email}</div>}
          </div>
        </div>

        {/* ═══ SOS Identity Card ═══ */}
        <div style={{
          marginBottom: 14,
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a1033 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 'var(--r-xl)', overflow: 'hidden',
        }}>
          {/* Card header stripe */}
          <div style={{
            background: 'linear-gradient(90deg, #7c3aed, #ef4444)',
            padding: '8px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.1em' }}>
              🚨 ROADSOS EMERGENCY IDENTITY CARD
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem', fontWeight: 600 }}>
              FIRST RESPONDER SCAN
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* Left: details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* SOS ID */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  SOS ID
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
                    {user.sosId || 'RSOS-???-????'}
                  </span>
                  <button onClick={copySOSId} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--text-3)', display: 'flex' }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Grid of info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                {[
                  { label: 'Full Name', value: user.name },
                  { label: 'Blood Group', value: user.bloodGroup || '—', highlight: true },
                  { label: 'Phone', value: user.phone || '—' },
                  { label: 'Date of Birth', value: user.dateOfBirth || '—' },
                  { label: 'Gender', value: user.gender || '—' },
                  { label: 'City / Country', value: [user.city, user.country].filter(Boolean).join(', ') || '—' },
                ].map(({ label, value, highlight }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: highlight ? '#ef4444' : '#e2e8f0' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Vehicle */}
              {user.vehicles?.[0] && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Vehicle</div>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {user.vehicles[0].make} {user.vehicles[0].model} • <span style={{ color: '#94a3b8' }}>{user.vehicles[0].registration}</span>
                  </div>
                </div>
              )}

              {/* Emergency contact */}
              {user.emergencyContacts?.[0] && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Emergency Contact</div>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{user.emergencyContacts[0].name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{user.emergencyContacts[0].relation} · {user.emergencyContacts[0].phone}</div>
                </div>
              )}
            </div>

            {/* Right: QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                background: '#fff', borderRadius: 10, padding: 8,
                boxShadow: '0 0 20px rgba(139,92,246,0.3)',
              }}>
                <QRCodeSVG
                  ref={qrRef}
                  value={publicProfileData}
                  size={100}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#111111"
                />
              </div>
              <div style={{ fontSize: '0.6rem', color: '#64748b', textAlign: 'center', maxWidth: 100, lineHeight: 1.4 }}>
                Scan to view emergency profile
              </div>
              <button
                onClick={downloadQR}
                style={{
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#a78bfa',
                  fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Download size={11} /> Save QR
              </button>
            </div>
          </div>

          {/* Allergies warning */}
          {user.medicalInfo?.allergies && (
            <div style={{
              margin: '0 24px 16px', padding: '8px 14px',
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: 8, fontSize: '0.8rem', color: '#f97316',
            }}>
              ⚠️ <strong>Allergies:</strong> {user.medicalInfo.allergies}
            </div>
          )}
        </div>

        {/* Medical Info */}
        {user.medicalInfo && (
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Droplets size={16} color="var(--red)" /> Medical Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {user.medicalInfo.allergies && (
                <div>
                  <div className="label">Allergies</div>
                  <div style={{ color: 'var(--orange)' }}>{user.medicalInfo.allergies}</div>
                </div>
              )}
              {user.medicalInfo.conditions && (
                <div>
                  <div className="label">Medical Conditions</div>
                  <div>{user.medicalInfo.conditions}</div>
                </div>
              )}
              {user.medicalInfo.medications && (
                <div>
                  <div className="label">Medications</div>
                  <div>{user.medicalInfo.medications}</div>
                </div>
              )}
              <div>
                <div className="label">Organ Donor</div>
                <div>{user.medicalInfo.organDonor ? '✅ Yes' : '❌ No'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Contacts */}
        {(user.emergencyContacts?.length ?? 0) > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="var(--blue)" /> Emergency Contacts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {user.emergencyContacts!.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--blue)', flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{c.relation} • {c.phone}</div>
                  </div>
                  <a href={`tel:${c.phone}`} style={{ marginLeft: 'auto' }}>
                    <Phone size={16} color="var(--green)" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicles */}
        {(user.vehicles?.length ?? 0) > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Car size={16} color="var(--yellow)" /> Vehicles
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {user.vehicles!.map(v => (
                <div key={v.id} style={{ padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.4rem' }}>{v.type === 'Car' ? '🚗' : v.type === 'Bike' ? '🏍️' : v.type === 'Truck' ? '🚛' : '🚌'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.make} {v.model} <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>({v.color})</span></div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{v.registration} • {v.licenseNumber || 'No DL'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={() => navigate('/profile/edit')} style={{ width: '100%', justifyContent: 'center' }}>
          <Edit3 size={16} /> Complete / Edit Profile
        </button>
      </div>
    </div>
  );
}

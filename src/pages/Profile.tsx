import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import {
  User, Phone, Droplets, Car, Users, Edit3,
  LogOut, Download, Copy, Check, Shield, Heart, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';

// ── Helpers ───────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  user:     'Road User',
  hospital: 'Hospital',
  police:   'Police',
  fire:     'Fire Station',
  towing:   'Towing Service',
  mechanic: 'Mechanic',
};

function InfoRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A', fontFamily: mono ? '"JetBrains Mono", monospace' : undefined }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { user, setUser } = useUserStore();
  const navigate = useNavigate();
  const qrRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    navigate('/login');
  }

  if (!user) return null;

  const initials = user.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

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
    if (!user?.sosId) return;
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
    a.href = url; a.download = `${user.sosId || 'roadsos'}-qr.svg`; a.click();
    URL.revokeObjectURL(url);
    toast.success('QR Code downloaded!');
  }

  async function downloadPDFCard() {
    if (!user || !qrRef.current) return;
    setGeneratingPDF(true);
    const toastId = toast.loading('Generating Emergency ID Card PDF…');
    try {
      const svgEl = qrRef.current;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const qrDataUrl: string = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = svgUrl;
      });
      URL.revokeObjectURL(svgUrl);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = 210, pageH = 297;
      const cW = 86, cH = 136;
      const cX = (pageW - cW) / 2, cY = 30;

      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('RoadSOS Emergency Identity Card', pageW / 2, 18, { align: 'center' });
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Print, cut, and keep in vehicle dashboard or wallet', pageW / 2, 24, { align: 'center' });

      pdf.setFillColor(220, 225, 235);
      pdf.roundedRect(cX + 1.5, cY + 1.5, cW, cH, 4, 4, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(cX, cY, cW, cH, 4, 4, 'F');
      pdf.setFillColor(79, 70, 229);
      pdf.roundedRect(cX, cY, cW, 26, 4, 4, 'F');
      pdf.rect(cX, cY + 20, cW, 6, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('ROAD SOS', cX + 8, cY + 10);
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(196, 181, 253);
      pdf.text('EMERGENCY IDENTITY CARD', cX + 8, cY + 16);
      pdf.text('FIRST RESPONDER ACCESS', cX + 8, cY + 21);

      let y = cY + 32;
      pdf.setFillColor(238, 242, 255);
      pdf.rect(cX + 4, y - 2, cW - 8, 12, 'F');
      pdf.setDrawColor(79, 70, 229);
      pdf.setLineWidth(0.4);
      pdf.rect(cX + 4, y - 2, cW - 8, 12);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.setTextColor(79, 70, 229);
      pdf.text('SOS ID', cX + 7, y + 2);
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(user.sosId || 'RSOS-???-????', cX + 7, y + 8);

      y += 18;
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text(user.name || 'Unknown', cX + cW / 2, y, { align: 'center' });
      y += 5;
      const roleClean = (user.role || 'User').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(roleClean.toUpperCase(), cX + cW / 2, y, { align: 'center' });
      y += 8;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.25);
      pdf.line(cX + 4, y, cX + cW - 4, y);
      y += 5;

      const infoRows: [string, string][] = [
        ['Blood Group', user.bloodGroup || 'N/A'],
        ['Phone', user.phone || 'N/A'],
        ['Date of Birth', user.dateOfBirth || 'N/A'],
        ['Gender', user.gender || 'N/A'],
        ['City', [user.city, user.country].filter(Boolean).join(', ') || 'N/A'],
      ];
      if (user.vehicles?.[0]) {
        const v = user.vehicles[0];
        infoRows.push(['Vehicle', `${v.make} ${v.model} (${v.registration})`]);
      }
      infoRows.forEach(([label, value]) => {
        pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139);
        pdf.text(label.toUpperCase(), cX + 5, y);
        pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(15, 23, 42);
        const valLines = pdf.splitTextToSize(value, cW - 10);
        pdf.text(valLines[0], cX + 5, y + 4.5);
        y += 10;
      });

      if (user.emergencyContacts?.[0]) {
        const ec = user.emergencyContacts[0];
        pdf.setFillColor(254, 242, 242); pdf.rect(cX + 4, y - 2, cW - 8, 16, 'F');
        pdf.setDrawColor(252, 165, 165); pdf.setLineWidth(0.3); pdf.rect(cX + 4, y - 2, cW - 8, 16);
        pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(220, 38, 38);
        pdf.text('EMERGENCY CONTACT', cX + 7, y + 2);
        pdf.setFontSize(8); pdf.setTextColor(15, 23, 42);
        pdf.text(ec.name, cX + 7, y + 7);
        pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(71, 85, 105);
        pdf.text(`${ec.relation}  -  ${ec.phone}`, cX + 7, y + 12);
        y += 20;
      }

      const qrSize = 32, qrX = cX + (cW - qrSize) / 2, qrY = y + 2;
      pdf.setFillColor(255, 255, 255); pdf.setDrawColor(200, 210, 225); pdf.setLineWidth(0.3);
      pdf.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 'FD');
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139);
      pdf.text('Scan QR for full emergency profile', cX + cW / 2, qrY + qrSize + 7, { align: 'center' });
      pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(15, 23, 42);
      pdf.text(user.sosId || '', cX + cW / 2, qrY + qrSize + 12, { align: 'center' });

      pdf.setFillColor(79, 70, 229);
      pdf.rect(cX, cY + cH - 10, cW, 10, 'F');
      pdf.rect(cX, cY + cH - 14, cW, 4, 'F');
      pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(5.5); pdf.setTextColor(196, 181, 253);
      pdf.text('roadsos.emergency.network', cX + cW / 2, cY + cH - 5, { align: 'center' });

      const instY = cY + cH + 18;
      pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(15, 23, 42);
      pdf.text('Instructions for First Responders', pageW / 2, instY, { align: 'center' });
      ['1. Cut along the dashed lines to get your Emergency ID card.',
       '2. Keep this card in your vehicle dashboard, glove box, or wallet.',
       '3. In case of emergency, scan the QR code with any smartphone camera.',
       '4. The QR code contains your medical info and emergency contacts.']
        .forEach((line, i) => {
          pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
          pdf.text(line, pageW / 2, instY + 7 + i * 6, { align: 'center' });
        });

      pdf.setFillColor(241, 245, 249); pdf.rect(0, pageH - 14, pageW, 14, 'F');
      pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated by RoadSOS Emergency Network on ${new Date().toLocaleDateString()}`, 15, pageH - 6);
      pdf.text(`SOS ID: ${user.sosId || 'N/A'}`, pageW - 15, pageH - 6, { align: 'right' });

      pdf.save(`${user.sosId || 'roadsos'}-emergency-card.pdf`);
      toast.success('Emergency ID Card PDF downloaded!', { id: toastId });
    } catch (err) {
      console.error('Error generating PDF', err);
      toast.error('Failed to generate PDF card.', { id: toastId });
    } finally {
      setGeneratingPDF(false);
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: '2rem' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>My Profile</h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.125rem' }}>Emergency identity &amp; personal details</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/profile/edit')}>
              <Edit3 size={14} /> Edit Profile
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: '#EF4444' }}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* ── User card ── */}
        <div className="card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {user.photoBase64 ? (
            <img src={user.photoBase64} alt="Profile"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid #4F46E5', boxShadow: '0 0 0 4px #EEF2FF' }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1.5rem', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>{user.name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
              <span className="badge badge-primary">{ROLE_LABEL[user.role] || user.role}</span>
              {user.bloodGroup && (
                <span className="badge badge-red">🩸 Blood: {user.bloodGroup}</span>
              )}
            </div>
            {user.email && <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{user.email}</div>}
          </div>
        </div>

        {/* ── Emergency ID Card (dark, branded) ── */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={12} color="#4F46E5" /> Emergency Identity Card
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E1B4B 100%)',
            borderRadius: 16, padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(79, 70, 229, 0.35)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative orb */}
            <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(124, 58, 237, 0.2)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>

                {/* Left: details */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  {/* SOS ID */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.65rem', color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.375rem' }}>System SOS ID</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '1.1rem', fontWeight: 700,
                        color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '0.375rem 0.75rem',
                        borderRadius: 8, letterSpacing: '0.04em',
                      }}>
                        {user.sosId || 'RSOS-???-????'}
                      </div>
                      <button onClick={copySOSId} style={{
                        width: 34, height: 34, borderRadius: 8, border: 'none',
                        background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: copied ? '#34D399' : '#A5B4FC', transition: 'all 0.15s',
                      }}>
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Name</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{user.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Blood Type</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#F87171' }}>{user.bloodGroup || 'UNKNOWN'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Phone</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', fontFamily: '"JetBrains Mono", monospace' }}>{user.phone || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Location</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }} className="truncate">{[user.city, user.country].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                  </div>

                  {user.emergencyContacts?.[0] && (
                    <div style={{
                      marginTop: '0.875rem', padding: '0.75rem', borderRadius: 10,
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#F87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Emergency Contact</div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>{user.emergencyContacts[0].name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.125rem', fontFamily: '"JetBrains Mono", monospace' }}>
                        {user.emergencyContacts[0].relation} · {user.emergencyContacts[0].phone}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: QR code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#fff', padding: 8, borderRadius: 10, boxShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
                    <QRCodeSVG ref={qrRef} value={publicProfileData} size={110} level="M" includeMargin={false} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748B', textAlign: 'center', maxWidth: 110, lineHeight: 1.4 }}>
                    SCAN TO VERIFY OPERATOR STATUS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', minWidth: 110 }}>
                    <button onClick={downloadQR} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                      padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: '#A5B4FC',
                      fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                      <Download size={12} /> QR Code
                    </button>
                    <button onClick={downloadPDFCard} disabled={generatingPDF} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                      padding: '0.5rem', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', cursor: generatingPDF ? 'not-allowed' : 'pointer',
                      color: '#fff', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit',
                      opacity: generatingPDF ? 0.7 : 1, transition: 'all 0.15s',
                    }}>
                      {generatingPDF ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Processing…</> : <><Download size={12} /> Print ID</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Allergy alert ── */}
        {user.medicalInfo?.allergies && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', borderLeft: '4px solid #EF4444' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Critical Medical Alert</div>
              <div style={{ marginTop: '0.125rem' }}>ALLERGY: {user.medicalInfo.allergies.toUpperCase()}</div>
            </div>
          </div>
        )}

        {/* ── Grid sections ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.875rem' }}>

          {/* Medical Info */}
          {user.medicalInfo && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
                <div className="icon-badge icon-badge-danger"><Droplets size={16} /></div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>Medical Parameters</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {user.medicalInfo.conditions && (
                  <InfoRow label="Conditions" value={user.medicalInfo.conditions} />
                )}
                {user.medicalInfo.medications && (
                  <InfoRow label="Medications" value={user.medicalInfo.medications} />
                )}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                    Organ Donor
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: user.medicalInfo.organDonor ? '#10B981' : '#94A3B8',
                    }} />
                    <span style={{ color: user.medicalInfo.organDonor ? '#059669' : '#94A3B8' }}>
                      {user.medicalInfo.organDonor ? 'Authorized' : 'Not registered'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contacts */}
          {(user.emergencyContacts?.length ?? 0) > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
                <div className="icon-badge icon-badge-info"><Users size={16} /></div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>Emergency Contacts</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {user.emergencyContacts!.map((c, i) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#4F46E5', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }} className="truncate">{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: '"JetBrains Mono", monospace' }}>{c.relation.toUpperCase()} · {c.phone}</div>
                    </div>
                    <a href={`tel:${c.phone}`} style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: '#ECFDF5', border: '1px solid #A7F3D0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669',
                    }}>
                      <Phone size={15} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles */}
          {(user.vehicles?.length ?? 0) > 0 && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
                <div className="icon-badge icon-badge-warning"><Car size={16} /></div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>Registered Vehicles</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem' }}>
                {user.vehicles!.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
                  }}>
                    <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>
                      {v.type === 'Car' ? '🚗' : v.type === 'Bike' ? '🏍️' : v.type === 'Truck' ? '🚛' : '🚌'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>{v.make} {v.model}</div>
                      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">{v.color}</span>
                        <span className="badge badge-primary" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{v.registration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Edit CTA */}
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/profile/edit')}
          style={{ width: '100%', marginTop: '1.25rem' }}>
          <Edit3 size={17} /> Update Profile
        </button>
      </div>
    </div>
  );
}

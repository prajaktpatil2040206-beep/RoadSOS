import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { subscribeToAnomaly, resolveAnomaly } from '../services/anomalyService';
import { useUserStore } from '../store/userStore';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import type { Anomaly } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';
import { ArrowLeft, MapPin, CheckCircle, Clock, User, Download } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  reported:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Reported' },
  responding: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'Responding' },
  resolved:   { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'Resolved' },
};

export default function AnomalyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const { isLoaded, loadError } = useGoogleMapsLoader();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  async function getStaticMapBase64(lat: number, lng: number): Promise<string | null> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x300&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Static maps API request failed');
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to load static map image, PDF will render without map image.', e);
      return null;
    }
  }

  async function downloadReportPDF() {
    if (!anomaly) return;
    setGeneratingPDF(true);
    const toastId = toast.loading('Generating Incident Report PDF…');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 15;

      const pdfSev = SEVERITY_META[anomaly.severity];
      const pdfCat = CATEGORY_META[anomaly.category];
      const pdfResponses = Object.values(anomaly.responses || {});

      // ── White background ──
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

      // ── Dark header band ──
      pdf.setFillColor(15, 23, 42); // Slate 900
      pdf.rect(0, 0, pdfWidth, 38, 'F');

      // Indigo accent stripe
      pdf.setFillColor(79, 70, 229); // Indigo 600
      pdf.rect(0, 0, 4, 38, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('RoadSOS Emergency Network', margin + 4, 16);

      pdf.setTextColor(148, 163, 184); // Slate 400
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text('OFFICIAL INCIDENT & RESPONSE REPORT', margin + 4, 23);

      pdf.setFontSize(8);
      pdf.setTextColor(203, 213, 225); // Slate 300
      pdf.text(`Report ID: ${anomaly.id}`, pdfWidth - margin, 16, { align: 'right' });
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pdfWidth - margin, 23, { align: 'right' });

      // ── Category / Severity row ──
      const catLabel = pdfCat.label.toUpperCase();
      const sevLabel = `SEVERITY ${anomaly.severity}/5  -  ${pdfSev.label.toUpperCase()}`;

      // Severity color band
      const sevColors: Record<number, [number,number,number]> = {
        1: [34, 197, 94],   // Green
        2: [132, 204, 22],  // Lime
        3: [234, 179, 8],   // Yellow
        4: [249, 115, 22],  // Orange
        5: [220, 38, 38],   // Red
      };
      const [sr, sg, sb] = sevColors[anomaly.severity] || [100, 100, 100];

      pdf.setFillColor(241, 245, 249); // Slate 100
      pdf.rect(0, 38, pdfWidth, 24, 'F');

      pdf.setFillColor(sr, sg, sb);
      pdf.rect(0, 38, 4, 24, 'F');

      pdf.setTextColor(15, 23, 42); // Slate 900
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(catLabel, margin + 4, 49);

      pdf.setFontSize(9);
      pdf.setFont('Helvetica', 'normal');
      pdf.setTextColor(71, 85, 105); // Slate 600
      pdf.text(sevLabel, margin + 4, 56);

      // Status badge (right side)
      const isResolved = anomaly.status === 'resolved';
      const isResponding = anomaly.status === 'responding';
      const badgeR = isResolved ? 34 : isResponding ? 234 : 220;
      const badgeG = isResolved ? 197 : isResponding ? 179 : 38;
      const badgeB = isResolved ? 94 : isResponding ? 8 : 38;
      pdf.setFillColor(badgeR, badgeG, badgeB);
      pdf.rect(pdfWidth - margin - 32, 42, 32, 9, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(anomaly.status.toUpperCase(), pdfWidth - margin - 16, 48, { align: 'center' });

      // ── Separator ──
      pdf.setDrawColor(203, 213, 225); // Slate 300
      pdf.setLineWidth(0.3);
      pdf.line(margin, 68, pdfWidth - margin, 68);

      // ── Section: Incident Info ──
      let y = 76;

      pdf.setFillColor(241, 245, 249); // Slate 100
      pdf.rect(margin, y - 4, pdfWidth - margin * 2, 6, 'F');
      pdf.setTextColor(71, 85, 105); // Slate 600
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('INCIDENT DETAILS', margin + 2, y);
      y += 8;

      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42); // Slate 900

      pdf.setFont('Helvetica', 'bold');
      pdf.text('Reported By:', margin, y);
      pdf.setFont('Helvetica', 'normal');
      pdf.text(anomaly.reporterName, margin + 28, y);
      y += 6;

      pdf.setFont('Helvetica', 'bold');
      pdf.text('Date & Time:', margin, y);
      pdf.setFont('Helvetica', 'normal');
      pdf.text(new Date(anomaly.createdAt).toLocaleString(), margin + 28, y);
      y += 10;

      pdf.setFont('Helvetica', 'bold');
      pdf.setTextColor(71, 85, 105); // Slate 600
      pdf.setFontSize(8);
      pdf.text('DESCRIPTION', margin, y);
      y += 5;

      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 41, 59); // Slate 800
      // Strip emojis before adding to PDF
      const cleanDesc = anomaly.description.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
      const descLines = pdf.splitTextToSize(cleanDesc || anomaly.description, pdfWidth - margin * 2);
      pdf.text(descLines, margin, y);
      y += descLines.length * 5 + 8;

      pdf.setFont('Helvetica', 'bold');
      pdf.setTextColor(71, 85, 105); // Slate 600
      pdf.setFontSize(8);
      pdf.text('LOCATION', margin, y);
      y += 5;

      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 41, 59); // Slate 800
      const locText = anomaly.location.address
        || `Lat: ${anomaly.location.lat.toFixed(5)}, Lng: ${anomaly.location.lng.toFixed(5)}`;
      const addrLines = pdf.splitTextToSize(locText, pdfWidth - margin * 2);
      pdf.text(addrLines, margin, y);
      y += addrLines.length * 5 + 8;

      // ── Static Map ──
      const mapBase64 = await getStaticMapBase64(anomaly.location.lat, anomaly.location.lng);
      if (mapBase64) {
        pdf.addImage(mapBase64, 'PNG', margin, y, pdfWidth - margin * 2, 55);
        y += 62;
      } else {
        pdf.setFillColor(241, 245, 249); // Slate 100
        pdf.setDrawColor(203, 213, 225); // Slate 300
        pdf.rect(margin, y, pdfWidth - margin * 2, 24, 'FD');
        pdf.setTextColor(100, 116, 139); // Slate 500
        pdf.setFontSize(9);
        pdf.text(
          `Coordinates: ${anomaly.location.lat.toFixed(5)}, ${anomaly.location.lng.toFixed(5)}`,
          pdfWidth / 2, y + 13, { align: 'center' }
        );
        y += 30;
      }

      // ── Responders Section ──
      pdf.setDrawColor(203, 213, 225); // Slate 300
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pdfWidth - margin, y);
      y += 6;

      pdf.setFillColor(241, 245, 249); // Slate 100
      pdf.rect(margin, y - 4, pdfWidth - margin * 2, 6, 'F');
      pdf.setTextColor(71, 85, 105); // Slate 600
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('RESPONDER ACTIVITY LOG', margin + 2, y);
      y += 8;

      if (pdfResponses.length === 0) {
        pdf.setFont('Helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139); // Slate 500
        pdf.text('No emergency services have responded to this incident yet.', margin, y);
      } else {
        // Table header
        pdf.setFillColor(15, 23, 42); // Slate 900
        pdf.rect(margin, y, pdfWidth - margin * 2, 7, 'F');
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Responder Name', margin + 2, y + 5);
        pdf.text('Type', margin + 62, y + 5);
        pdf.text('Status', margin + 90, y + 5);
        pdf.text('ETA', margin + 120, y + 5);
        pdf.text('Updated', margin + 140, y + 5);
        y += 7;

        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdfResponses.forEach((resp: any, idx: number) => {
          pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
          pdf.rect(margin, y, pdfWidth - margin * 2, 7, 'F');
          pdf.setTextColor(15, 23, 42);
          pdf.text((resp.responderName || '').slice(0, 20), margin + 2, y + 5);
          pdf.text((resp.responderType || '').toUpperCase(), margin + 62, y + 5);
          pdf.text((resp.status || '').replace('_', ' ').toUpperCase(), margin + 90, y + 5);
          pdf.text(resp.eta ? `${resp.eta} min` : 'N/A', margin + 120, y + 5);
          pdf.text(new Date(resp.updatedAt).toLocaleTimeString(), margin + 140, y + 5);
          pdf.setDrawColor(226, 232, 240);
          pdf.line(margin, y + 7, pdfWidth - margin, y + 7);
          y += 8;
        });
      }

      // ── Footer ──
      pdf.setFillColor(241, 245, 249); // Slate 100
      pdf.rect(0, pdfHeight - 18, pdfWidth, 18, 'F');
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139); // Slate 500
      pdf.text('Confidential - RoadSOS Emergency Response Network. Do not distribute without authorization.', margin, pdfHeight - 10);
      pdf.text(`ID: ${anomaly.id}`, pdfWidth - margin, pdfHeight - 10, { align: 'right' });

      pdf.save(`incident-report-${anomaly.id.slice(0, 8)}.pdf`);
      toast.success('Incident Report PDF downloaded!', { id: toastId });
    } catch (err) {
      console.error('Error generating PDF', err);
      toast.error('Failed to generate PDF report.', { id: toastId });
    } finally {
      setGeneratingPDF(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToAnomaly(id, a => {
      setAnomaly(a);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  async function handleResolve() {
    if (!id) return;
    setResolving(true);
    try {
      await resolveAnomaly(id);
      toast.success('Incident marked as resolved');
    } catch {
      toast.error('Failed to resolve');
    } finally {
      setResolving(false);
    }
  }

  function timeAgo(ts: number) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  if (loading) return <LoadingSpinner size={40} text="Loading incident…" />;
  if (!anomaly) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h2>Incident Not Found</h2>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  );

  const sev = SEVERITY_META[anomaly.severity];
  const cat = CATEGORY_META[anomaly.category];
  const responses = Object.values(anomaly.responses || {});
  const isReporter = user?.uid === anomaly.reporterId;
  const statusStyle = STATUS_STYLES[anomaly.status] || STATUS_STYLES.reported;

  return (
    <div className="page" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: '2rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)} style={{ color: '#64748B' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: sev.bg, border: `1px solid ${sev.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', flexShrink: 0,
            }}>
              {cat.icon}
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{cat.label}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2, flexWrap: 'wrap' }}>
                <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>
                  Sev. {anomaly.severity} — {sev.label}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 'var(--r-full)',
                  background: statusStyle.bg, color: statusStyle.color,
                  border: `1px solid ${statusStyle.border}`,
                  fontSize: '0.68rem', fontWeight: 700,
                }}>
                  {statusStyle.label}
                </span>
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={downloadReportPDF}
            disabled={generatingPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}
          >
            {generatingPDF ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> PDF</> : <><Download size={14} /> PDF Report</>}
          </button>
        </div>

        {/* Map */}
        {loadError ? (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: '1.25rem', height: 260, border: '1px solid #E2E8F0', boxShadow: 'var(--shadow-soft)' }}>
            <iframe
              title="Incident Location Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${anomaly.location.lat},${anomaly.location.lng}&t=m&z=15&output=embed`}
              allowFullScreen
            />
          </div>
        ) : isLoaded ? (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: '1.25rem', height: 260, border: '1px solid #E2E8F0', boxShadow: 'var(--shadow-soft)' }}>
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
              zoom={15}
              options={{
                styles: MAP_STYLES,
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: true,
                mapTypeControl: true
              }}
            >
              <MarkerF
                position={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
            </GoogleMap>
          </div>
        ) : (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: 'var(--r-lg)', marginBottom: '1.25rem', border: '1px solid #E2E8F0' }}>
            <LoadingSpinner text="Loading map…" />
          </div>
        )}

        {/* Details Card */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            Incident Details
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div className="icon-badge icon-badge-info icon-badge-sm"><MapPin size={14} /></div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Location</div>
                <div style={{ fontSize: '0.875rem', color: '#0F172A', fontWeight: 500, marginTop: '0.125rem' }}>{anomaly.location.address || `${anomaly.location.lat.toFixed(5)}, ${anomaly.location.lng.toFixed(5)}`}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div className="icon-badge icon-badge-sm" style={{ background: '#F3F4F6', color: '#4B5563' }}><User size={14} /></div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reported By</div>
                <div style={{ fontSize: '0.875rem', color: '#0F172A', fontWeight: 500, marginTop: '0.125rem' }}>{anomaly.reporterName} <span style={{ color: '#94A3B8', margin: '0 0.25rem' }}>•</span> {timeAgo(anomaly.createdAt)}</div>
              </div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Description</div>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: '#334155' }}>{anomaly.description}</p>
            </div>
          </div>
        </div>

        {/* Responders */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Responders</h3>
            {responses.length > 0 && <span className="badge badge-green">{responses.length} Responding</span>}
          </div>
          
          {responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
              <Clock size={20} color="#94A3B8" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 500 }}>Waiting for emergency services to respond…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {responses.map(r => {
                const rs = r.status === 'arrived' ? { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' } 
                         : r.status === 'en_route' ? { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
                         : { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
                return (
                  <div key={r.uid} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: rs.bg, border: `1px solid ${rs.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      fontSize: '1rem',
                    }}>
                      {r.responderType === 'hospital' ? '🏥' : r.responderType === 'police' ? '🚔' : r.responderType === 'fire' ? '🚒' : '🚛'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }} className="truncate">{r.responderName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: 2 }}>
                        <span style={{ textTransform: 'capitalize' }}>{r.responderType}</span>
                        <span>•</span>
                        <span>Updated {timeAgo(r.updatedAt)}</span>
                        {r.eta && <><span>•</span><span style={{ fontWeight: 600, color: '#0F172A' }}>ETA: {r.eta} min</span></>}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 'var(--r-full)',
                      background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`,
                      fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize'
                    }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resolve button - only for reporter */}
        {isReporter && anomaly.status !== 'resolved' && (
          <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleResolve} disabled={resolving}>
            {resolving
              ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Resolving…</>
              : <><CheckCircle size={18} /> Mark Incident as Resolved</>
            }
          </button>
        )}

        {/* Resolved Banner */}
        {anomaly.status === 'resolved' && anomaly.resolvedAt && (
          <div style={{
            textAlign: 'center', padding: '1.25rem',
            background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
            border: '1px solid #A7F3D0', borderRadius: 'var(--r-lg)',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.1)',
          }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>✅</div>
            <div style={{ fontWeight: 800, color: '#065F46', fontSize: '1.1rem' }}>Incident Resolved</div>
            <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.25rem', fontWeight: 500 }}>
              {new Date(anomaly.resolvedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

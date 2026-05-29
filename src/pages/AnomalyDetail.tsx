import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { subscribeToAnomaly, resolveAnomaly } from '../services/anomalyService';
import { useUserStore } from '../store/userStore';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import type { Anomaly } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';
import { ArrowLeft, MapPin, CheckCircle, Clock, User } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2033' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8c9aad' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3350' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
];

export default function AnomalyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const { isLoaded } = useGoogleMapsLoader();

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

  return (
    <div className="page">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
              <h1 style={{ fontSize: '1.2rem' }}>{cat.label}</h1>
              <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>
                Severity {anomaly.severity} — {sev.label}
              </span>
              <span className="badge" style={{
                background: anomaly.status === 'resolved' ? 'var(--green-soft)' : anomaly.status === 'responding' ? 'rgba(234,179,8,0.15)' : 'var(--red-soft)',
                color: anomaly.status === 'resolved' ? 'var(--green)' : anomaly.status === 'responding' ? 'var(--yellow)' : 'var(--red)',
              }}>
                {anomaly.status}
              </span>
            </div>
          </div>
        </div>

        {/* Map */}
        {isLoaded && (
          <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 16 }}>
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: 240 }}
              center={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
              zoom={15}
              options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
            >
              <MarkerF
                position={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
            </GoogleMap>
          </div>
        )}

        {/* Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Incident Details</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <MapPin size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '0.88rem' }}>{anomaly.location.address || `${anomaly.location.lat.toFixed(5)}, ${anomaly.location.lng.toFixed(5)}`}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <User size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Reported By</div>
                <div style={{ fontSize: '0.88rem' }}>{anomaly.reporterName} • {timeAgo(anomaly.createdAt)}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-1)' }}>{anomaly.description}</p>
            </div>
          </div>
        </div>

        {/* Responders */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Responders
            {responses.length > 0 && <span className="badge badge-green">{responses.length}</span>}
          </h3>
          {responses.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Waiting for responders…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {responses.map(r => (
                <div key={r.uid} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--r-md)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: r.status === 'arrived' ? 'var(--green-soft)' : r.status === 'en_route' ? 'var(--orange-soft)' : 'var(--blue-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: '1rem',
                  }}>
                    {r.responderType === 'hospital' ? '🏥' : r.responderType === 'police' ? '🚔' : r.responderType === 'fire' ? '🚒' : '🚛'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.responderName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                      {r.responderType} • Updated {timeAgo(r.updatedAt)}
                      {r.eta && ` • ETA: ${r.eta} min`}
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: r.status === 'arrived' ? 'var(--green-soft)' : r.status === 'en_route' ? 'var(--orange-soft)' : 'var(--blue-soft)',
                    color: r.status === 'arrived' ? 'var(--green)' : r.status === 'en_route' ? 'var(--orange)' : 'var(--blue)',
                  }}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolve button - only for reporter */}
        {isReporter && anomaly.status !== 'resolved' && (
          <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleResolve} disabled={resolving}>
            {resolving
              ? <><div className="spinner" /> Resolving…</>
              : <><CheckCircle size={18} /> Mark as Resolved</>
            }
          </button>
        )}

        {anomaly.status === 'resolved' && anomaly.resolvedAt && (
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--green-soft)', borderRadius: 'var(--r-lg)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>✅</div>
            <div style={{ fontWeight: 700, color: 'var(--green)' }}>Incident Resolved</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4 }}>
              {new Date(anomaly.resolvedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

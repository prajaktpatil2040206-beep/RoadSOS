import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF, DirectionsRenderer } from '@react-google-maps/api';
import { subscribeToAnomaly, offerResponse, updateResponderStatus } from '../../services/anomalyService';
import type { Anomaly, AnomalyResponse } from '../../types';
import { SEVERITY_META, CATEGORY_META } from '../../types';
import { ArrowLeft, Navigation, CheckCircle, XCircle, Truck, MapPin, Clock, Users } from 'lucide-react';
import { useGoogleMapsLoader } from '../../hooks/useGoogleMapsLoader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const LIGHT_MAP_OPTIONS = {
  mapTypeId: 'roadmap',
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
  ]
};

export default function ResponderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { isLoaded, loadError } = useGoogleMapsLoader();

  const responderRaw = localStorage.getItem('roadsos-responder');
  const responder = responderRaw ? JSON.parse(responderRaw) : null;

  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [loading, setLoading] = useState(true);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [myStatus, setMyStatus] = useState<AnomalyResponse['status'] | null>(null);
  const [eta, setEta] = useState('10');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToAnomaly(id, a => {
      setAnomaly(a);
      if (a && responder?.uid && a.responses?.[responder.uid]) {
        setMyStatus(a.responses[responder.uid].status);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!anomaly || !isLoaded) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const ds = new google.maps.DirectionsService();
      ds.route({
        origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        destination: { lat: anomaly.location.lat, lng: anomaly.location.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
      }, (result, status) => {
        if (status === 'OK' && result) setDirections(result);
      });
    });
  }, [anomaly?.id, isLoaded]);

  async function handleOffer() {
    if (!id || !responder) return;
    setActing(true);
    try {
      await offerResponse(id, responder.uid, {
        responderName: responder.orgName || responder.name,
        responderType: responder.role,
        status: 'offered',
        eta: parseInt(eta),
      });
      setMyStatus('offered');
      toast.success('Response offered! The reporter will be notified.');
    } catch { toast.error('Failed to offer response'); }
    finally { setActing(false); }
  }

  async function handleStatusUpdate(status: AnomalyResponse['status']) {
    if (!id || !responder) return;
    setActing(true);
    try {
      await updateResponderStatus(id, responder.uid, status, parseInt(eta));
      setMyStatus(status);
      toast.success(`Status updated: ${status.replace('_', ' ')}`);
    } catch { toast.error('Failed to update status'); }
    finally { setActing(false); }
  }

  function openGoogleMaps() {
    if (!anomaly) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${anomaly.location.lat},${anomaly.location.lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  function timeAgo(ts: number) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  if (loading) return <LoadingSpinner size={40} text="Loading incident…" />;
  if (!anomaly) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h2 style={{ color: '#0F172A', fontWeight: 800 }}>Incident Not Found</h2>
      <button className="btn btn-secondary" onClick={() => navigate('/responder/dashboard')}>Back to Dashboard</button>
    </div>
  );

  const sev = SEVERITY_META[anomaly.severity];
  const cat = CATEGORY_META[anomaly.category];
  const responses = Object.values(anomaly.responses || {});
  const otherResponders = responses.filter(r => r.uid !== responder?.uid);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/responder/dashboard')} style={{ color: '#64748B' }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A' }}>{cat.label}</span>
            <span style={{ background: sev.bg, color: sev.color, padding: '2px 10px', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 700 }}>Severity {anomaly.severity}</span>
            <span style={{
              background: anomaly.status === 'resolved' ? '#ECFDF5' : anomaly.status === 'responding' ? '#FFFBEB' : '#FEF2F2',
              color: anomaly.status === 'resolved' ? '#10B981' : anomaly.status === 'responding' ? '#D97706' : '#EF4444',
              padding: '2px 10px', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>{anomaly.status}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openGoogleMaps} style={{ boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}>
          <Navigation size={14} /> Navigate There
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Incident info */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>Incident Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <MapPin size={16} color="#4F46E5" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
                  <div style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 500, marginTop: 2 }}>{anomaly.location.address || `${anomaly.location.lat.toFixed(5)}, ${anomaly.location.lng.toFixed(5)}`}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Clock size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Reported</div>
                  <div style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 500, marginTop: 2 }}>{timeAgo(anomaly.createdAt)} by <span style={{ fontWeight: 700 }}>{anomaly.reporterName}</span></div>
                </div>
              </div>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
                <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#0F172A' }}>{anomaly.description}</p>
              </div>
              <div style={{ padding: '12px 16px', background: sev.bg, borderRadius: 'var(--r-md)', border: `1px solid ${sev.color}44` }}>
                <div style={{ color: sev.color, fontWeight: 800, fontSize: '0.9rem' }}>{sev.label} Severity</div>
                <div style={{ color: '#475569', fontSize: '0.85rem', marginTop: 4, fontWeight: 500 }}>{sev.description}</div>
              </div>
            </div>
          </div>

          {/* My Response */}
          {anomaly.status !== 'resolved' && (
            <div className="card" style={{ border: '2px solid #4F46E5' }}>
              <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800, color: '#4F46E5' }}>My Response</h3>
              {!myStatus ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="label">Estimated Time of Arrival (minutes)</label>
                    <input className="input" type="number" value={eta} onChange={e => setEta(e.target.value)} min="1" max="120" />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }} onClick={handleOffer} disabled={acting}>
                      {acting ? <><div className="spinner" style={{ borderWidth: 2 }} /> Offering…</> : <><Truck size={18} /> Offer Help</>}
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => handleStatusUpdate('declined')} disabled={acting} style={{ color: '#EF4444' }}>
                      <XCircle size={18} /> Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#EEF2FF', borderRadius: 'var(--r-md)', border: '1px solid #C7D2FE' }}>
                    <span style={{ fontWeight: 700, color: '#4F46E5' }}>Current Status:</span>
                    <span className="badge badge-blue" style={{ fontSize: '0.85rem' }}>{myStatus.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(['en_route', 'arrived'] as AnomalyResponse['status'][]).map(s => (
                      <button key={s} className={`btn btn-lg ${myStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleStatusUpdate(s)} disabled={acting || myStatus === s}
                        style={myStatus === s ? { boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' } : {}}>
                        {s === 'en_route' ? '🚗 En Route' : '✅ Arrived'}
                      </button>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', background: '#F8FAFC', padding: 4, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <input className="input" type="number" value={eta} onChange={e => setEta(e.target.value)}
                        style={{ width: 80, height: 38, fontSize: '0.9rem', textAlign: 'center' }} placeholder="ETA min" />
                      <button className="btn btn-secondary" onClick={() => handleStatusUpdate(myStatus)} disabled={acting}>Update ETA</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Other responders */}
          {responses.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                <Users size={18} color="#4F46E5" /> All Responders ({responses.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {responses.map(r => (
                  <div key={r.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#F8FAFC', borderRadius: 'var(--r-md)', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '1.4rem' }}>
                      {r.responderType === 'hospital' ? '🏥' : r.responderType === 'police' ? '🚔' : r.responderType === 'fire' ? '🚒' : '🚛'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>{r.responderName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                        {r.responderType} {r.eta ? `• ETA: ${r.eta}min` : ''} • {timeAgo(r.updatedAt)}
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: r.status === 'arrived' ? '#ECFDF5' : r.status === 'en_route' ? '#FFFBEB' : '#EEF2FF',
                      color: r.status === 'arrived' ? '#10B981' : r.status === 'en_route' ? '#D97706' : '#4F46E5',
                      fontWeight: 700, textTransform: 'capitalize'
                    }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map panel */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {loadError ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#EF4444', fontWeight: 600 }}>
              Failed to load map.
            </div>
          ) : !isLoaded ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
              <LoadingSpinner text="Loading map…" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
              zoom={14}
              options={{
                styles: LIGHT_MAP_OPTIONS,
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
              {directions && (
                <DirectionsRenderer directions={directions} options={{
                  polylineOptions: { strokeColor: '#4F46E5', strokeWeight: 6, strokeOpacity: 0.9 },
                }} />
              )}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}

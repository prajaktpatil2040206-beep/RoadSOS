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

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2033' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8c9aad' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3350' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
];

export default function ResponderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { isLoaded } = useGoogleMapsLoader();

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

  // Get directions when anomaly loads
  useEffect(() => {
    if (!anomaly || !isLoaded) return;
    // Try get responder's geolocation
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h2>Incident Not Found</h2>
      <button className="btn btn-secondary" onClick={() => navigate('/responder/dashboard')}>Back to Dashboard</button>
    </div>
  );

  const sev = SEVERITY_META[anomaly.severity];
  const cat = CATEGORY_META[anomaly.category];
  const responses = Object.values(anomaly.responses || {});
  const otherResponders = responses.filter(r => r.uid !== responder?.uid);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/responder/dashboard')}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
            <span style={{ fontWeight: 700 }}>{cat.label}</span>
            <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>Severity {anomaly.severity}</span>
            <span className="badge" style={{
              background: anomaly.status === 'resolved' ? 'var(--green-soft)' : anomaly.status === 'responding' ? 'rgba(234,179,8,0.15)' : 'var(--red-soft)',
              color: anomaly.status === 'resolved' ? 'var(--green)' : anomaly.status === 'responding' ? 'var(--yellow)' : 'var(--red)',
            }}>{anomaly.status}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openGoogleMaps}>
          <Navigation size={14} /> Navigate There
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        {/* Left panel */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', maxWidth: 520 }}>
          {/* Incident info */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Incident Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <MapPin size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Location</div>
                  <div style={{ fontSize: '0.88rem' }}>{anomaly.location.address || `${anomaly.location.lat.toFixed(5)}, ${anomaly.location.lng.toFixed(5)}`}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Clock size={14} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Reported</div>
                  <div style={{ fontSize: '0.88rem' }}>{timeAgo(anomaly.createdAt)} by {anomaly.reporterName}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-1)' }}>{anomaly.description}</p>
              </div>
              <div style={{ padding: '10px 14px', background: sev.bg, borderRadius: 'var(--r-md)', border: `1px solid ${sev.color}44` }}>
                <div style={{ color: sev.color, fontWeight: 700, fontSize: '0.85rem' }}>{sev.label} Severity</div>
                <div style={{ color: 'var(--text-2)', fontSize: '0.78rem', marginTop: 2 }}>{sev.description}</div>
              </div>
            </div>
          </div>

          {/* My Response */}
          {anomaly.status !== 'resolved' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>My Response</h3>
              {!myStatus ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Estimated Time of Arrival (minutes)</label>
                    <input className="input" type="number" value={eta} onChange={e => setEta(e.target.value)} min="1" max="120" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleOffer} disabled={acting}>
                      {acting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Offering…</> : <><Truck size={16} /> Offer Help</>}
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleStatusUpdate('declined')} disabled={acting} style={{ color: 'var(--red)' }}>
                      <XCircle size={16} /> Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-card2)', borderRadius: 'var(--r-md)' }}>
                    <span style={{ fontWeight: 600 }}>Current Status:</span>
                    <span className="badge badge-blue">{myStatus.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['en_route', 'arrived'] as AnomalyResponse['status'][]).map(s => (
                      <button key={s} className={`btn btn-sm ${myStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleStatusUpdate(s)} disabled={acting || myStatus === s}>
                        {s === 'en_route' ? '🚗 En Route' : '✅ Arrived'}
                      </button>
                    ))}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                      <input className="input" type="number" value={eta} onChange={e => setEta(e.target.value)}
                        style={{ width: 70, height: 32, fontSize: '0.8rem' }} placeholder="ETA min" />
                      <button className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(myStatus)} disabled={acting}>Update ETA</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Other responders */}
          {responses.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--blue)" /> All Responders ({responses.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {responses.map(r => (
                  <div key={r.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 'var(--r-md)' }}>
                    <span style={{ fontSize: '1.2rem' }}>
                      {r.responderType === 'hospital' ? '🏥' : r.responderType === 'police' ? '🚔' : r.responderType === 'fire' ? '🚒' : '🚛'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.responderName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                        {r.responderType} {r.eta ? `• ETA: ${r.eta}min` : ''} • {timeAgo(r.updatedAt)}
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
            </div>
          )}
        </div>

        {/* Map panel */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {!isLoaded ? <LoadingSpinner text="Loading map…" /> : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
              zoom={14}
              options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true }}
            >
              <MarkerF
                position={{ lat: anomaly.location.lat, lng: anomaly.location.lng }}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
              {directions && (
                <DirectionsRenderer directions={directions} options={{
                  polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5 },
                }} />
              )}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}

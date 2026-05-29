import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { Mic, MicOff, MapPin, AlertTriangle, Send, ArrowLeft } from 'lucide-react';
import { reportAnomaly } from '../services/anomalyService';
import { useUserStore } from '../store/userStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import { SEVERITY_META, CATEGORY_META } from '../types';
import type { AnomalyCategory, AnomalySeverity } from '../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
];

export default function ReportAnomaly() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const geo = useGeolocation();
  const { isLoaded, loadError } = useGoogleMapsLoader();

  const [severity, setSeverity] = useState<AnomalySeverity>(3);
  const [category, setCategory] = useState<AnomalyCategory>('vehicle_collision');
  const [description, setDescription] = useState('');
  const [useCurrentLoc, setUseCurrentLoc] = useState(true);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [pinAddress, setPinAddress] = useState('');
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);

  const lat = useCurrentLoc ? geo.lat : pinLat;
  const lng = useCurrentLoc ? geo.lng : pinLng;
  const center = lat && lng ? { lat, lng } : { lat: 20.5937, lng: 78.9629 };

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (useCurrentLoc) return;
    const newLat = e.latLng?.lat() ?? null;
    const newLng = e.latLng?.lng() ?? null;
    setPinLat(newLat);
    setPinLng(newLng);
    if (newLat && newLng) {
      const gc = new google.maps.Geocoder();
      gc.geocode({ location: { lat: newLat, lng: newLng } }, (res, st) => {
        if (st === 'OK' && res?.[0]) setPinAddress(res[0].formatted_address);
      });
    }
  }

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // For demo: append placeholder
        setDescription(d => d + (d ? ' ' : '') + '[Voice recorded — transcription here]');
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch { toast.error('Microphone access denied'); }
  }

  function stopVoice() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function handleSubmit() {
    if (!lat || !lng) { toast.error('Location not available'); return; }
    if (!description.trim()) { toast.error('Please describe the incident'); return; }
    setSubmitting(true);
    try {
      const address = useCurrentLoc ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : pinAddress;
      const id = await reportAnomaly({
        location: { lat, lng, address },
        severity,
        category,
        description: description.trim(),
        reporterId: user!.uid,
        reporterName: user!.name,
      });
      toast.success('🚨 Incident reported! Nearby responders notified.');
      navigate(`/incident/${id}`);
    } catch (e: any) {
      if (e.message?.includes('Queued')) {
        toast.success('Saved offline — will sync when connected');
        navigate('/dashboard');
      } else {
        toast.error(e.message || 'Failed to report');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page" style={{ overflowY: 'auto' }}>
      <style>{`
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
        }
        .category-btn {
          padding: 12px 8px;
          border: 1px solid #E2E8F0;
          border-radius: var(--r-md);
          background: #F8FAFC;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .category-btn:hover {
          transform: translateY(-2px);
          background: #F1F5F9;
          border-color: #CBD5E1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }
        .category-btn.active {
          border-width: 2px;
          border-color: var(--primary);
          background: #EEF2FF;
          box-shadow: 0 0 12px rgba(79, 70, 229, 0.15);
        }
        .severity-grid {
          display: flex;
          gap: 10px;
        }
        .severity-btn {
          flex: 1;
          padding: 12px 6px;
          border: 1px solid #E2E8F0;
          border-radius: var(--r-md);
          background: #F8FAFC;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .severity-btn:hover {
          transform: translateY(-2px);
          background: #F1F5F9;
          border-color: #CBD5E1;
        }
        .severity-btn.active {
          border-width: 2px;
        }
        .form-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 8px;
        }
        .form-section-header h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #0F172A;
        }
      `}</style>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)} style={{ color: '#64748B' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>
              <AlertTriangle size={24} color="#EF4444" /> Report Incident
            </h1>
            <p style={{ fontSize: '0.82rem', marginTop: 2, color: '#64748B' }}>Report a road accident or emergency to alert nearby responders</p>
          </div>
        </div>

        {/* Location */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-section-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📍 Incident Location</h3>
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className={`btn btn-sm ${useCurrentLoc ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setUseCurrentLoc(true)}>
              <MapPin size={14} /> Use My Location
            </button>
            <button className={`btn btn-sm ${!useCurrentLoc ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setUseCurrentLoc(false)}>
              Pin on Map
            </button>
          </div>

          {loadError ? (
            <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 8, height: 420, border: '1px solid #E2E8F0' }}>
              <iframe
                title="Incident Location Map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${lat || 20.5937},${lng || 78.9629}&t=m&z=15&output=embed`}
                allowFullScreen
              />
            </div>
          ) : isLoaded ? (
            <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 8, border: '1px solid #E2E8F0' }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: 420 }}
                center={center} zoom={15}
                options={{
                  styles: MAP_STYLES,
                  disableDefaultUI: false,
                  zoomControl: true,
                  streetViewControl: true,
                  mapTypeControl: true,
                  clickableIcons: false
                }}
                onClick={handleMapClick}
              >
                {lat && lng && (
                  <MarkerF position={{ lat, lng }}
                    icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                  />
                )}
              </GoogleMap>
            </div>
          ) : (
            <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: 'var(--r-md)', border: '1px solid #E2E8F0' }}>
              <LoadingSpinner text="Loading map view…" />
            </div>
          )}

          <div style={{
            fontSize: '0.8rem', color: '#475569', background: '#F8FAFC',
            padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid #E2E8F0'
          }}>
            {useCurrentLoc
              ? geo.loading ? '⏳ Detecting location…' : lat ? `📍 Current Location: ${lat.toFixed(5)}, ${lng?.toFixed(5)}` : 'Location unavailable'
              : pinAddress || (pinLat ? `📍 Pinned Location: ${pinLat.toFixed(5)}, ${pinLng?.toFixed(5)}` : '⬆ Click on map to pin location')
            }
          </div>
        </div>

        {/* Category */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-section-header">
            <h3>🚧 Incident Type</h3>
          </div>
          <div className="category-grid">
            {(Object.entries(CATEGORY_META) as [AnomalyCategory, typeof CATEGORY_META[AnomalyCategory]][]).map(([key, meta]) => {
              const isActive = category === key;
              return (
                <button key={key} onClick={() => setCategory(key)}
                  className={`category-btn ${isActive ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '1.5rem' }}>{meta.icon}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? 'var(--primary)' : '#64748B', textAlign: 'center' }}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-section-header">
            <h3>🔴 Severity Level</h3>
          </div>
          <div className="severity-grid">
            {([1, 2, 3, 4, 5] as AnomalySeverity[]).map(s => {
              const meta = SEVERITY_META[s];
              const isActive = severity === s;
              return (
                <button key={s} onClick={() => setSeverity(s)}
                  className={`severity-btn ${isActive ? 'active' : ''}`}
                  style={{
                    borderColor: isActive ? meta.color : '#E2E8F0',
                    background: isActive ? meta.bg : '#F8FAFC',
                    boxShadow: isActive ? `0 0 10px ${meta.color}33` : 'none',
                  }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: isActive ? meta.color : '#0F172A' }}>{s}</span>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: isActive ? meta.color : '#64748B', textAlign: 'center' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', background: SEVERITY_META[severity].bg,
            borderRadius: 'var(--r-md)', border: `1px solid ${SEVERITY_META[severity].color}33`,
            color: SEVERITY_META[severity].color, fontSize: '0.8rem', fontWeight: 500
          }}>
            {SEVERITY_META[severity].description}
          </div>
        </div>

        {/* Description */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-section-header" style={{ justifyContent: 'space-between', borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <h3>📝 Description</h3>
            <button
              className={`btn btn-sm ${recording ? 'btn-danger' : 'btn-secondary'}`}
              onClick={recording ? stopVoice : startVoice}
            >
              {recording ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Voice Input</>}
            </button>
          </div>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', color: '#EF4444', fontSize: '0.82rem', fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'ct-spin 1s infinite' }} />
              Recording… speak clearly
            </div>
          )}
          <textarea
            className="input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the incident: e.g., 'Bus hit a car at main junction, 3 people injured, vehicle on fire'"
            rows={4}
            style={{ marginTop: 12 }}
          />
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 6, textAlign: 'right', fontWeight: 600 }}>
            {description.length} characters
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', justifyContent: 'center', background: '#EF4444', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)' }}>
          {submitting
            ? <><div className="spinner" /> Alerting responders…</>
            : <><Send size={18} /> Report Incident — Alert Nearby Services</>
          }
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.78rem', marginTop: 10, color: '#64748B' }}>
          This will instantly notify nearby hospitals, police, and rescue services
        </p>
      </div>
    </div>
  );
}

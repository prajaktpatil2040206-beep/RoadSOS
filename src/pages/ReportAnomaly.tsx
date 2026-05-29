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

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2033' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8c9aad' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3350' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
];

export default function ReportAnomaly() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const geo = useGeolocation();
  const { isLoaded } = useGoogleMapsLoader();

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
    <div className="page">
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={22} color="var(--red)" /> Report Incident
            </h1>
            <p style={{ fontSize: '0.82rem', marginTop: 2 }}>Report a road accident or emergency to alert nearby responders</p>
          </div>
        </div>

        {/* Location */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>📍 Incident Location</h3>
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

          {isLoaded && (
            <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 8 }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: 220 }}
                center={center} zoom={15}
                options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true, clickableIcons: false }}
                onClick={handleMapClick}
              >
                {lat && lng && (
                  <MarkerF position={{ lat, lng }}
                    icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                  />
                )}
              </GoogleMap>
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
            {useCurrentLoc
              ? geo.loading ? 'Detecting location…' : lat ? `📍 ${lat.toFixed(5)}, ${lng?.toFixed(5)}` : 'Location unavailable'
              : pinAddress || (pinLat ? `${pinLat.toFixed(5)}, ${pinLng?.toFixed(5)}` : '⬆ Click on map to pin location')
            }
          </div>
        </div>

        {/* Category */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>🚧 Incident Type</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {(Object.entries(CATEGORY_META) as [AnomalyCategory, typeof CATEGORY_META[AnomalyCategory]][]).map(([key, meta]) => (
              <button key={key} onClick={() => setCategory(key)}
                style={{
                  padding: '10px 6px', border: `2px solid ${category === key ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)', background: category === key ? 'var(--primary-soft)' : 'var(--bg-card2)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: category === key ? 'var(--primary)' : 'var(--text-2)', textAlign: 'center' }}>{meta.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>🔴 Severity Level</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {([1, 2, 3, 4, 5] as AnomalySeverity[]).map(s => {
              const meta = SEVERITY_META[s];
              return (
                <button key={s} onClick={() => setSeverity(s)}
                  style={{
                    flex: 1, padding: '10px 4px', border: `2px solid ${severity === s ? meta.color : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)', background: severity === s ? meta.bg : 'var(--bg-card2)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: meta.color }}>{s}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: meta.color, textAlign: 'center' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
          <p style={{ marginTop: 10, fontSize: '0.8rem', color: SEVERITY_META[severity].color }}>
            {SEVERITY_META[severity].description}
          </p>
        </div>

        {/* Description */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3>📝 Description</h3>
            <button
              className={`btn btn-sm ${recording ? 'btn-danger' : 'btn-secondary'}`}
              onClick={recording ? stopVoice : startVoice}
            >
              {recording ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Voice Input</>}
            </button>
          </div>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--red)', fontSize: '0.82rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse-ring 1s infinite' }} />
              Recording… speak clearly
            </div>
          )}
          <textarea
            className="input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the incident: e.g., 'Bus hit a car at main junction, 3 people injured, vehicle on fire'"
            rows={4}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 6, textAlign: 'right' }}>
            {description.length} characters
          </div>
        </div>

        <button className="btn btn-danger btn-lg" onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', justifyContent: 'center' }}>
          {submitting
            ? <><div className="spinner" /> Alerting responders…</>
            : <><Send size={18} /> Report Incident — Alert Nearby Services</>
          }
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.78rem', marginTop: 10 }}>
          This will instantly notify nearby hospitals, police, and rescue services
        </p>
      </div>
    </div>
  );
}

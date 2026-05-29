import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, AlertTriangle, ChevronRight, Activity,
  Navigation, Route, History, Phone, Zap, ArrowRight,
  Shield, Flame, Truck, Wrench, Wind
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { subscribeToAnomalies } from '../services/anomalyService';
import type { Anomaly } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';

const QUOTES = [
  { text: "Every second counts in an emergency. RoadSOS connects you to help instantly.", author: "Road Safety Initiative" },
  { text: "The golden hour saves lives. Know your nearest hospital before you need it.", author: "WHO Road Safety Report" },
  { text: "A prepared traveller is a safe traveller. Plan your journey, stay safe.", author: "National Highway Authority" },
  { text: "Speed thrills but kills. Drive within limits, arrive alive.", author: "Traffic Safety Council" },
  { text: "Your family is waiting for you. Drive responsibly.", author: "Road Safety Awareness" },
];

const TRAFFIC_TIPS = [
  { icon: '🚦', rule: 'Obey traffic signals', detail: 'Red means stop. Green means go. Yellow means slow down, not speed up.' },
  { icon: '🏎️', rule: 'Speed limits save lives', detail: 'Highway: 100 km/h • City: 50 km/h • School zones: 25 km/h' },
  { icon: '🪑', rule: 'Always wear a seatbelt', detail: 'Seatbelts reduce crash fatality risk by up to 45%.' },
  { icon: '📱', rule: 'No phone while driving', detail: 'Using a phone while driving increases accident risk by 4 times.' },
  { icon: '🍺', rule: 'Never drink and drive', detail: 'Blood Alcohol Content above 0.03% is illegal in India.' },
  { icon: '💡', rule: 'Use headlights wisely', detail: 'Turn on headlights at dusk, in rain, fog, or poor visibility.' },
];

const QUICK_ACTIONS = [
  { icon: '🏥', label: 'Hospitals',  path: '/nearme?cat=hospital', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  { icon: '🚔', label: 'Police',     path: '/nearme?cat=police',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  { icon: '🚛', label: 'Towing',     path: '/nearme?cat=towing',   color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  { icon: '⛽', label: 'Petrol',     path: '/nearme?cat=petrol',   color: '#EAB308', bg: '#FEFCE8', border: '#FEF08A' },
  { icon: '🔧', label: 'Puncture',   path: '/nearme?cat=puncture', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { icon: '🚻', label: 'Washroom',   path: '/nearme?cat=washroom', color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC' },
];

const EMERGENCY = [
  { label: 'Police',          number: '100',  color: '#3B82F6' },
  { label: 'Ambulance',       number: '108',  color: '#EF4444' },
  { label: 'Fire',            number: '101',  color: '#F97316' },
  { label: 'Highway',         number: '1033', color: '#4F46E5' },
  { label: 'Women Safety',    number: '1091', color: '#7C3AED' },
  { label: 'Disaster',        number: '112',  color: '#10B981' },
];

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function Home() {
  const { user } = useUserStore();
  const geo = useGeolocation();
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const unsub = subscribeToAnomalies(list => {
      setAnomalies(list.filter(a => a.status !== 'resolved').slice(0, 3));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTipIndex(i => (i + 1) % TRAFFIC_TIPS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const quote = QUOTES[quoteIndex];
  const tip = TRAFFIC_TIPS[tipIndex];
  const firstName = user?.name?.split(' ')[0] || 'Traveller';

  return (
    <div className="page" style={{ overflowY: 'auto' }}>

      {/* ── Hero Greeting ─────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 50%, #7C3AED 100%)',
        borderRadius: 16, padding: '1.5rem', marginBottom: '1rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 20, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
            Welcome back
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem', lineHeight: 1.2 }}>
            Hello, {firstName} 👋
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', marginBottom: '1rem' }}>
            Stay safe on the roads. Help is always one tap away.
          </p>

          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={async () => await geo.refresh()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                borderRadius: 'var(--r-full)', padding: '0.3rem 0.75rem',
                fontSize: '0.75rem', color: '#fff', fontWeight: 500,
                border: 'none', cursor: 'pointer'
              }}
              title="Refresh Location"
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: geo.lat ? '#34D399' : 'rgba(255,255,255,0.4)',
                animation: geo.lat ? 'pulse-gps 2s infinite' : 'none',
              }} />
              <MapPin size={11} />
              {geo.loading ? 'Detecting…' : geo.lat ? `${geo.lat.toFixed(3)}°N, ${geo.lng?.toFixed(3)}°E` : 'Click to locate'}
            </button>
            {user?.bloodGroup && (
              <div style={{
                background: 'rgba(239,68,68,0.25)', backdropFilter: 'blur(8px)',
                borderRadius: 'var(--r-full)', padding: '0.3rem 0.75rem',
                fontSize: '0.75rem', color: '#FCA5A5', fontWeight: 600,
              }}>
                🩸 {user.bloodGroup}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Primary Action Buttons ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Report SOS */}
        <button onClick={() => navigate('/report')} style={{
          padding: '1.125rem 1rem', borderRadius: 14,
          background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)',
          border: '1.5px solid #FECACA',
          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.375rem', transition: 'all 0.2s', fontFamily: 'inherit',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(239,68,68,0.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 11, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} color="#EF4444" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#991B1B' }}>Report SOS</span>
          <span style={{ fontSize: '0.68rem', color: '#B91C1C', opacity: 0.75 }}>Alert nearby services</span>
        </button>

        {/* Plan Journey */}
        <button onClick={() => navigate('/journey')} style={{
          padding: '1.125rem 1rem', borderRadius: 14,
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: '1.5px solid #C7D2FE',
          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.375rem', transition: 'all 0.2s', fontFamily: 'inherit',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(79,70,229,0.15)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 11, background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Route size={20} color="#4F46E5" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#312E81' }}>Plan Journey</span>
          <span style={{ fontSize: '0.68rem', color: '#4338CA', opacity: 0.75 }}>Download offline maps</span>
        </button>
      </div>

      {/* ── Quick Access Grid ──────────────────────────── */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <span className="section-title" style={{ fontSize: '0.9rem' }}>Quick Access</span>
          <Link to="/nearme" style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => navigate(a.path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                padding: '0.875rem 0.5rem',
                background: a.bg, border: `1.5px solid ${a.border}`,
                borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              <span style={{ fontSize: '1.4rem' }}>{a.icon}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: a.color, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Active Incidents ───────────────────────────── */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="section-header">
            <span className="section-title">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse-gps 1.5s infinite' }} />
              Active Incidents
              <span className="badge badge-red">{anomalies.length}</span>
            </span>
            <Link to="/dashboard" style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {anomalies.map(a => {
              const sev = SEVERITY_META[a.severity];
              const cat = CATEGORY_META[a.category];
              return (
                <div key={a.id} className="anomaly-item" onClick={() => navigate(`/incident/${a.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>{cat.label}</span>
                      <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{timeAgo(a.createdAt)}</span>
                      <ChevronRight size={14} color="#94A3B8" />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', marginTop: '0.375rem', color: '#64748B' }} className="truncate">{a.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Navigation + History ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)',
          border: '1.5px solid #A7F3D0', borderRadius: 14, padding: '1rem',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
          onClick={() => navigate('/navigation')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(16,185,129,0.15)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
          <Navigation size={20} color="#059669" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#065F46', marginBottom: 2 }}>Navigate</div>
          <p style={{ fontSize: '0.72rem', color: '#047857' }}>Turn-by-turn directions</p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)',
          border: '1.5px solid #FED7AA', borderRadius: 14, padding: '1rem',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
          onClick={() => navigate('/report-history')}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(249,115,22,0.15)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
          <History size={20} color="#C2410C" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#9A3412', marginBottom: 2 }}>History</div>
          <p style={{ fontSize: '0.72rem', color: '#C2410C' }}>View all reports</p>
        </div>
      </div>

      {/* ── Safety Quote ───────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
        border: '1px solid #C7D2FE', borderRadius: 14, padding: '1.125rem',
        marginBottom: '1rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(79,70,229,0.06)', pointerEvents: 'none' }} />
        <div style={{ fontSize: '0.68rem', color: '#4F46E5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Zap size={11} fill="#4F46E5" /> Road Safety Quote
        </div>
        <p style={{ fontSize: '0.875rem', color: '#1E1B4B', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '0.375rem' }}>
          "{quote.text}"
        </p>
        <div style={{ fontSize: '0.7rem', color: '#6366F1', fontWeight: 500 }}>— {quote.author}</div>
      </div>

      {/* ── Traffic Tip (rotating) ─────────────────────── */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
        <div style={{
          fontSize: '1.75rem', flexShrink: 0,
          width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0',
        }}>
          {tip.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
            Traffic Rule
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginBottom: '0.25rem' }}>{tip.rule}</div>
          <p style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5 }}>{tip.detail}</p>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 4, marginTop: '0.625rem' }}>
            {TRAFFIC_TIPS.map((_, i) => (
              <button key={i} onClick={() => setTipIndex(i)} style={{
                width: i === tipIndex ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
                background: i === tipIndex ? '#4F46E5' : '#E2E8F0',
                cursor: 'pointer', transition: 'all 0.3s', padding: 0,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Emergency Numbers ──────────────────────────── */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="section-title" style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          <Phone size={15} color="#4F46E5" /> Emergency Numbers (India)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {EMERGENCY.map(e => (
            <a key={e.label} href={`tel:${e.number}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
              padding: '0.75rem 0.5rem',
              background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
              onMouseEnter={el => { (el.currentTarget as HTMLElement).style.borderColor = e.color; (el.currentTarget as HTMLElement).style.background = '#EEF2FF'; }}
              onMouseLeave={el => { (el.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (el.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
            >
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: e.color }}>{e.number}</span>
              <span style={{ fontSize: '0.62rem', color: '#64748B', textAlign: 'center', fontWeight: 600 }}>{e.label}</span>
            </a>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-gps {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

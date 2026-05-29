import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, AlertTriangle, ChevronRight, Activity, Navigation, Route, History } from 'lucide-react';
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
  { icon: '🏥', label: 'Hospitals', path: '/nearme?cat=hospital', color: '#ef4444' },
  { icon: '🚔', label: 'Police', path: '/nearme?cat=police', color: '#3b82f6' },
  { icon: '🚛', label: 'Towing', path: '/nearme?cat=towing', color: '#f97316' },
  { icon: '⛽', label: 'Petrol', path: '/nearme?cat=petrol', color: '#eab308' },
  { icon: '🔧', label: 'Puncture', path: '/nearme?cat=puncture', color: '#22c55e' },
  { icon: '🚻', label: 'Washroom', path: '/nearme?cat=washroom', color: '#06b6d4' },
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

  // Rotate traffic tips every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex(i => (i + 1) % TRAFFIC_TIPS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const quote = QUOTES[quoteIndex];
  const tip = TRAFFIC_TIPS[tipIndex];
  const firstName = user?.name?.split(' ')[0] || 'Traveller';

  return (
    <div className="page" style={{ overflowY: 'auto' }}>

      {/* Hero Greeting */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0510 0%, #0a0c12 60%)',
        borderRadius: 'var(--r-xl)', padding: '24px 24px 20px',
        marginBottom: 20, border: '1px solid rgba(239,68,68,0.15)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Welcome back
          </div>
          <h1 style={{ marginBottom: 4, fontSize: '1.7rem' }}>Hello, {firstName} 👋</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-2)', marginBottom: 16 }}>
            Stay safe on the roads. Help is always one tap away.
          </p>

          {/* Location badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--r-full)', padding: '4px 12px', fontSize: '0.78rem',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: geo.lat ? 'var(--green)' : 'var(--text-3)',
                animation: geo.lat ? 'pulse-dot 2s infinite' : 'none',
              }} />
              <MapPin size={12} color="var(--blue)" />
              <span style={{ color: 'var(--blue)' }}>
                {geo.loading ? 'Detecting location…' : geo.lat ? `${geo.lat.toFixed(3)}°N, ${geo.lng?.toFixed(3)}°E` : 'Location unavailable'}
              </span>
            </div>
            {user?.bloodGroup && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-full)', padding: '4px 12px', fontSize: '0.78rem', color: 'var(--red)',
              }}>
                🩸 {user.bloodGroup}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOS + Near Me buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/report')}
          style={{
            padding: '16px 12px', borderRadius: 'var(--r-lg)', border: '2px solid var(--red)',
            background: 'rgba(239,68,68,0.12)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all 0.2s', color: 'var(--red)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
        >
          <AlertTriangle size={24} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Report Incident</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 400 }}>Alert nearby services</span>
        </button>
        <button
          onClick={() => navigate('/journey')}
          style={{
            padding: '16px 12px', borderRadius: 'var(--r-lg)', border: '2px solid var(--blue)',
            background: 'rgba(59,130,246,0.12)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all 0.2s', color: 'var(--blue)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
        >
          <Route size={24} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Plan Journey</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 400 }}>Download offline maps</span>
        </button>
      </div>

      {/* Quote of the day */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0f1e3d 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--r-lg)', padding: '18px 20px', marginBottom: 20,
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          💡 Road Safety Quote
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-1)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 8 }}>
          "{quote.text}"
        </p>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>— {quote.author}</div>
      </div>

      {/* Traffic Tip (rotating) */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '16px 20px', marginBottom: 20,
        display: 'flex', gap: 16, alignItems: 'flex-start',
      }}>
        <div style={{
          fontSize: '2rem', flexShrink: 0,
          width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card2)', borderRadius: 'var(--r-md)',
        }}>
          {tip.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Traffic Rule Tip
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{tip.rule}</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{tip.detail}</p>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {TRAFFIC_TIPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setTipIndex(i)}
                style={{
                  width: i === tipIndex ? 16 : 6, height: 6, borderRadius: 3, border: 'none',
                  background: i === tipIndex ? 'var(--yellow)' : 'var(--border2)',
                  cursor: 'pointer', transition: 'all 0.3s', padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <h3 style={{ marginBottom: 12 }}>Quick Access</h3>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 20,
      }}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => navigate(a.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 8px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              cursor: 'pointer', transition: 'all 0.15s', color: 'var(--text-1)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = a.color;
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-2)' }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Active Incidents */}
      {anomalies.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={17} color="var(--red)" />
              Active Incidents
              <span className="badge badge-red">{anomalies.length}</span>
            </h3>
            <Link to="/dashboard" style={{ fontSize: '0.8rem' }}>View all →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {anomalies.map(a => {
              const sev = SEVERITY_META[a.severity];
              const cat = CATEGORY_META[a.category];
              return (
                <div key={a.id} className="anomaly-item" onClick={() => navigate(`/incident/${a.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cat.label}</span>
                      <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{timeAgo(a.createdAt)}</span>
                      <ChevronRight size={14} color="var(--text-3)" />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', marginTop: 6, marginBottom: 0 }} className="truncate">{a.description}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Navigate shortcut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, #0d1f0d 0%, #162716 100%)',
          borderColor: 'rgba(34,197,94,0.2)', cursor: 'pointer', padding: '16px',
        }} onClick={() => navigate('/navigation')}>
          <Navigation size={20} color="var(--green)" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--green)', marginBottom: 2 }}>Navigate</div>
          <p style={{ fontSize: '0.75rem' }}>Real-time turn-by-turn directions</p>
        </div>
        <div className="card" style={{
          background: 'linear-gradient(135deg, #1a1207 0%, #261a0a 100%)',
          borderColor: 'rgba(234,179,8,0.2)', cursor: 'pointer', padding: '16px',
        }} onClick={() => navigate('/report-history')}>
          <History size={20} color="var(--yellow)" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--yellow)', marginBottom: 2 }}>Report History</div>
          <p style={{ fontSize: '0.75rem' }}>View all reported incidents</p>
        </div>
      </div>

      {/* Emergency numbers */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>📞 Emergency Numbers (India)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Police', number: '100', color: 'var(--blue)' },
            { label: 'Ambulance', number: '108', color: 'var(--red)' },
            { label: 'Fire', number: '101', color: 'var(--orange)' },
            { label: 'Highway Helpline', number: '1033', color: 'var(--yellow)' },
            { label: 'Women Safety', number: '1091', color: 'var(--purple)' },
            { label: 'Disaster', number: '112', color: 'var(--cyan)' },
          ].map(e => (
            <a key={e.label} href={`tel:${e.number}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 8px', background: 'var(--bg-card2)', borderRadius: 'var(--r-md)',
                textDecoration: 'none', border: '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: e.color }}>{e.number}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', textAlign: 'center', fontWeight: 600 }}>{e.label}</span>
            </a>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

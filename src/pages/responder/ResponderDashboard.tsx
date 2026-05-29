import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAnomalies } from '../../services/anomalyService';
import type { Anomaly } from '../../types';
import { SEVERITY_META, CATEGORY_META } from '../../types';
import { Activity, LogOut, ChevronRight, Bell, MapPin, Clock } from 'lucide-react';
import NetworkBadge from '../../components/common/NetworkBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ResponderDashboard() {
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const responderRaw = localStorage.getItem('roadsos-responder');
  const responder = responderRaw ? JSON.parse(responderRaw) : null;

  function handleLogout() {
    localStorage.removeItem('roadsos-responder');
    navigate('/responder/login');
  }

  useEffect(() => {
    const unsub = subscribeToAnomalies(list => {
      setAnomalies(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === 'active'
    ? anomalies.filter(a => a.status !== 'resolved')
    : anomalies;

  const active = anomalies.filter(a => a.status !== 'resolved').length;
  const responding = anomalies.filter(a => a.status === 'responding').length;
  const resolved = anomalies.filter(a => a.status === 'resolved').length;

  function timeAgo(ts: number) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 58,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--blue)' }}>ROADSOS Responder</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{responder?.orgName || responder?.name}</div>
          </div>
        </div>
        <NetworkBadge />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={handleLogout} title="Logout" style={{ color: 'var(--red)' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ flex: 1, padding: '20px 20px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Active', count: active, color: 'var(--red)', bg: 'rgba(239,68,68,0.1)', icon: '🔴' },
            { label: 'Responding', count: responding, color: 'var(--yellow)', bg: 'rgba(234,179,8,0.1)', icon: '🟡' },
            { label: 'Resolved', count: resolved, color: 'var(--green)', bg: 'rgba(34,197,94,0.1)', icon: '🟢' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 'var(--r-lg)', padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>
                {s.icon} {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter + live alert banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['active', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--r-full)', border: 'none',
                  background: filter === f ? 'var(--blue)' : 'var(--bg-card2)',
                  color: filter === f ? '#fff' : 'var(--text-2)',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                }}>
                {f === 'active' ? `🔴 Active (${active})` : `📋 All (${anomalies.length})`}
              </button>
            ))}
          </div>
          {active > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--red)' }}>
              <Bell size={13} />
              {active} incident{active > 1 ? 's' : ''} need response
            </div>
          )}
        </div>

        {/* Incidents list */}
        {loading ? <LoadingSpinner text="Loading incidents…" /> :
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h3>No Active Incidents</h3>
              <p style={{ marginTop: 6 }}>All clear. Stay ready.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(a => {
                const sev = SEVERITY_META[a.severity];
                const cat = CATEGORY_META[a.category];
                const myResponse = responder?.uid && a.responses?.[responder.uid];
                return (
                  <div key={a.id}
                    onClick={() => navigate(`/responder/incident/${a.id}`)}
                    style={{
                      background: 'var(--bg-card)', border: `1px solid ${a.status === 'reported' ? sev.color + '55' : 'var(--border)'}`,
                      borderRadius: 'var(--r-lg)', padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Severity indicator */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 'var(--r-md)',
                        background: sev.bg, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        border: `1px solid ${sev.color}44`,
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: sev.color, textTransform: 'uppercase' }}>SEV {a.severity}</span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{cat.label}</span>
                          <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                          <span className="badge" style={{
                            background: a.status === 'resolved' ? 'var(--green-soft)' : a.status === 'responding' ? 'rgba(234,179,8,0.15)' : 'var(--red-soft)',
                            color: a.status === 'resolved' ? 'var(--green)' : a.status === 'responding' ? 'var(--yellow)' : 'var(--red)',
                          }}>{a.status}</span>
                          {myResponse && <span className="badge badge-blue">Your response: {myResponse.status}</span>}
                        </div>

                        <p className="truncate" style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 6 }}>{a.description}</p>

                        <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={11} /> {a.location.address || `${a.location.lat.toFixed(4)}, ${a.location.lng.toFixed(4)}`}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} /> {timeAgo(a.createdAt)}
                          </span>
                          <span>👤 {a.reporterName}</span>
                          {Object.keys(a.responses || {}).length > 0 && (
                            <span style={{ color: 'var(--green)' }}>
                              ✅ {Object.keys(a.responses!).length} responder{Object.keys(a.responses!).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

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
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '0 20px', height: 64,
        display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: '1.6rem' }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>ROADSOS Responder</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{responder?.orgName || responder?.name}</div>
          </div>
        </div>
        <NetworkBadge />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={handleLogout} title="Logout" style={{ color: '#EF4444' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ flex: 1, padding: '24px 20px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Active', count: active, color: '#EF4444', bg: '#FEF2F2', icon: '🔴' },
            { label: 'Responding', count: responding, color: '#D97706', bg: '#FFFBEB', icon: '🟡' },
            { label: 'Resolved', count: resolved, color: '#10B981', bg: '#ECFDF5', icon: '🟢' },
          ].map(s => (
            <div key={s.label} className="card" style={{ background: s.bg, border: `1px solid ${s.color}33`, padding: '20px', textAlign: 'center', boxShadow: 'none' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {s.icon} {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter + live alert banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 4, borderRadius: 'var(--r-full)', border: '1px solid #E2E8F0' }}>
            {(['active', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--r-full)', border: 'none',
                  background: filter === f ? '#4F46E5' : 'transparent',
                  color: filter === f ? '#fff' : '#64748B',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                {f === 'active' ? `🔴 Active (${active})` : `📋 All (${anomalies.length})`}
              </button>
            ))}
          </div>
          {active > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#EF4444', fontWeight: 700, background: '#FEF2F2', padding: '6px 12px', borderRadius: 'var(--r-full)' }}>
              <Bell size={14} style={{ animation: 'ct-pulse 2s infinite' }} />
              {active} incident{active > 1 ? 's' : ''} need response
            </div>
          )}
        </div>

        {/* Incidents list */}
        {loading ? <LoadingSpinner text="Loading incidents…" /> :
          filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px dashed #CBD5E1' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ color: '#0F172A', fontWeight: 800 }}>No Active Incidents</h3>
              <p style={{ marginTop: 8, color: '#64748B' }}>All clear. Stay ready for incoming alerts.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(a => {
                const sev = SEVERITY_META[a.severity];
                const cat = CATEGORY_META[a.category];
                const myResponse = responder?.uid && a.responses?.[responder.uid];
                return (
                  <div key={a.id}
                    className="card"
                    onClick={() => navigate(`/responder/incident/${a.id}`)}
                    style={{
                      border: `1px solid ${a.status === 'reported' ? sev.color + '66' : '#E2E8F0'}`,
                      padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      {/* Severity indicator */}
                      <div style={{
                        width: 54, height: 54, borderRadius: 'var(--r-md)',
                        background: sev.bg, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        border: `1px solid ${sev.color}44`,
                      }}>
                        <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: sev.color, textTransform: 'uppercase', marginTop: 2 }}>SEV {a.severity}</span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '1.05rem' }}>{cat.label}</span>
                          <span style={{ background: sev.bg, color: sev.color, padding: '2px 8px', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 700 }}>{sev.label}</span>
                          <span style={{
                            background: a.status === 'resolved' ? '#ECFDF5' : a.status === 'responding' ? '#FFFBEB' : '#FEF2F2',
                            color: a.status === 'resolved' ? '#10B981' : a.status === 'responding' ? '#D97706' : '#EF4444',
                            padding: '2px 8px', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
                          }}>{a.status}</span>
                          {myResponse && <span className="badge badge-blue">Your response: {myResponse.status.replace('_', ' ')}</span>}
                        </div>

                        <p className="truncate" style={{ fontSize: '0.9rem', color: '#475569', marginBottom: 10 }}>{a.description}</p>

                        <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#64748B', flexWrap: 'wrap', fontWeight: 500 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={13} color="#4F46E5" /> {a.location.address || `${a.location.lat.toFixed(4)}, ${a.location.lng.toFixed(4)}`}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} color="#D97706" /> {timeAgo(a.createdAt)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                             👤 {a.reporterName}
                          </span>
                          {Object.keys(a.responses || {}).length > 0 && (
                            <span style={{ color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              ✅ {Object.keys(a.responses!).length} responder{Object.keys(a.responses!).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={20} color="#94A3B8" style={{ flexShrink: 0, marginTop: 8 }} />
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

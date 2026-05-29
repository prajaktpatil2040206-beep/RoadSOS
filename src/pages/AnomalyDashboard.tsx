import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAnomalies } from '../services/anomalyService';
import type { Anomaly, AnomalyStatus } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';
import { Activity, ChevronRight, Filter } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function AnomalyDashboard() {
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnomalyStatus | 'all'>('all');

  useEffect(() => {
    const unsub = subscribeToAnomalies(list => {
      setAnomalies(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === 'all' ? anomalies : anomalies.filter(a => a.status === filter);

  const counts = {
    all: anomalies.length,
    reported: anomalies.filter(a => a.status === 'reported').length,
    responding: anomalies.filter(a => a.status === 'responding').length,
    resolved: anomalies.filter(a => a.status === 'resolved').length,
  };

  const FILTERS = [
    { key: 'all', label: 'All', color: 'var(--text-1)' },
    { key: 'reported', label: '🔴 Reported', color: 'var(--red)' },
    { key: 'responding', label: '🟡 Responding', color: 'var(--yellow)' },
    { key: 'resolved', label: '🟢 Resolved', color: 'var(--green)' },
  ] as const;

  function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="page">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={22} color="var(--red)" /> Incident Dashboard
          </h1>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/report')}>
            + Report Incident
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', count: counts.all, color: 'var(--text-1)', bg: 'var(--bg-card2)' },
            { label: 'Reported', count: counts.reported, color: 'var(--red)', bg: 'rgba(239,68,68,0.1)' },
            { label: 'Responding', count: counts.responding, color: 'var(--yellow)', bg: 'rgba(234,179,8,0.1)' },
            { label: 'Resolved', count: counts.resolved, color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 'var(--r-lg)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r-full)', border: 'none',
                background: filter === f.key ? 'var(--primary)' : 'var(--bg-card2)',
                color: filter === f.key ? '#fff' : 'var(--text-2)',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}>
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? <LoadingSpinner text="Loading incidents…" /> : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3>No incidents found</h3>
            <p style={{ marginTop: 6 }}>No active incidents in this category</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(a => {
              const sev = SEVERITY_META[a.severity];
              const cat = CATEGORY_META[a.category];
              const respCount = Object.keys(a.responses || {}).length;
              return (
                <div key={a.id} className="anomaly-item" onClick={() => navigate(`/incident/${a.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--r-md)',
                      background: sev.bg, border: `1px solid ${sev.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cat.label}</span>
                        <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>
                          Sev. {a.severity} – {sev.label}
                        </span>
                        <span className="badge" style={{
                          background: a.status === 'resolved' ? 'var(--green-soft)' : a.status === 'responding' ? 'rgba(234,179,8,0.15)' : 'var(--red-soft)',
                          color: a.status === 'resolved' ? 'var(--green)' : a.status === 'responding' ? 'var(--yellow)' : 'var(--red)',
                        }}>
                          {a.status}
                        </span>
                      </div>
                      <p className="truncate" style={{ fontSize: '0.82rem', marginBottom: 6 }}>{a.description}</p>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                        <span>📍 {a.location.address || `${a.location.lat.toFixed(4)}, ${a.location.lng.toFixed(4)}`}</span>
                        <span>🕐 {timeAgo(a.createdAt)}</span>
                        <span>👤 {a.reporterName}</span>
                        {respCount > 0 && <span style={{ color: 'var(--green)' }}>✅ {respCount} responder{respCount > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

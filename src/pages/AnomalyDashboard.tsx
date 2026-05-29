import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAnomalies } from '../services/anomalyService';
import type { Anomaly, AnomalyStatus } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';
import { Activity, ChevronRight, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  reported:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Reported' },
  responding: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'Responding' },
  resolved:   { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'Resolved' },
};

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
    all:        anomalies.length,
    reported:   anomalies.filter(a => a.status === 'reported').length,
    responding: anomalies.filter(a => a.status === 'responding').length,
    resolved:   anomalies.filter(a => a.status === 'resolved').length,
  };

  const STAT_CARDS = [
    { label: 'Total',      count: counts.all,        color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', icon: <Activity size={16} color="#4F46E5" /> },
    { label: 'Reported',   count: counts.reported,   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: <AlertCircle size={16} color="#DC2626" /> },
    { label: 'Responding', count: counts.responding, color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', icon: <Clock size={16} color="#C2410C" /> },
    { label: 'Resolved',   count: counts.resolved,   color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: <CheckCircle2 size={16} color="#059669" /> },
  ];

  const FILTER_TABS = [
    { key: 'all',        label: 'All' },
    { key: 'reported',   label: 'Reported' },
    { key: 'responding', label: 'Responding' },
    { key: 'resolved',   label: 'Resolved' },
  ] as const;

  return (
    <div className="page">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="#4F46E5" /> Incident Dashboard
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.25rem' }}>
              Monitor and track all road emergency reports
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/report')}
            style={{ flexShrink: 0 }}>
            <Plus size={15} /> Report Incident
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem', marginBottom: '1rem' }}>
          {STAT_CARDS.map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 12, padding: '0.875rem 1rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.03em' }}>{s.count}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', background: '#F1F5F9', padding: 3, borderRadius: 'var(--r-full)', overflowX: 'auto' }}>
          {FILTER_TABS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                flex: 1, minWidth: 'fit-content', padding: '0.5rem 0.875rem',
                borderRadius: 'var(--r-full)', border: 'none',
                background: filter === f.key ? '#FFFFFF' : 'transparent',
                color: filter === f.key ? '#0F172A' : '#64748B',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: filter === f.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                whiteSpace: 'nowrap',
              }}>
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {/* Incident list */}
        {loading ? (
          <LoadingSpinner text="Loading incidents…" />
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h3 style={{ color: '#0F172A', marginBottom: '0.375rem' }}>No incidents found</h3>
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>No active incidents in this category</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(a => {
              const sev = SEVERITY_META[a.severity];
              const cat = CATEGORY_META[a.category];
              const respCount = Object.keys(a.responses || {}).length;
              const statusStyle = STATUS_STYLES[a.status] || STATUS_STYLES.reported;
              return (
                <div key={a.id} className="anomaly-item" onClick={() => navigate(`/incident/${a.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: sev.bg, border: `1px solid ${sev.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.25rem', flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>{cat.label}</span>
                        <span className="sev-pill" style={{ background: sev.bg, color: sev.color }}>
                          Sev. {a.severity} – {sev.label}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 'var(--r-full)',
                          background: statusStyle.bg, color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                          fontSize: '0.68rem', fontWeight: 700,
                        }}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="truncate" style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.375rem' }}>
                        {a.description}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#94A3B8', flexWrap: 'wrap' }}>
                        <span>📍 {a.location.address || `${a.location.lat.toFixed(4)}, ${a.location.lng.toFixed(4)}`}</span>
                        <span>🕐 {timeAgo(a.createdAt)}</span>
                        <span>👤 {a.reporterName}</span>
                        {respCount > 0 && (
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            ✅ {respCount} responder{respCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={16} color="#94A3B8" style={{ flexShrink: 0, marginTop: 2 }} />
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

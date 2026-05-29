import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAnomalies } from '../services/anomalyService';
import type { Anomaly, AnomalyStatus } from '../types';
import { SEVERITY_META, CATEGORY_META } from '../types';
import { History, Search, X, ChevronRight, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';

type SortKey = 'recent' | 'severity_asc' | 'severity_desc' | 'resolved';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReportHistory() {
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | 'all'>('all');

  useEffect(() => {
    const unsub = subscribeToAnomalies(list => {
      setAnomalies(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = [...anomalies];

    // Status filter
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.description.toLowerCase().includes(q) ||
        (a.location.address || '').toLowerCase().includes(q) ||
        CATEGORY_META[a.category].label.toLowerCase().includes(q) ||
        a.reporterName.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortKey) {
      case 'recent':
        list.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'severity_desc':
        list.sort((a, b) => b.severity - a.severity);
        break;
      case 'severity_asc':
        list.sort((a, b) => a.severity - b.severity);
        break;
      case 'resolved':
        list.sort((a, b) => {
          if (a.status === 'resolved' && b.status !== 'resolved') return -1;
          if (b.status === 'resolved' && a.status !== 'resolved') return 1;
          return b.createdAt - a.createdAt;
        });
        break;
    }

    return list;
  }, [anomalies, search, sortKey, statusFilter]);

  const counts = {
    all: anomalies.length,
    reported: anomalies.filter(a => a.status === 'reported').length,
    responding: anomalies.filter(a => a.status === 'responding').length,
    resolved: anomalies.filter(a => a.status === 'resolved').length,
  };

  const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
    { key: 'recent', label: 'Most Recent', icon: <Clock size={13} /> },
    { key: 'severity_desc', label: 'Highest Severity', icon: <TrendingDown size={13} /> },
    { key: 'severity_asc', label: 'Lowest Severity', icon: <TrendingDown size={13} style={{ transform: 'rotate(180deg)' }} /> },
    { key: 'resolved', label: 'Resolved First', icon: <CheckCircle size={13} /> },
  ];

  return (
    <div className="page" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>
            <History size={22} color="#D97706" /> Report History
          </h1>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/report')} style={{ background: '#EF4444' }}>
            + Report Incident
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Total', count: counts.all, color: '#475569', bg: '#F1F5F9' },
            { label: 'Active', count: counts.reported, color: '#EF4444', bg: '#FEF2F2' },
            { label: 'Responding', count: counts.responding, color: '#D97706', bg: '#FFFBEB' },
            { label: 'Resolved', count: counts.resolved, color: '#10B981', bg: '#ECFDF5' },
          ].map(s => (
            <div
              key={s.label}
              onClick={() => setStatusFilter(s.label === 'Total' ? 'all' : s.label === 'Active' ? 'reported' : s.label === 'Responding' ? 'responding' : 'resolved')}
              style={{
                background: s.bg, border: `1px solid ${s.color}33`,
                borderRadius: 'var(--r-lg)', padding: '12px 14px',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 36, paddingRight: search ? 36 : 14, height: 38, fontSize: '0.85rem' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by description, location, category…"
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort select */}
          <select
            className="input"
            style={{ width: 'auto', height: 38, fontSize: '0.82rem', paddingLeft: 12 }}
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all', label: `All (${counts.all})`, color: '#64748B' },
            { key: 'reported', label: `🔴 Active (${counts.reported})`, color: '#EF4444' },
            { key: 'responding', label: `🟡 Responding (${counts.responding})`, color: '#D97706' },
            { key: 'resolved', label: `🟢 Resolved (${counts.resolved})`, color: '#10B981' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key as any)}
              style={{
                padding: '5px 14px', borderRadius: 'var(--r-full)',
                border: `1px solid ${statusFilter === f.key ? f.color : '#E2E8F0'}`,
                background: statusFilter === f.key ? `${f.color}18` : 'transparent',
                color: statusFilter === f.key ? f.color : '#64748B',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <LoadingSpinner text="Loading report history…" />
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {search ? '🔍' : '📋'}
            </div>
            <h3 style={{ color: '#0F172A', fontWeight: 700 }}>{search ? 'No results found' : 'No reports yet'}</h3>
            <p style={{ marginTop: 6, fontSize: '0.85rem', color: '#64748B' }}>
              {search ? `Try a different search term` : 'Be the first to report a road incident'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(a => {
              const sev = SEVERITY_META[a.severity];
              const cat = CATEGORY_META[a.category];
              const respCount = Object.keys(a.responses || {}).length;
              const statusColor = a.status === 'resolved' ? '#10B981' : a.status === 'responding' ? '#D97706' : '#EF4444';
              const statusBg = a.status === 'resolved' ? '#ECFDF5' : a.status === 'responding' ? '#FFFBEB' : '#FEF2F2';

              return (
                <div
                  key={a.id}
                  className="card"
                  onClick={() => navigate(`/incident/${a.id}`)}
                  style={{ position: 'relative', cursor: 'pointer', padding: '12px 16px', overflow: 'hidden', border: '1px solid #E2E8F0', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  {/* Severity indicator bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 4, background: sev.color,
                  }} />
                  <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 'var(--r-md)',
                      background: sev.bg, border: `1px solid ${sev.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>{cat.label}</span>
                        <span style={{ background: sev.bg, color: sev.color, padding: '2px 8px', borderRadius: 'var(--r-full)', fontSize: '0.7rem', fontWeight: 700 }}>
                          Sev. {a.severity} – {sev.label}
                        </span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                          borderRadius: 'var(--r-full)', background: statusBg, color: statusColor,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {a.status}
                        </span>
                      </div>
                      <p className="truncate" style={{ fontSize: '0.82rem', marginBottom: 5, color: '#475569' }}>{a.description}</p>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.73rem', color: '#64748B', flexWrap: 'wrap' }}>
                        <span>📍 {a.location.address || `${a.location.lat.toFixed(4)}, ${a.location.lng.toFixed(4)}`}</span>
                        <span>🕐 {timeAgo(a.createdAt)}</span>
                        <span>👤 {a.reporterName}</span>
                        {respCount > 0 && <span style={{ color: '#10B981', fontWeight: 600 }}>✅ {respCount} responder{respCount > 1 ? 's' : ''}</span>}
                        {a.resolvedAt && <span style={{ color: '#10B981', fontWeight: 600 }}>Resolved {timeAgo(a.resolvedAt)}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94A3B8" style={{ flexShrink: 0, marginTop: 6 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {!loading && anomalies.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.78rem', color: '#94A3B8' }}>
            Showing {filtered.length} of {anomalies.length} reports
          </div>
        )}
      </div>
    </div>
  );
}

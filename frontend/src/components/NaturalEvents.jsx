import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ChevronDown, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import './component-css/NaturalEvents.css';

/* ── type metadata ───────────────────────────────────────────────────── */
const TYPE_META = {
  earthquake: { label: 'Earthquake', color: '#F97316', emoji: '🌍' },
  storm:      { label: 'Storm',      color: '#6366F1', emoji: '🌩' },
  wildfire:   { label: 'Wildfire',   color: '#EF4444', emoji: '🔥' },
  volcano:    { label: 'Volcano',    color: '#DC2626', emoji: '🌋' },
  flood:      { label: 'Flood',      color: '#3B82F6', emoji: '🌊' },
  blizzard:   { label: 'Blizzard',   color: '#93C5FD', emoji: '❄️'  },
  weather:    { label: 'Weather',    color: '#14B8A6', emoji: '⛅'  },
};

const getMeta = (type) =>
  TYPE_META[type?.toLowerCase()] || { label: type || 'Natural', color: '#14B8A6', emoji: '🌐' };

const severityLabel = (s) => {
  if (s >= 5) return { label: 'CRITICAL', color: '#FF3B30' };
  if (s >= 4) return { label: 'HIGH',     color: '#F97316' };
  if (s >= 3) return { label: 'MED',      color: '#F59E0B' };
  return              { label: 'LOW',      color: '#22C55E' };
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
};

/* ── single event card ───────────────────────────────────────────────── */
function NaturalEventCard({ event, index }) {
  const [expanded, setExpanded] = useState(false);
  const meta   = getMeta(event.type);
  const sev    = severityLabel(event.severity);
  const srcUrl = event.sources?.[0]?.url;
  const hasCoords = Array.isArray(event.coords) && event.coords.length === 2;

  return (
    <motion.div
      className="ne-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      style={{ borderColor: `${meta.color}30` }}
    >
      {/* header */}
      <div className="ne-card-header" onClick={() => setExpanded(p => !p)}>
        <div className="ne-card-left">
          <span className="ne-emoji">{meta.emoji}</span>
          <span className="ne-type-label" style={{ color: meta.color }}>{meta.label}</span>
          <span className="ne-sev-badge" style={{ color: sev.color, borderColor: `${sev.color}50` }}>
            {sev.label}
          </span>
        </div>
        <div className="ne-card-right">
          {hasCoords && (
            <span className="ne-coord-tag">
              {event.coords[0].toFixed(1)}°, {event.coords[1].toFixed(1)}°
            </span>
          )}
          <span className="ne-date">{fmtDate(event.timestamp)}</span>
          <ChevronDown
            size={13}
            className="ne-chevron"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      <p className="ne-title">{event.title}</p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="ne-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {event.description && <p className="ne-desc">{event.description}</p>}
            <div className="ne-meta-row">
              {event.country && <span className="ne-chip">📍 {event.country}</span>}
              {event.confidence != null && (
                <span className="ne-chip">🎯 {Math.round(event.confidence * 100)}% conf</span>
              )}
            </div>
            {srcUrl && (
              <a href={srcUrl} target="_blank" rel="noreferrer"
                className="ne-source-link" style={{ color: meta.color }}>
                <ExternalLink size={10} /> View source
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── main panel ──────────────────────────────────────────────────────── */
export default function NaturalEvents({ events = [], loading = false, onClose, onRefresh }) {
  const [typeFilter, setTypeFilter] = useState('all');

  const types = useMemo(() => {
    const set = new Set(events.map(e => e.type).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [events]);

  const displayed = useMemo(() => {
    if (typeFilter === 'all') return events;
    return events.filter(e => e.type === typeFilter);
  }, [events, typeFilter]);

  return (
    <div className="ne-backdrop" onClick={onClose}>
      <motion.div
        className="ne-root"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 16  }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="ne-header">
          <div className="ne-header-left">
            <Zap size={15} className="ne-zap-icon" />
            <span className="ne-title-text">Natural Events</span>
            <span className="ne-count-badge">{events.length}</span>
          </div>
          <div className="ne-header-right">
            <button className="ne-refresh-btn" onClick={onRefresh} disabled={loading} title="Refresh">
              <RefreshCw size={13} style={loading ? { animation: 'ne-spin 1s linear infinite' } : {}} />
            </button>
            <button className="ne-close-btn" onClick={onClose} aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* SUBTITLE */}
        <p className="ne-subtitle">
          Live earthquakes (USGS) · NASA EONET active events — plotted on map as ✕
        </p>

        {/* TYPE PILLS */}
        <div className="ne-pills">
          {types.map(t => {
            const meta   = t === 'all' ? { color: '#94A3B8' } : getMeta(t);
            const active = typeFilter === t;
            return (
              <button
                key={t}
                className="ne-pill"
                onClick={() => setTypeFilter(t)}
                style={{
                  background:  active ? `${meta.color}22` : 'transparent',
                  borderColor: active ? meta.color         : 'transparent',
                  color:       active ? meta.color         : 'var(--text-muted)',
                }}
              >
                {t === 'all' ? 'All' : getMeta(t).label}
              </button>
            );
          })}
        </div>

        {/* EVENT LIST */}
        <div className="ne-list">
          {loading && events.length === 0 ? (
            <div className="ne-empty">
              <RefreshCw size={22} className="ne-empty-icon" style={{ animation: 'ne-spin 1s linear infinite' }} />
              <span>Fetching natural events…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="ne-empty">
              <AlertTriangle size={22} className="ne-empty-icon" />
              <span>No events match this filter</span>
            </div>
          ) : (
            displayed.map((ev, i) => (
              <NaturalEventCard key={ev.id || i} event={ev} index={i} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, X, ChevronDown, ExternalLink, AlertTriangle } from 'lucide-react';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/GlobalData.css';

/* ── helpers ─────────────────────────────────────────────────────────── */
const fmtDate = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const severityLabel = (s) => {
  if (s >= 5) return { label: 'CRITICAL', color: '#FF3B30' };
  if (s >= 4) return { label: 'HIGH',     color: '#F97316' };
  if (s >= 3) return { label: 'MED',      color: '#F59E0B' };
  return              { label: 'LOW',      color: '#22C55E' };
};

/* ── single event card ───────────────────────────────────────────────── */
function EventCard({ event, index }) {
  const [expanded, setExpanded] = useState(false);
  const color  = CATEGORY_COLORS[event.category] || '#94A3B8';
  const sev    = severityLabel(event.severity);
  const srcUrl = event.source_url || event.sources?.[0]?.url;

  return (
    <motion.div
      className="gd-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{ borderColor: `${color}30` }}
    >
      {/* header row */}
      <div className="gd-card-header" onClick={() => setExpanded(p => !p)}>
        <div className="gd-card-left">
          <div className="gd-cat-dot" style={{ background: color }} />
          <span className="gd-cat-label" style={{ color }}>{event.category}</span>
          <span className="gd-sev-badge" style={{ color: sev.color, borderColor: `${sev.color}50` }}>
            {sev.label}
          </span>
        </div>
        <div className="gd-card-right">
          <span className="gd-date">{fmtDate(event.published_at || event.timestamp)}</span>
          <ChevronDown
            size={13}
            className="gd-chevron"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* title */}
      <p className="gd-title">{event.title}</p>

      {/* expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="gd-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {event.description && (
              <p className="gd-desc">{event.description}</p>
            )}
            {srcUrl && (
              <a
                href={srcUrl}
                target="_blank"
                rel="noreferrer"
                className="gd-source-link"
                style={{ color }}
              >
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
export default function GlobalData({ events = [], onClose }) {
  const [catFilter, setCatFilter] = useState('all');

  const globalEvents = useMemo(
    () => events.filter(e => e.country === 'Global'),
    [events],
  );

  const categories = useMemo(() => {
    const set = new Set(globalEvents.map(e => e.category));
    return ['all', ...Array.from(set)];
  }, [globalEvents]);

  const displayed = useMemo(() => {
    if (catFilter === 'all') return globalEvents;
    return globalEvents.filter(e => e.category === catFilter);
  }, [globalEvents, catFilter]);

  return (
    /* Backdrop wraps the panel — flexbox centers it over the full viewport */
    <div className="gd-backdrop" onClick={onClose}>
      <motion.div
        className="gd-root"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 16  }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="gd-header">
          <div className="gd-header-left">
            <Globe size={15} className="gd-globe-icon" />
            <span className="gd-title-text">Global Intelligence</span>
            <span className="gd-count-badge">{globalEvents.length}</span>
          </div>
          <button className="gd-close-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* SUBTITLE */}
        <p className="gd-subtitle">
          Events not tied to a specific country — scope: worldwide
        </p>

        {/* CATEGORY PILLS */}
        <div className="gd-pills">
          {categories.map(cat => {
            const color  = cat === 'all' ? '#94A3B8' : (CATEGORY_COLORS[cat] || '#94A3B8');
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                className="gd-pill"
                onClick={() => setCatFilter(cat)}
                style={{
                  background:  active ? `${color}22`      : 'transparent',
                  borderColor: active ? color              : 'transparent',
                  color:       active ? color              : 'var(--text-muted)',
                }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            );
          })}
        </div>

        {/* EVENT LIST */}
        <div className="gd-list">
          {displayed.length === 0 ? (
            <div className="gd-empty">
              <AlertTriangle size={24} className="gd-empty-icon" />
              <span>No global events match this filter</span>
            </div>
          ) : (
            displayed.map((ev, i) => (
              <EventCard key={ev.id || i} event={ev} index={i} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

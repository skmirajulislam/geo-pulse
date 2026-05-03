import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MapPin, Calendar, Shield, AlertTriangle } from 'lucide-react';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/IntelPanel.css';

export default function IntelPanel({ event, isOpen, onClose }) {
  if (!event) return null;

  const categoryColor = CATEGORY_COLORS[event.category] || '#3B82F6';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="ip-backdrop"
            data-testid="intel-panel-backdrop"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="ip-panel glass-panel"
            data-testid="intel-panel"
          >
            <div className="ip-body">
              {/* Header */}
              <div className="ip-header">
                <div className="ip-header-left">
                  <div className="ip-badges">
                    <span
                      className="ip-category-badge"
                      style={{
                        backgroundColor: `${categoryColor}20`,
                        color: categoryColor,
                        border: `1px solid ${categoryColor}40`,
                      }}
                      data-testid="event-category-badge"
                    >
                      {event.category}
                    </span>
                    <span className="ip-type-badge">{event.type}</span>
                    <span className="ip-severity-label">Severity: {event.severity}/5</span>
                  </div>
                  <h2 className="ip-title" data-testid="event-title">{event.title}</h2>
              </div>
            </div>

              {/* Metadata */}
              <div className="ip-meta-grid">
                <div className="ip-meta-cell">
                  <div className="ip-meta-label-row">
                    <MapPin style={{ width: '0.75rem', height: '0.75rem' }} />
                    <span>Location</span>
                  </div>
                  <p className="ip-meta-value" data-testid="event-location">{event.country}</p>
                  {event.coords && (
                    <p className="ip-meta-coords">
                      {event.coords[0].toFixed(1)}°, {event.coords[1].toFixed(1)}°
                    </p>
                  )}
                </div>
                <div className="ip-meta-cell">
                  <div className="ip-meta-label-row">
                    <Calendar style={{ width: '0.75rem', height: '0.75rem' }} />
                    <span>Published</span>
                  </div>
                  <p className="ip-meta-time" data-testid="event-date">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </p>
                  <p className="ip-meta-time-sub">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Confidence & Score */}
              <div className="ip-score-grid">
                <div className="ip-score-card">
                  <div className="ip-score-label-row">
                    <Shield style={{ width: '0.75rem', height: '0.75rem' }} />
                    <span>Confidence</span>
                  </div>
                  <p className="ip-score-value" style={{ color: event.confidence >= 0.8 ? '#22C55E' : '#F59E0B' }}>
                    {Math.round((event.confidence || 0) * 100)}%
                  </p>
                </div>
                <div className="ip-score-card">
                  <div className="ip-score-label-row">
                    <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} />
                    <span>Relevance Score</span>
                  </div>
                  <p className="ip-score-value" style={{ color: categoryColor }}>
                    {event.score?.toFixed(2) || '—'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="ip-desc-section">
                <h3 className="ip-desc-heading">Description</h3>
                <p className="ip-desc-text" data-testid="event-description">{event.description}</p>
              </div>

              {/* Sources */}
              {event.sources && event.sources.length > 0 && (
                <div className="ip-sources-section">
                  <h3 className="ip-sources-heading">Sources</h3>
                  {event.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ip-source-link"
                      data-testid={`event-source-link-${idx}`}
                    >
                      <ExternalLink style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
                      <span className="ip-source-name">{src.name}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Close — bottom-right */}
              <div className="ip-footer">
                <button onClick={onClose} className="ip-close-btn" data-testid="intel-panel-close-btn">
                  <X style={{ width: '1rem', height: '1rem' }} />
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
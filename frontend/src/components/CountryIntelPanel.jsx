import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, TrendingDown, AlertTriangle, BarChart3, MapPin } from 'lucide-react';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/CountryIntelPanel.css';

const StabilityGauge = ({ score, label }) => {
  const getColor = () => {
    if (score >= 70) return '#22C55E';
    if (score >= 40) return '#F59E0B';
    return '#FF3B30';
  };
  const color = getColor();
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="cip-gauge-container" data-testid="stability-gauge">
      <div className="cip-gauge-svg-wrap">
        <svg className="cip-gauge-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
          <circle
            cx="50" cy="50" r="42"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="cip-gauge-center">
          <span className="cip-gauge-score" style={{ color }}>{score}</span>
          <span className="cip-gauge-sub">/ 100</span>
        </div>
      </div>
      <div className="cip-gauge-label-row">
        {label === 'Stable' && <Shield style={{ width: '0.75rem', height: '0.75rem', color }} />}
        {label === 'Moderate' && <AlertTriangle style={{ width: '0.75rem', height: '0.75rem', color }} />}
        {label === 'Unstable' && <TrendingDown style={{ width: '0.75rem', height: '0.75rem', color }} />}
        <span className="cip-gauge-label-text" style={{ color }}>{label}</span>
      </div>
    </div>
  );
};

const CategoryBar = ({ category, count, total }) => {
  const color = CATEGORY_COLORS[category] || '#3B82F6';
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="cip-bar-row">
      <span className="cip-bar-label">{category}</span>
      <div className="cip-bar-track">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="cip-bar-fill"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="cip-bar-count">{count}</span>
    </div>
  );
};

export default function CountryIntelPanel({ country, isOpen, onClose, allEvents = [] }) {
  const data = useMemo(() => {
    if (!country || !allEvents.length) return null;
    const countryEvents = allEvents.filter(
      e => e.country && e.country.toLowerCase() === country.toLowerCase()
    );
    if (countryEvents.length === 0) return null;

    const categoryBreakdown = {};
    let totalSeverity = 0;
    countryEvents.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
      totalSeverity += (e.severity || 0);
    });

    const avgSeverity = totalSeverity / countryEvents.length;
    const stabilityScore = Math.round(Math.max(0, Math.min(100, (1 - avgSeverity / 5) * 100)));
    const stabilityLabel = stabilityScore >= 70 ? 'Stable' : stabilityScore >= 40 ? 'Moderate' : 'Unstable';

    return {
      event_count: countryEvents.length,
      avg_severity: avgSeverity.toFixed(1),
      stability: { score: stabilityScore, label: stabilityLabel },
      category_breakdown: categoryBreakdown,
      recent_events: countryEvents.slice(0, 6),
    };
  }, [country, allEvents]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="cip-backdrop"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="cip-panel glass-panel"
            data-testid="country-intel-panel"
          >
            <div className="cip-body">
              {/* Header */}
              <div className="cip-header">
                <div>
                  <span className="cip-header-tag">Country Intelligence</span>
                  <h2 className="cip-country-name" data-testid="country-name">{country}</h2>
                </div>
                <button onClick={onClose} className="cip-close-btn" data-testid="country-panel-close-btn">
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>

              {data ? (
                <>
                  {/* Stability Index */}
                  <div className="cip-card">
                    <div className="cip-card-header">
                      <Shield style={{ width: '0.75rem', height: '0.75rem', color: 'var(--text-secondary)' }} />
                      <span className="cip-card-label">Stability Index</span>
                    </div>
                    <div className="cip-stability-row">
                      <StabilityGauge score={data.stability.score} label={data.stability.label} />
                      <div className="cip-stats">
                        <div className="cip-stat-row">
                          <span className="cip-stat-key">Events</span>
                          <span>{data.event_count}</span>
                        </div>
                        <div className="cip-stat-row">
                          <span className="cip-stat-key">Avg Severity</span>
                          <span>{data.avg_severity}/5</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="cip-card">
                    <div className="cip-card-header">
                      <BarChart3 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--text-secondary)' }} />
                      <span className="cip-card-label">Event Breakdown</span>
                    </div>
                    <div className="cip-bars">
                      {Object.entries(data.category_breakdown).map(([cat, count]) => (
                        <CategoryBar key={cat} category={cat} count={count} total={data.event_count} />
                      ))}
                    </div>
                  </div>

                  {/* Recent Events */}
                  {data.recent_events.length > 0 && (
                    <div className="cip-events-section">
                      <span className="cip-events-title">Recent Events</span>
                      <div className="cip-events-list">
                        {data.recent_events.map((evt, idx) => (
                          <div key={idx} className="cip-event-item" data-testid={`country-event-${idx}`}>
                            <div
                              className="cip-event-dot"
                              style={{ backgroundColor: CATEGORY_COLORS[evt.category] || '#3B82F6' }}
                            />
                            <div className="cip-event-content">
                              <p className="cip-event-title">{evt.title}</p>
                              <div className="cip-event-meta">
                                <span className="cip-event-source">{evt.source_name || evt.sources?.[0]?.name || ''}</span>
                                <span className="cip-event-type">
                                  <MapPin style={{ width: '0.625rem', height: '0.625rem' }} />
                                  {evt.type}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="cip-empty">No intelligence data available for this country.</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Activity } from 'lucide-react';
import './component-css/GlobalCounters.css';

export default function GlobalCounters({ stats, isConnected }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="gc-root"
      data-testid="global-counters"
    >
      {/* Logo / Brand */}
      <div className="gc-brand">
        {/* HP-styled globe: gold tint */}
        <Globe
          style={{
            width: '0.875rem',
            height: '0.875rem',
            color: '#D4AF37',
            flexShrink: 0,
            filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.4))',
          }}
        />
        <span className="gc-brand-name">GeoPulse</span>
        <span className="gc-brand-badge">AI</span>
      </div>

      {/* Events counter */}
      <div className="gc-counter">
        <span className="gc-counter-label">Events</span>
        <span className="gc-counter-value" data-testid="total-events-count">
          {stats.total_events.toLocaleString()}
        </span>
      </div>

      <div className="gc-divider" />

      {/* Countries counter */}
      <div className="gc-counter">
        <span className="gc-counter-label">Countries</span>
        <span className="gc-counter-value" data-testid="active-countries-count">
          {stats.active_countries}
        </span>
      </div>

      <div className="gc-divider" />

      {/* 24h counter */}
      <div className="gc-counter">
        <Activity
          style={{
            width: '0.625rem',
            height: '0.625rem',
            color: '#c0392b',
            flexShrink: 0,
            filter: 'drop-shadow(0 0 3px rgba(192,57,43,0.5))',
          }}
          className="animate-pulse-glow"
        />
        <span className="gc-counter-label">24h</span>
        <span className="gc-counter-value gc-counter-value--accent" data-testid="recent-events-count">
          {stats.recent_count}
        </span>
      </div>

      {/* Live connection pip
      <div className="gc-divider" />
      <div className="gc-counter" title={isConnected ? 'Live feed connected' : 'Disconnected'}>
        <span
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: isConnected ? '#27ae60' : '#c0392b',
            boxShadow: isConnected
              ? '0 0 6px rgba(39,174,96,0.6)'
              : '0 0 6px rgba(192,57,43,0.6)',
            flexShrink: 0,
            display: 'inline-block',
            animation: isConnected ? 'hp-live-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <span className="gc-counter-label" style={{ color: isConnected ? 'rgba(39,174,96,0.7)' : 'rgba(192,57,43,0.7)' }}>
          {isConnected ? 'Live' : 'Off'}
        </span>
      </div> */}

      {/* Inline keyframe for live pip pulse */}
      <style>{`
        @keyframes hp-live-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(1.3); }
        }
      `}</style>
    </motion.div>
  );
}

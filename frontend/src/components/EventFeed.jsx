import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/EventFeed.css';

const formatTime = (dateStr) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
};

export default function EventFeed({ events, onEventClick, onCountryClick }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const recentEvents = events.slice(0, 8);

  return (
   <motion.div className="ef-root">

  {/* 🔘 Feed Button */}
  {!isMinimized && (
    <button
      onClick={() => setIsMinimized(true)}
      className="ef-trigger glass-panel"
    >
      Feed
    </button>
  )}

  {/* 📂 Sliding Panel */}
  <motion.div
    initial={false}
    animate={{ x: isMinimized ? 0 : -320 }}
    transition={{ type: 'spring', stiffness: 260, damping: 25 }}
    className={`ef-panel glass-panel ${isMinimized ? 'ef-panel--open' : ''}`}
  >
    {/* ❌ Close */}
    <button
      onClick={() => setIsMinimized(false)}
      className="ef-close-btn"
    >
      ✕
    </button>

    {/* Header */}
    <div className="ef-header" style={{ cursor: 'default' }}>
      <div className="ef-header-left">
        <span className="ef-header-label">Live Intel Feed</span>
      </div>
      <div className="ef-header-right">
        <span className="ef-event-count">{events.length} events</span>
      </div>
    </div>

    {/* Scrollable list */}
    <div className="ef-list">
      {recentEvents.length === 0 ? (
        <div className="ef-empty">No events found</div>
      ) : (
        recentEvents.map((event, idx) => {
          const color = CATEGORY_COLORS[event.category] || '#3B82F6';

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onEventClick(event)}
              className="ef-item"
            >
              <div className="ef-item-inner">

                <div className="ef-dot-wrap">
                  <div
                    className="ef-dot"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}60`
                    }}
                  />
                </div>

                <div className="ef-content">
                  <p className="ef-title">{event.title}</p>

                  <div className="ef-meta">
                    <span
                      className="ef-country"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCountryClick?.(event.country);
                      }}
                    >
                      <MapPin size={12} />
                      {event.country}
                    </span>

                    <span className="ef-time">
                      <Clock size={12} />
                      {formatTime(event.published_at)}
                    </span>
                  </div>
                </div>

                <div className="ef-severity-wrap">
                  <span
                    className="ef-severity"
                    style={{
                      backgroundColor: `${color}15`,
                      color: color,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {event.severity}
                  </span>
                </div>

              </div>
            </motion.div>
          );
        })
      )}
    </div>
  </motion.div>
</motion.div>
  );
}

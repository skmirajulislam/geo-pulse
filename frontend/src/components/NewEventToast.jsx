import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/NewEventToast.css';

export default function NewEventToast({ event, onDismiss, onClick }) {
  if (!event) return null;
  const color = CATEGORY_COLORS[event.category] || '#3B82F6';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 300, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="toast-root glass-panel"
        onClick={() => onClick?.(event)}
        data-testid="new-event-toast"
      >
        <div className="toast-body">
          <div className="toast-icon-wrap">
            <div className="toast-icon-box" style={{ backgroundColor: `${color}20` }}>
              <AlertTriangle style={{ width: '1rem', height: '1rem', color }} />
            </div>
          </div>
          <div className="toast-content">
            <div className="toast-header-row">
              <span className="toast-new-label" style={{ color }}>New Event</span>
              <span className="toast-category">{event.category}</span>
            </div>
            <p className="toast-title">{event.title}</p>
            <p className="toast-country">{event.country}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
            className="toast-dismiss-btn"
            data-testid="toast-dismiss-btn"
          >
            <X style={{ width: '0.75rem', height: '0.75rem' }} />
          </button>
        </div>
        {/* Auto-dismiss progress bar */}
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 8, ease: 'linear' }}
          className="toast-progress"
          style={{ backgroundColor: color }}
          onAnimationComplete={onDismiss}
        />
      </motion.div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, RotateCcw } from 'lucide-react';
import './component-css/TimelineSlider.css';

export default function TimelineSlider({ availableDates = [], onTimelineChange, activeDate }) {
  const [hoveredDate, setHoveredDate] = useState(null);

  const dates = availableDates.length ? [...availableDates].sort() : [];
  const minDate = dates.length ? dates[0] : null;
  const maxDate = dates.length ? dates[dates.length - 1] : null;

  const handleSliderChange = (e) => {
    const idx = parseInt(e.target.value);
    if (idx >= 0 && idx < dates.length) {
      const date = dates[idx];
      onTimelineChange(date);
      setHoveredDate(date);
    }
  };

  const handleReset = () => {
    onTimelineChange(null);
    setHoveredDate(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const localDate = new Date(d.getTime() + Math.abs(d.getTimezoneOffset() * 60000));
      return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

const currentIdx = Math.max(
  0,
  activeDate ? dates.indexOf(activeDate) : dates.length - 1
);
 if (!dates.length) {
  return (
    <div className="ts-root glass-panel">
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: '12px',
        textAlign: 'center'
      }}>
        No timeline data
      </div>
    </div>
  );
}

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="ts-root glass-panel"
      data-testid="timeline-slider"
    >
      <div className="ts-header">
        <div className="ts-label-group">
          <Clock style={{ width: '0.75rem', height: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span className="ts-label-text">Timeline</span>
        </div>
        <div className="ts-controls">
          {activeDate && (
            <button
              onClick={handleReset}
              className="ts-reset-btn"
              data-testid="timeline-reset-btn"
            >
              <RotateCcw style={{ width: '0.75rem', height: '0.75rem' }} />
              Reset
            </button>
          )}
          <span className="ts-active-date" data-testid="timeline-active-date">
            {formatDate(hoveredDate || activeDate || maxDate)}
          </span>
        </div>
      </div>

      {/* Slider */}
      <div className="ts-slider-section">
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={currentIdx >= 0 ? currentIdx : dates.length - 1}
          onChange={handleSliderChange}
          className="timeline-range"
          style={{ width: '100%' }}
          data-testid="timeline-range-input"
        />
        <div className="ts-date-labels">
          <span className="ts-date-label">{formatDate(minDate)}</span>
          <span className="ts-date-label ts-date-label--right">{formatDate(maxDate)}</span>
        </div>
      </div>
    </motion.div>
  );
}

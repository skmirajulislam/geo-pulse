import React from 'react';
import { motion } from 'framer-motion';
import { Globe, X } from 'lucide-react';
import { CATEGORY_LIST } from '../services/api';
import './component-css/CategoryFilters.css';
import './component-css/GlobalData.css';
import './component-css/NaturalEvents.css';
const selectableCategories = CATEGORY_LIST.filter((cat) => cat.id !== 'all');

export default function CategoryFilters({
  selectedCategories,
  onSelectionChange,
  stats,
  weatherLayerEnabled = false,
  onWeatherLayerChange,
  globalPanelOpen = false,
  onGlobalClick,
  globalCount = 0,
  naturalPanelOpen = false,
  onNaturalClick,
  naturalLayerEnabled = false,
  onNaturalLayerChange,
  naturalCount = 0,
  cablesLayerEnabled = false,
  onCablesLayerChange,
  pipelinesLayerEnabled = false,
  onPipelinesLayerChange,
  dataCentersLayerEnabled = false,
  onDataCentersLayerChange,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const allSelected = selectedCategories.length === selectableCategories.length;
  const someSelected = selectedCategories.length > 0 && !allSelected;

  const toggleCategory = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      onSelectionChange(selectedCategories.filter((id) => id !== categoryId));
      return;
    }
    onSelectionChange([...selectedCategories, categoryId]);
  };

  const toggleAll = () => {
    if (allSelected) { onSelectionChange([]); return; }
    onSelectionChange(selectableCategories.map((cat) => cat.id));
  };

  return (
  <motion.div className="cf-root">

  {/* 🔘 Filters Button (hidden when open) */}
  {!isOpen && (
    <button
      onClick={() => setIsOpen(true)}
      className="cf-trigger glass-panel"
    >
      Filters
    </button>
  )}

  {/* 📂 Sliding Panel */}
  <motion.div
    initial={false}
    animate={{ x: isOpen ? 0 : -260 }}
    transition={{ type: 'spring', stiffness: 260, damping: 25 }}
    className={`cf-panel glass-panel ${isOpen ? 'cf-panel--open' : ''}`}
  >
    {/* ❌ Close Button */}
    <button
      onClick={() => setIsOpen(false)}
      className="cf-close-btn"
    >
      <X size={16} />
    </button>

    {/* Header */}
    <div className="cf-toggle-inner" style={{ paddingRight: '1.5rem' }}>
      <span className="cf-toggle-label">Filters</span>
      <span className="cf-toggle-count">
        {selectedCategories.length}/{selectableCategories.length}
      </span>
    </div>

    {/* Scrollable content */}
    <div className="cf-dropdown">

      {/* All categories */}
      <button onClick={toggleAll} className="cf-all-btn">
        <div className="cf-row">
          <div className="cf-row-left">
            <input type="checkbox" readOnly checked={allSelected} className="cf-checkbox" />
            <span className="cf-all-label">All Categories</span>
          </div>
          <span className="cf-count-badge">{stats.total_events}</span>
        </div>
      </button>

      {/* Categories */}
      {selectableCategories.map((cat) => {
        const isActive = selectedCategories.includes(cat.id);
        const count = stats.by_category[cat.id] || 0;

        return (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className="cf-cat-btn"
            style={{
              borderColor: isActive ? `${cat.color}60` : 'transparent',
              backgroundColor: isActive ? `${cat.color}10` : undefined,
            }}
          >
            <div className="cf-row">
              <div className="cf-row-left">
                <input type="checkbox" readOnly checked={isActive} className="cf-checkbox" />
                <div className="cf-cat-dot" style={{ backgroundColor: cat.color }} />
                <span className="cf-cat-label">{cat.label}</span>
              </div>
              <span className="cf-count-badge">{count}</span>
            </div>
          </button>
        );
      })}


      {/* Global */}
      <div className="cf-weather-divider">
        <button
          onClick={() => onGlobalClick?.()}
          className={`cf-global-btn${globalPanelOpen ? ' cf-global-btn--active' : ''}`}
        >
          <div className="cf-row">
            <div className="cf-row-left">
              <div className="cf-global-dot" />
              <span className="cf-global-label">Global</span>
            </div>
            <span className="cf-global-count">{globalCount}</span>
          </div>
        </button>
      </div>

      {/* Natural Events — layer toggle + panel opener */}
      <div className="cf-weather-divider">
        {/* Layer toggle row (checkbox + label) */}
        <div
          onClick={() => onNaturalLayerChange?.(!naturalLayerEnabled)}
          className={`cf-natural-btn${naturalLayerEnabled ? ' cf-natural-btn--active' : ''}`}
          role="button"
          tabIndex={0}
        >
          <div className="cf-row">
            <div className="cf-row-left">
              <input type="checkbox" readOnly checked={naturalLayerEnabled} className="cf-checkbox" />
              <div className="cf-natural-dot" />
              <span className="cf-natural-label">Natural Events</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="cf-natural-count">{naturalCount}</span>
              {/* List panel button */}
              <button
                onClick={(e) => { e.stopPropagation(); onNaturalClick?.(); }}
                style={{
                  fontSize: '9px',
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(20,184,166,0.4)',
                  background: naturalPanelOpen ? 'rgba(20,184,166,0.2)' : 'transparent',
                  color: '#2DD4BF',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                LIST
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Filters */}
      <div className="cf-weather-divider" style={{ marginTop: '12px' }}>
         <div style={{ fontSize: '10px', color: 'var(--hp-gold)', paddingLeft: '8px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Infrastructure</div>
         
         <button onClick={() => onCablesLayerChange?.(!cablesLayerEnabled)} className={`cf-natural-btn${cablesLayerEnabled ? ' cf-natural-btn--active' : ''}`}>
           <div className="cf-row">
             <div className="cf-row-left">
               <input type="checkbox" readOnly checked={cablesLayerEnabled} className="cf-checkbox" />
               <div className="cf-natural-dot" style={{ background: '#00E5FF', boxShadow: '0 0 5px #00E5FF' }} />
               <span className="cf-natural-label">Submarine Cables</span>
             </div>
           </div>
         </button>

         <button onClick={() => onPipelinesLayerChange?.(!pipelinesLayerEnabled)} className={`cf-natural-btn${pipelinesLayerEnabled ? ' cf-natural-btn--active' : ''}`} style={{ marginTop: '4px' }}>
           <div className="cf-row">
             <div className="cf-row-left">
               <input type="checkbox" readOnly checked={pipelinesLayerEnabled} className="cf-checkbox" />
               <div className="cf-natural-dot" style={{ background: '#FF6B00', boxShadow: '0 0 5px #FF6B00' }} />
               <span className="cf-natural-label">Pipelines</span>
             </div>
           </div>
         </button>

         <button onClick={() => onDataCentersLayerChange?.(!dataCentersLayerEnabled)} className={`cf-natural-btn${dataCentersLayerEnabled ? ' cf-natural-btn--active' : ''}`} style={{ marginTop: '4px' }}>
           <div className="cf-row">
             <div className="cf-row-left">
               <input type="checkbox" readOnly checked={dataCentersLayerEnabled} className="cf-checkbox" />
               <div className="cf-natural-dot" style={{ background: '#00FFB2', boxShadow: '0 0 5px #00FFB2' }} />
               <span className="cf-natural-label">Data Centers</span>
             </div>
           </div>
         </button>
      </div>

    </div>
  </motion.div>
</motion.div>
  );
}

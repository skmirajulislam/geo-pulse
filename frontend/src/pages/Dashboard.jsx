import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGeopoliticsData, fetchAvailableDates, fetchWeatherRegions, CATEGORY_LIST } from '../services/api';
import MapView from '../components/MapView';
import GlobalCounters from '../components/GlobalCounters';
import CategoryFilters from '../components/CategoryFilters';
import SearchBar from '../components/SearchBar';
import IntelPanel from '../components/IntelPanel';
import EventFeed from '../components/EventFeed';
import TimelineSlider from '../components/TimelineSlider';
import CountryIntelPanel from '../components/CountryIntelPanel';
import ChatBot from '../components/ChatBot';
import RoomChatPopup from '../components/RoomChatPopup';
import NewEventToast from '../components/NewEventToast';
import EventGraph from '../components/EventGraph';
import SimulationPanel from '../components/SimulationPanel';
import useWebSocket from '../hooks/useWebSocket';
import Preloader from '../components/Preloader';
import GlobalData from '../components/GlobalData';
import NaturalEvents from '../components/NaturalEvents';
import { fetchNaturalEvents } from '../services/api';
import { Map, Globe as GlobeIcon, GitBranch, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataHubDashboard from './DataHubDashboard';
const GlobeView = lazy(() => import('../components/GlobeView'));

/* ─────────────────────────── HP CSS injected once ──────────────────────── */
const HP_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=IM+Fell+English:ital@0;1&family=JetBrains+Mono:wght@400;600;700&display=swap');

  /* ── HP colour overrides ── */
  :root {
    --bg-base:            #0d0b07;
    --bg-panel:           #13100a;
    --bg-elevated:        #1e1910;
    --bg-card:            #181309;
    --border-default:     rgba(212,175,55,0.12);
    --border-accent:      rgba(212,175,55,0.28);
    --text-primary:       #e8dfc8;
    --text-secondary:     #a89060;
    --text-muted:         #6b5530;

    /* keep semantic event colours intact */
    --cat-political:      #7B5EEA;
    --cat-war:            #c0392b;
    --cat-economic:       #27ae60;
    --cat-sanctions:      #d4a017;
    --cat-diplomacy:      #2980b9;

    /* HP gold accent */
    --hp-gold:            #D4AF37;
    --hp-gold-dim:        rgba(212,175,55,0.18);
    --hp-gold-glow:       rgba(212,175,55,0.08);
    --hp-parchment:       #F5EDDA;
    --hp-dark-wood:       #2c1a0e;
  }

  /* ── Global font assignment ── */
  body, #root {
    background: var(--bg-base) !important;
    color: var(--text-primary) !important;
  }

  /* mono spans / labels  */
  .font-mono, [class*="font-mono"], code, pre {
    font-family: 'JetBrains Mono', monospace !important;
  }

  /* glass-panel gets HP parchment tint */
  .glass-panel {
    background: rgba(19,16,10,0.82) !important;
    border: 1px solid var(--border-default) !important;
    backdrop-filter: blur(12px) saturate(1.2) !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(212,175,55,0.06) !important;
  }

  /* ── HP parchment noise texture overlay (fixed, pointer-none) ── */
  .hp-texture-overlay {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    mix-blend-mode: overlay;
  }

  /* ── HP sparkles canvas ── */
  .hp-sparkles {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  /* ── Corner wards / runes ── */
  .hp-corner {
    position: fixed;
    z-index: 2;
    pointer-events: none;
    font-family: 'Cinzel', serif;
    font-size: 20px;
    color: rgba(212,175,55,0.18);
    line-height: 1;
  }
  .hp-corner-tl { top: 10px; left: 14px; }
  .hp-corner-tr { top: 10px; right: 14px; transform: scaleX(-1); }
  .hp-corner-bl { bottom: 10px; left: 14px; transform: scaleY(-1); }
  .hp-corner-br { bottom: 10px; right: 14px; transform: scale(-1,-1); }

  /* ── HP top crest bar ── */
  .hp-crest-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 3px;
    z-index: 200;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(212,175,55,0.0) 10%,
      rgba(212,175,55,0.6) 40%,
      rgba(212,175,55,0.9) 50%,
      rgba(212,175,55,0.6) 60%,
      rgba(212,175,55,0.0) 90%,
      transparent 100%
    );
    box-shadow: 0 0 12px 2px rgba(212,175,55,0.25);
  }

  /* ── HP pipeline banner override ── */
  .hp-pipeline-banner {
    background: rgba(212,160,23,0.1) !important;
    border-bottom: 1px solid rgba(212,175,55,0.35) !important;
    color: #f0d060 !important;
    font-family: 'IM Fell English', serif !important;
    font-style: italic !important;
    letter-spacing: 0.04em !important;
  }

  /* ── HP button base ── */
  .hp-btn {
    font-family: 'Cinzel', serif !important;
    font-size: 10px !important;
    letter-spacing: 0.15em !important;
    text-transform: uppercase !important;
    background: rgba(19,16,10,0.85) !important;
    border: 1px solid var(--border-default) !important;
    color: var(--hp-gold) !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
  }
  .hp-btn:hover {
    background: var(--hp-gold-dim) !important;
    border-color: var(--border-accent) !important;
    box-shadow: 0 0 10px var(--hp-gold-glow) !important;
  }

  /* active/selected state for view toggle */
  .hp-btn-active {
    background: var(--hp-gold-dim) !important;
    border-color: rgba(212,175,55,0.5) !important;
    color: #ffe87a !important;
    box-shadow: 0 0 8px rgba(212,175,55,0.2) !important;
  }

  /* ── HP icon button in controls column ── */
  .hp-icon-btn {
    background: rgba(19,16,10,0.82) !important;
    border: 1px solid var(--border-default) !important;
    border-radius: 8px !important;
    color: var(--text-secondary) !important;
    transition: all 0.2s !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    cursor: pointer !important;
  }
  .hp-icon-btn:hover {
    background: var(--hp-gold-dim) !important;
    border-color: var(--border-accent) !important;
    color: var(--hp-gold) !important;
  }

  /* view-toggle pill */
  .hp-toggle-pill {
    background: rgba(19,16,10,0.85) !important;
    border: 1px solid var(--border-default) !important;
    border-radius: 8px !important;
    padding: 3px !important;
    display: flex !important;
    gap: 2px !important;
  }

  /* ── HP Data Hub / exit button ── */
  .hp-datahub-btn {
    font-family: 'Cinzel', serif !important;
    font-size: 9px !important;
    letter-spacing: 0.18em !important;
    text-transform: uppercase !important;
    background: rgba(19,16,10,0.9) !important;
    border: 1px solid rgba(212,175,55,0.25) !important;
    color: var(--hp-gold) !important;
    border-radius: 6px !important;
    padding: 6px 14px !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .hp-datahub-btn::before { content: '✦'; font-size: 8px; opacity: 0.7; }
  .hp-datahub-btn:hover {
    background: var(--hp-gold-dim) !important;
    border-color: rgba(212,175,55,0.55) !important;
    box-shadow: 0 0 14px rgba(212,175,55,0.15) !important;
  }

  /* ── Scrollbar styling ── */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg-base); }
  ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.4); }

  /* ── HP sparkle keyframe ── */
  @keyframes hp-twinkle {
    0%,100% { opacity: 0; transform: scale(0.4); }
    50%      { opacity: 1; transform: scale(1); }
  }
  @keyframes hp-float-icon {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(-4px) rotate(3deg); }
  }
`;

/* ── inject styles once ── */
function useHPStyles() {
  useEffect(() => {
    const id = 'hp-dashboard-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = HP_STYLE;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch(_){} };
  }, []);
}

/* ─────────────────────── floating sparkles ──────────────────────────────── */
const SPARKLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: `${4 + (i * 17.3) % 92}%`,
  y: `${6 + (i * 23.7) % 88}%`,
  size: 2 + (i % 3),
  delay: `${(i * 0.41) % 5}s`,
  dur:   `${2.5 + (i % 4) * 0.7}s`,
}));

function HpSparkles() {
  return (
    <div className="hp-sparkles">
      {SPARKLES.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x, top: s.y,
            width: s.size * 3, height: s.size * 3,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)',
            animation: `hp-twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────── DraggableControl ───────────────────────────────── */
const DRAG_CLICK_THRESHOLD   = 6;
const DRAG_CLICK_SUPPRESS_MS = 250;

function DraggableControl({ className = '', style = {}, children, ...props }) {
  const suppressClickUntilRef = React.useRef(0);
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const distance = Math.hypot(info.offset.x, info.offset.y);
        if (distance > DRAG_CLICK_THRESHOLD)
          suppressClickUntilRef.current = Date.now() + DRAG_CLICK_SUPPRESS_MS;
      }}
      onClickCapture={(e) => {
        if (Date.now() < suppressClickUntilRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`cursor-move ${className}`}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════ MAIN EXPORT ════════════════════════════════ */
export default function Dashboard() {
  useHPStyles();
  const navigate = useNavigate();

  const [markers, setMarkers]                         = useState([]);
  const [events, setEvents]                           = useState([]);
  const [stats, setStats]                             = useState({ total_events: 0, active_countries: 0, by_category: {}, recent_count: 0 });
  const [selectedCategories, setSelectedCategories]   = useState(CATEGORY_LIST.filter(c => c.id !== 'all').map(c => c.id));
  const [selectedEvent, setSelectedEvent]             = useState(null);
  const [isPanelOpen, setIsPanelOpen]                 = useState(false);
  const [searchQuery, setSearchQuery]                 = useState('');
  const [loading, setLoading]                         = useState(true);
  const [pipelineRunning, setPipelineRunning]         = useState(false);
  const [timelineDate, setTimelineDate]               = useState(null);
  const [availableDates, setAvailableDates]           = useState([]);
  const [viewMode, setViewMode]                       = useState('2d');
  const [selectedCountry, setSelectedCountry]         = useState(null);
  const [isCountryPanelOpen, setIsCountryPanelOpen]   = useState(false);
  const [newEventToast, setNewEventToast]             = useState(null);
  const [isGraphOpen, setIsGraphOpen]                 = useState(false);
  const [isSimulationOpen, setIsSimulationOpen]       = useState(false);
  const [weatherLayerEnabled, setWeatherLayerEnabled] = useState(false);
  const [weatherMarkers, setWeatherMarkers]           = useState([]);
  const [mode, setMode]                               = useState('map');
  const [isGlobalPanelOpen, setIsGlobalPanelOpen]     = useState(false);
  const [isNaturalPanelOpen, setIsNaturalPanelOpen]   = useState(false);
  const [naturalLayerEnabled, setNaturalLayerEnabled] = useState(false);
  const [naturalEvents, setNaturalEvents]             = useState([]);
  const [naturalLoading, setNaturalLoading]           = useState(false);
  const [cablesLayerEnabled, setCablesLayerEnabled]       = useState(false);
  const [pipelinesLayerEnabled, setPipelinesLayerEnabled] = useState(false);
  const [dataCentersLayerEnabled, setDataCentersLayerEnabled] = useState(false);

  /* ── WebSocket ─────────────────────────────────────────────────────────── */
  const handleNewEvent = useCallback((eventData) => {
    if (eventData && !timelineDate) {
      setNewEventToast(eventData);
      setMarkers(prev => prev.some(m => m.id === eventData.id) ? prev : [eventData, ...prev]);
    }
  }, [timelineDate]);

  const handleStatsUpdate = useCallback((statsData) => {
    if (statsData?.total_events && !timelineDate)
      setStats(prev => ({ ...prev, total_events: statsData.total_events }));
  }, [timelineDate]);

  const { isConnected } = useWebSocket({ onNewEvent: handleNewEvent, onStatsUpdate: handleStatsUpdate });

  /* ── Data fetching ─────────────────────────────────────────────────────── */
  const fetchData = useCallback(async (targetDate = null) => {
    try {
      const data = await fetchGeopoliticsData(targetDate);
      setMarkers(data.markers);
      setEvents(data.events);
      setStats(data.stats);
      return data.events.length;
    } catch (e) { console.error('Fetch error:', e); return 0; }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const dates = await fetchAvailableDates();
        setAvailableDates(dates);
        const count = await fetchData();
        if (count === 0) setPipelineRunning(true);
      } catch (e) { console.error('Init error:', e); }
      setLoading(false);
    };
    init();
  }, [fetchData]);

  useEffect(() => { if (!loading) fetchData(timelineDate); }, [timelineDate, fetchData, loading]);

  useEffect(() => {
    const POLL_MS = pipelineRunning ? 15000 : 60000;
    const interval = setInterval(async () => {
      if (!timelineDate) {
        const count = await fetchData();
        if (count > 0 && pipelineRunning) {
          setPipelineRunning(false);
          const dates = await fetchAvailableDates();
          setAvailableDates(dates);
        }
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchData, timelineDate, pipelineRunning]);

  useEffect(() => {
    let cancelled = false;
    let interval  = null;
    const loadWeatherRegions = async () => {
      try {
        const regions = await fetchWeatherRegions();
        if (!cancelled) setWeatherMarkers(regions);
      } catch { if (!cancelled) setWeatherMarkers([]); }
    };
    if (weatherLayerEnabled) {
      loadWeatherRegions();
      interval = setInterval(loadWeatherRegions, 10 * 60 * 1000);
    } else { setWeatherMarkers([]); }
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [weatherLayerEnabled]);

  useEffect(() => {
    const shouldFetch = naturalLayerEnabled || isNaturalPanelOpen;
    if (!shouldFetch || naturalEvents.length > 0) return;
    let cancelled = false;
    const load = async () => {
      setNaturalLoading(true);
      try { const data = await fetchNaturalEvents(); if (!cancelled) setNaturalEvents(data); }
      catch (e) { console.error('Natural events fetch error:', e); }
      finally { if (!cancelled) setNaturalLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [naturalLayerEnabled, isNaturalPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const globalEvents = useMemo(() => events.filter(e => e.country === 'Global'), [events]);

  const filteredMarkers = useMemo(() => {
    let result = markers
      .filter(e => e.country !== 'Global')
      .filter(e => selectedCategories.includes(e.category));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.country.toLowerCase().includes(q));
    }
    return result;
  }, [markers, selectedCategories, searchQuery]);

  const filteredEvents = useMemo(() => {
    let result = events.filter(e => selectedCategories.includes(e.category));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, selectedCategories, searchQuery]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  const handleEventClick = useCallback((event) => {
    setIsCountryPanelOpen(false);
    setSelectedEvent(event);
    setIsPanelOpen(true);
  }, []);

  const handleCountryClick = useCallback((countryName) => {
    setIsPanelOpen(false);
    setSelectedCountry(countryName);
    setIsCountryPanelOpen(true);
  }, []);

  /* ── Loading screen ────────────────────────────────────────────────────── */
  if (loading) return <Preloader />;

  /* ── DataHub mode ──────────────────────────────────────────────────────── */
  if (mode === 'datahub') {
    return (
      <DataHubDashboard
        events={events}
        markers={filteredMarkers}
        filteredEvents={filteredEvents}
        onEventClick={handleEventClick}
        onCountryClick={handleCountryClick}
        onExit={() => setMode('map')}
      />
    );
  }

  /* ── Main render ───────────────────────────────────────────────────────── */
  return (
    <div
      data-testid="dashboard"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* ── HP decorative layer (z-index 0–2, pointer-none) ── */}
      <HpSparkles />
      <div className="hp-texture-overlay" />

      {/* HP top gold crest bar */}
      <div className="hp-crest-bar" />

      {/* HP corner ornaments */}
      <div className="hp-corner hp-corner-tl">❧</div>
      <div className="hp-corner hp-corner-tr">❧</div>
      <div className="hp-corner hp-corner-bl">❧</div>
      <div className="hp-corner hp-corner-br">❧</div>

      {/* ── Layer 0: Full-viewport map / globe ── */}
      {viewMode === '2d' ? (
        <MapView
          events={filteredMarkers}
          weatherMarkers={weatherMarkers}
          naturalEventMarkers={naturalLayerEnabled ? naturalEvents : []}
          cablesLayerEnabled={cablesLayerEnabled}
          pipelinesLayerEnabled={pipelinesLayerEnabled}
          dataCentersLayerEnabled={dataCentersLayerEnabled}
          onEventClick={handleEventClick}
          onCountryClick={handleCountryClick}
          selectedEvent={selectedEvent}
        />
      ) : (
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)' }} />}>
          <GlobeView
            events={filteredMarkers}
            weatherMarkers={weatherMarkers}
            onEventClick={handleEventClick}
            selectedEvent={selectedEvent}
          />
        </Suspense>
      )}

      {/* ── Layer 1: Fixed overlay UI ─────────────────────────────────────── */}

      {/* Data Hub toggle — HP styled */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => setMode(prev => prev === 'map' ? 'datahub' : 'map')}
        className="hp-datahub-btn"
        style={{ position: 'fixed', top: '1.1rem', right: '1rem', zIndex: 100 }}
      >
        {mode === 'map' ? 'Data Hub' : 'Back to Map'}
      </motion.button>

      {/* Pipeline warming-up banner — HP flavour text */}
      {pipelineRunning && (
        <div
          className="hp-pipeline-banner"
          style={{
            position: 'fixed', top: 3, left: 0, right: 0,
            zIndex: 300,
            textAlign: 'center',
            padding: '0.35rem 1rem',
            fontSize: '0.75rem',
          }}
        >
          ⚡ The owls are dispatched — intelligence arriving shortly. Checking every 15s…
        </div>
      )}

      {/* Top-center: Global Counters — unchanged component */}
      <GlobalCounters stats={stats} isConnected={isConnected} />

      {/* Top-left: Category Filters — unchanged component */}
      <CategoryFilters
        selectedCategories={selectedCategories}
        onSelectionChange={setSelectedCategories}
        stats={stats}
        weatherLayerEnabled={weatherLayerEnabled}
        onWeatherLayerChange={setWeatherLayerEnabled}
        globalPanelOpen={isGlobalPanelOpen}
        onGlobalClick={() => setIsGlobalPanelOpen(p => !p)}
        globalCount={globalEvents.length}
        naturalPanelOpen={isNaturalPanelOpen}
        onNaturalClick={() => setIsNaturalPanelOpen(p => !p)}
        naturalLayerEnabled={naturalLayerEnabled}
        onNaturalLayerChange={(val) => {
          setNaturalLayerEnabled(val);
          if (val) setIsNaturalPanelOpen(true);
        }}
        naturalCount={naturalEvents.length}
        cablesLayerEnabled={cablesLayerEnabled}
        onCablesLayerChange={setCablesLayerEnabled}
        pipelinesLayerEnabled={pipelinesLayerEnabled}
        onPipelinesLayerChange={setPipelinesLayerEnabled}
        dataCentersLayerEnabled={dataCentersLayerEnabled}
        onDataCentersLayerChange={setDataCentersLayerEnabled}
      />

      {/* Top-right: controls column — HP-styled shell buttons */}
      <div
        data-testid="controls-column"
        style={{
          position: 'fixed',
          top: '5rem',
          right: '1rem',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.5rem',
        }}
      >
        {/* View toggle 2D / 3D */}
        <DraggableControl
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          data-testid="view-toggle"
        >
          <div className="hp-toggle-pill">
            <button
              onClick={() => setViewMode('2d')}
              className={viewMode === '2d' ? 'hp-btn hp-btn-active' : 'hp-btn'}
              style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, border: 'none' }}
              data-testid="view-2d-btn"
            >
              <Map style={{ width: 13, height: 13 }} />
              <span>2D</span>
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={viewMode === '3d' ? 'hp-btn hp-btn-active' : 'hp-btn'}
              style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, border: 'none' }}
              data-testid="view-3d-btn"
            >
              <GlobeIcon style={{ width: 13, height: 13 }} />
              <span>3D</span>
            </button>
          </div>
        </DraggableControl>

        {/* Event Graph button */}
        <DraggableControl data-testid="graph-btn">
          <motion.button
            whileHover={{ scale: 1.04 }}
            onClick={() => setIsGraphOpen(true)}
            className="hp-icon-btn"
            style={{
              padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border-default)',
              background: 'rgba(19,16,10,0.85)',
            }}
          >
            <GitBranch style={{ width: 13, height: 13, color: 'var(--cat-political)' }} />
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}
              className="hidden lg:block">
              Graph
            </span>
          </motion.button>
        </DraggableControl>

        {/* Simulation button */}
        <DraggableControl data-testid="simulation-btn">
          <motion.button
            whileHover={{ scale: 1.04 }}
            onClick={() => setIsSimulationOpen(true)}
            className="hp-icon-btn"
            style={{
              padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border-default)',
              background: 'rgba(19,16,10,0.85)',
            }}
          >
            <Zap style={{ width: 13, height: 13, color: 'var(--cat-economic)' }} />
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}
              className="hidden lg:block">
              Simulate
            </span>
          </motion.button>
        </DraggableControl>

        {/* Search — unchanged component */}
        <DraggableControl>
          <SearchBar onSearch={setSearchQuery} />
        </DraggableControl>

        {/* Room chat — unchanged component */}
        <DraggableControl data-testid="chat-rooms-btn">
          <RoomChatPopup />
        </DraggableControl>
      </div>

      {/* Bottom-left: Event Feed — unchanged component */}
      <EventFeed
        events={filteredEvents}
        onEventClick={handleEventClick}
        onCountryClick={handleCountryClick}
      />

      {/* ── Layer 2: Portal fixed UI ─────────────────────────────────────── */}
      {createPortal(
        <>
          <TimelineSlider
            availableDates={availableDates}
            events={markers}
            onTimelineChange={setTimelineDate}
            activeDate={timelineDate}
          />
          {newEventToast && (
            <NewEventToast
              event={newEventToast}
              onDismiss={() => setNewEventToast(null)}
              onClick={handleEventClick}
            />
          )}
          <ChatBot />
        </>,
        document.body
      )}

      {/* ── Layer 3: Modals ───────────────────────────────────────────────── */}
      <IntelPanel
        event={selectedEvent}
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); setSelectedEvent(null); }}
      />
      <CountryIntelPanel
        country={selectedCountry}
        isOpen={isCountryPanelOpen}
        onClose={() => setIsCountryPanelOpen(false)}
        allEvents={events}
      />
      <EventGraph
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
        allEvents={events}
      />
      <SimulationPanel
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
      />

      {/* ── Floating panels ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isGlobalPanelOpen && (
          <GlobalData events={globalEvents} onClose={() => setIsGlobalPanelOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isNaturalPanelOpen && (
          <NaturalEvents
            events={naturalEvents}
            loading={naturalLoading}
            onClose={() => setIsNaturalPanelOpen(false)}
            onRefresh={async () => {
              setNaturalEvents([]);
              setNaturalLoading(true);
              try { setNaturalEvents(await fetchNaturalEvents()); }
              catch (e) { console.error('Refresh error:', e); }
              finally { setNaturalLoading(false); }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
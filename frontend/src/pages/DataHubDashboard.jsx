import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, Flame, CloudSun, TrendingUp, TrendingDown, Minus,
  RefreshCw, PanelRightClose, PanelRightOpen, ExternalLink,
  BarChart3, Loader2, AlertTriangle, Radio, Globe, X,
} from 'lucide-react';

import MapView from '../components/MapView';
import EventFeed from '../components/EventFeed';
import {
  fetchStockQuotes,
  fetchTrendingArticles,
  fetchWeatherForecast,
  fetchWeatherRegions,
} from '../services/api';

/* ─────────────────────────── constants ───────────────────────────── */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

const LIVE_CHANNELS = [
  { id: 'bbc',  name: 'BBC News',        embedUrl: 'https://www.youtube.com/embed/gCNeDWCI0vo', externalUrl: 'https://www.youtube.com/watch?v=gCNeDWCI0vo' },
  { id: 'cnn',  name: 'CNN Intl',        embedUrl: 'https://www.youtube.com/embed/1fueZCTYkpA', externalUrl: 'https://www.youtube.com/watch?v=1fueZCTYkpA' },
  { id: 'aj',   name: 'Al Jazeera',      embedUrl: 'https://www.youtube.com/embed/bNyUyrR0PHo', externalUrl: 'https://www.youtube.com/watch?v=bNyUyrR0PHo' },
  { id: 'fox',  name: 'Fox News',        embedUrl: 'https://www.youtube.com/embed/Zbw9-K8xj94', externalUrl: 'https://www.youtube.com/watch?v=Zbw9-K8xj94' },
  { id: 'sky',  name: 'Sky News',        embedUrl: 'https://www.youtube.com/embed/9Auq9mYxFEE', externalUrl: 'https://www.youtube.com/watch?v=9Auq9mYxFEE' },
];

const WEATHER_METRICS = [
  { id: 'temperature_2m',            label: 'Temperature' },
  { id: 'wind_speed_10m',            label: 'Wind Speed' },
  { id: 'precipitation_probability', label: 'Precipitation' },
];

const MARKET_FALLBACK = [
  { symbol: 'SPX', name: 'S&P 500',   changePct:  0.8,  direction: 'up'   },
  { symbol: 'GC',  name: 'Gold',      changePct:  1.2,  direction: 'up'   },
  { symbol: 'CL',  name: 'Crude Oil', changePct: -0.4,  direction: 'down' },
  { symbol: 'DXY', name: 'US Dollar', changePct:  0.0,  direction: 'flat' },
  { symbol: 'BTC', name: 'Bitcoin',   changePct:  2.1,  direction: 'up'   },
];

const RISK_LEVELS = { low: 1, medium: 3, high: 5 };

/* ─────────────────────────── tiny helpers ────────────────────────── */

const Mono = ({ children, className = '', style = {} }) => (
  <span className={className} style={{ fontFamily: "'JetBrains Mono', monospace", ...style }}>
    {children}
  </span>
);

const LiveBadge = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--cat-war)', borderRadius: 4,
    padding: '2px 7px', fontSize: 9,
    fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#fff',
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: '50%', background: '#fff',
      animation: 'dh-blink 1.2s infinite',
    }} />
    LIVE
  </span>
);

const CardHeader = ({ dotColor, title, right }) => (
  <div style={{
    padding: '8px 14px',
    borderBottom: '1px solid var(--border-default)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  }}>
    <Mono style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
      {title}
    </Mono>
    {right}
  </div>
);

/* ─────────────────────────── sub-panels ─────────────────────────── */

/* LEFT-1 · Live News */
function LiveNewsPanel() {
  const [channelId, setChannelId] = useState(LIVE_CHANNELS[0].id);
  const channel = useMemo(() => LIVE_CHANNELS.find(c => c.id === channelId), [channelId]);

  return (
    <div style={{ ...card, flex: '0 0 auto' }}>
      <CardHeader dotColor="var(--cat-war)" title="Live News" right={<LiveBadge />} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          background: '#000', borderRadius: 8, overflow: 'hidden',
          aspectRatio: '16/9', border: '1px solid var(--border-default)',
        }}>
          <iframe
            title={`${channel.name} live`}
            src={`${channel.embedUrl}?autoplay=1&mute=1`}
            style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <Mono style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {channel.name} Live
          </Mono>
          <a
            href={channel.externalUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--cat-political)', textDecoration: 'none' }}
          >
            Open <ExternalLink style={{ width: 10, height: 10 }} />
          </a>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {LIVE_CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setChannelId(ch.id)}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                padding: '3px 7px', borderRadius: 4,
                border: `1px solid ${ch.id === channelId ? 'var(--cat-war)' : 'var(--border-default)'}`,
                background: ch.id === channelId ? 'var(--cat-war)' : 'var(--bg-elevated)',
                color: ch.id === channelId ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {ch.name}
            </button>
          ))}
        </div>

        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          Streams are provider-hosted and may vary by region.
        </p>
      </div>
    </div>
  );
}

/* LEFT-2 · Trending Articles */
function ArticlesPanel({ articles, loading, onRefresh }) {
  return (
    <div style={{ ...card, flex: 1, overflow: 'hidden' }}>
      <CardHeader
        dotColor="var(--cat-sanctions)"
        title="Trending Articles"
        right={
          <button onClick={onRefresh} disabled={loading} style={iconBtn}>
            <RefreshCw style={{ width: 11, height: 11, ...(loading ? { animation: 'dh-spin 1s linear infinite' } : {}) }} />
          </button>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {loading && !articles.length && <LoadingRows />}
        {articles.map((item, i) => (
          <a
            key={item.id || i}
            href={item.url || '#'}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', padding: '7px 0', borderBottom: '1px solid var(--border-default)', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <Mono style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {item.source || item.country || 'Global'}
              </Mono>
              <Mono style={{ fontSize: 9, color: 'var(--cat-sanctions)', fontWeight: 600 }}>
                {Math.round((item.score || 0) * 100)}
              </Mono>
            </div>
            <p style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

/* RIGHT-1 · Markets + AI Correlation */
function MarketsPanel({ stocks, loading, riskLevel, summary, provider, onRefresh }) {
  const items = stocks.length ? stocks : MARKET_FALLBACK;

  return (
    <div style={{ ...card, flex: '0 0 auto' }}>
      <CardHeader
        dotColor="var(--cat-economic)"
        title="Markets"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mono style={{ fontSize: 8, color: 'var(--cat-economic)' }}>AI CORR</Mono>
            <button onClick={onRefresh} disabled={loading} style={iconBtn}>
              {loading
                ? <Loader2 style={{ width: 11, height: 11, animation: 'dh-spin 1s linear infinite', color: 'var(--cat-economic)' }} />
                : <RefreshCw style={{ width: 11, height: 11 }} />}
            </button>
          </div>
        }
      />
      <div style={{ padding: '6px 12px' }}>
        {items.map(item => {
          const up   = item.direction === 'up'   || item.changePct > 0;
          const down = item.direction === 'down' || item.changePct < 0;
          const color = up ? '#22C55E' : down ? 'var(--cat-war)' : 'var(--text-muted)';
          const barW  = Math.min(Math.abs(item.changePct || 0) * 20, 100);

          return (
            <div key={item.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-default)' }}>
              <div>
                <Mono style={{ fontSize: 11, fontWeight: 700 }}>{item.symbol}</Mono>
                <Mono style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block' }}>{item.name}</Mono>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono style={{ fontSize: 11, fontWeight: 600, color }}>{up ? '+' : ''}{Number(item.changePct || 0).toFixed(2)}%</Mono>
                <div style={{ width: 60, height: 3, background: 'var(--bg-elevated)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Risk level */}
        <div style={{ marginTop: 8 }}>
          <Mono style={{ fontSize: 8, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>OVERALL RISK</Mono>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= (RISK_LEVELS[riskLevel] || 3)
                  ? (riskLevel === 'high' ? 'var(--cat-war)' : 'var(--cat-sanctions)')
                  : 'var(--bg-elevated)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <Mono style={{ fontSize: 8, color: 'var(--cat-sanctions)', marginTop: 3, textTransform: 'uppercase' }}>
            {riskLevel || 'medium'}{provider ? ` · via ${provider}` : ''}
          </Mono>
        </div>

        {summary && (
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}

/* RIGHT-2 · Weather */
function WeatherPanel() {
  const [regions, setRegions]           = useState([]);
  const [regionId, setRegionId]         = useState('');
  const [metric, setMetric]             = useState('temperature_2m');
  const [days, setDays]                 = useState(7);
  const [forecast, setForecast]         = useState(null);
  const [loading, setLoading]           = useState(false);

  const region = useMemo(() => regions.find(r => r.id === regionId) || null, [regions, regionId]);

  const load = useCallback(async (r, d, m) => {
    if (!r) return;
    setLoading(true);
    try {
      const f = await fetchWeatherForecast({ latitude: r.latitude, longitude: r.longitude, days: d, hourly: m });
      setForecast(f);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWeatherRegions();
        setRegions(r);
        if (r[0]) { setRegionId(r[0].id); load(r[0], days, metric); }
      } catch (_) {}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (region) load(region, days, metric); }, [region, days, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = forecast?.current;
  const forecastDays = ['MON','TUE','WED','THU','FRI','SAT','SUN'].slice(0, days < 5 ? days : 5);
  const weatherEmoji = (t) => t >= 35 ? '☀' : t >= 28 ? '⛅' : t >= 20 ? '🌤' : '🌧';

  return (
    <div style={{ ...card, flex: 1 }}>
      <CardHeader dotColor="var(--cat-diplomacy)" title="Weather" right={null} />
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <select
            style={{ ...sel, gridColumn: 'span 2' }}
            value={regionId}
            onChange={e => setRegionId(e.target.value)}
          >
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select style={sel} value={days} onChange={e => setDays(Number(e.target.value))}>
            {[1,3,5,7].map(d => <option key={d} value={d}>{d}d</option>)}
          </select>
        </div>
        <select style={{ ...sel, width: '100%' }} value={metric} onChange={e => setMetric(e.target.value)}>
          {WEATHER_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        {cur && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {cur.temperature_2m}°C
                </div>
                <Mono style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {region?.name || 'Region'}
                </Mono>
              </div>
              <span style={{ fontSize: 32, lineHeight: 1 }}>{weatherEmoji(cur.temperature_2m)}</span>
            </div>
            {[
              ['Humidity', `${cur.relative_humidity_2m ?? '—'}%`],
              ['Wind',     `${cur.wind_speed_10m ?? '—'} km/h`],
              ['Rain',     `${cur.precipitation_probability ?? '—'}%`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Mono style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{label}</Mono>
                <Mono style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</Mono>
              </div>
            ))}
          </>
        )}

        {loading && !cur && <LoadingRows rows={3} />}

        <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
          {forecastDays.map((day, i) => (
            <div key={day} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 6, padding: '5px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Mono style={{ fontSize: 7, color: 'var(--text-muted)' }}>{day}</Mono>
              <span style={{ fontSize: 11 }}>{weatherEmoji(32 - i * 2)}</span>
              <Mono style={{ fontSize: 9, fontWeight: 600 }}>{32 - i * 2}°</Mono>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* CENTER · Inline SVG world map with event overlays */
function MapPanel({ events, markers, onEventClick, onCountryClick }) {
  const overlayEvents = useMemo(() => {
    const buckets = {};
    (events || []).forEach(e => {
      const key = e.country || 'Global';
      if (!buckets[key]) buckets[key] = { ...e, count: 0 };
      buckets[key].count += 1;
    });
    return Object.values(buckets).slice(0, 6);
  }, [events]);

  const catColor = {
    war: 'var(--cat-war)', conflict: 'var(--cat-war)',
    political: 'var(--cat-political)', sanctions: 'var(--cat-sanctions)',
    economic: 'var(--cat-economic)', diplomacy: 'var(--cat-diplomacy)',
  };

  return (
    <div style={{ flex: 1, position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-default)', background: '#0d1117', minHeight: 320 }}>
      {/* MapView sits behind */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView events={markers} onEventClick={onEventClick} onCountryClick={onCountryClick} />
      </div>

      {/* Overlay badges */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        {/* Top-left label */}
        <div style={{ position: 'absolute', top: 12, left: 14, pointerEvents: 'none' }}>
          <Mono style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.18em', display: 'block' }}>
            Global Event Map
          </Mono>
          <Mono style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)' }}>
            LIVE · {events?.length || 0} events tracked
          </Mono>
        </div>

        {/* Dynamic event badges */}
        {overlayEvents.map((ev, i) => (
          <motion.div
            key={ev.id || i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onEventClick && onEventClick(ev)}
            style={{
              position: 'absolute',
              top: `${18 + i * 12}%`,
              left: i % 2 === 0 ? '5%' : 'auto',
              right: i % 2 !== 0 ? '5%' : 'auto',
              background: 'rgba(18,21,29,0.88)',
              border: `1px solid var(--border-accent)`,
              borderRadius: 8,
              padding: '6px 10px',
              pointerEvents: 'all',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              maxWidth: 160,
            }}
          >
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
              padding: '2px 5px', borderRadius: 3, display: 'inline-block', fontWeight: 700,
              background: `${catColor[ev.category] || 'var(--cat-political)'}22`,
              color: catColor[ev.category] || 'var(--cat-political)',
              marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {ev.category || 'Event'}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {ev.country || 'Global'}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {ev.count > 1 ? `${ev.count} events` : (ev.title?.slice(0, 32) || '—')}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* TOPBAR */
function Topbar({ events, onExit, clock }) {
  const alertCount   = useMemo(() => (events || []).filter(e => ['war','conflict'].includes(e.category)).length, [events]);
  const riskColor    = alertCount > 10 ? 'var(--cat-war)' : alertCount > 4 ? 'var(--cat-sanctions)' : 'var(--cat-economic)';
  const riskLabel    = alertCount > 10 ? 'HIGH' : alertCount > 4 ? 'MED' : 'LOW';

  const pills = [
    { label: 'Events',  val: events?.length || 0, color: 'var(--cat-economic)'  },
    { label: 'Alerts',  val: alertCount,           color: 'var(--cat-war)'       },
    { label: 'Risk',    val: riskLabel,             color: riskColor              },
    { label: 'Markets', val: 'OPEN',                color: 'var(--cat-economic)' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border-default)',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* <div style={{
          width: 28, height: 28, background: 'var(--cat-political)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#fff',
        }}>DH</div> */}
        <Mono style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>DataHub</Mono>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pills.map(p => (
          <div key={p.label} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 8, padding: '4px 10px',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
            <Mono style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.label}</Mono>
            <Mono style={{ fontSize: 10, fontWeight: 600, color: p.color }}>{p.val}</Mono>
          </div>
        ))}
        <Mono style={{ fontSize: 10, color: 'var(--text-muted)' }}>{clock}</Mono>
      </div>

      {/* Exit */}
      <button
        onClick={onExit}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <X style={{ width: 11, height: 11 }} /> Exit
      </button>
    </div>
  );
}

/* BOTTOM STATS BAR */
function StatsBar({ events }) {
  const counts = useMemo(() => {
    const r = { conflict: 0, politics: 0, diplomatic: 0, economic: 0 };
    (events || []).forEach(e => {
      if (e.category === 'Armed Conflict') r.conflict++;
      else if (e.category === 'Politics') r.politics++;
      else if (e.category === 'Diplomacy') r.diplomatic++;
      else if (e.category === 'Global Economy') r.economic++;
    });
    return r;
  }, [events]);

  const stats = [
    { label: 'Active Conflicts', val: counts.conflict,  change: '+2',  dir: 'up',   color: 'var(--cat-war)'       },
    { label: 'Politics',         val: counts.politics,  change: '—',   dir: 'flat', color: 'var(--cat-political)' },
    { label: 'Diplomatic',       val: counts.diplomatic,change: '+7',  dir: 'up',   color: 'var(--cat-diplomacy)' },
    { label: 'Economic',         val: counts.economic,  change: '+3',  dir: 'up',   color: 'var(--cat-economic)'  },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          ...card, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <Mono style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>{s.label}</Mono>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</span>
          <Mono style={{ fontSize: 9, color: s.dir === 'up' ? s.color : s.dir === 'down' ? 'var(--cat-war)' : 'var(--text-muted)' }}>
            {s.dir === 'up' ? '▲' : s.dir === 'down' ? '▼' : '—'} {s.change} this week
          </Mono>
        </div>
      ))}
    </div>
  );
}

/* tiny shared loading placeholder */
function LoadingRows({ rows = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <div key={i} style={{ height: 14, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 8, opacity: 0.5, animation: 'dh-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
  ));
}

/* ─────────────────────────── shared styles ──────────────────────── */

const card = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 14,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', padding: 4, borderRadius: 4, lineHeight: 0,
  transition: 'background 0.15s',
};

const sel = {
  background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
  borderRadius: 6, padding: '4px 6px', fontSize: 11,
  color: 'var(--text-primary)', outline: 'none',
  fontFamily: "'JetBrains Mono', monospace",
};

/* ─────────────────────────── global keyframes ───────────────────── */
const KEYFRAMES = `
  @keyframes dh-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  @keyframes dh-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes dh-pulse { 0%,100%{opacity:0.5} 50%{opacity:0.25} }
`;

/* ═══════════════════════════ MAIN EXPORT ═══════════════════════════ */

export default function DataHubDashboard({
  events = [],
  markers = [],
  filteredEvents = [],
  onEventClick,
  onCountryClick,
  onExit,
}) {
  /* Clock */
  const [clock, setClock] = useState('');
  useEffect(() => {
  const tick = () => {
    const n = new Date();
    
    // 'Asia/Kolkata' ਟਾਈਮ ਜ਼ੋਨ ਦੀ ਵਰਤੋਂ ਕਰਕੇ IST ਸਮਾਂ ਕੱਢੋ
    const istTime = n.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    setClock(`${istTime} IST`);
  };

  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);


  /* Articles */
  const [articles, setArticles]       = useState([]);
  const [artLoading, setArtLoading]   = useState(false);
  const loadArticles = useCallback(async () => {
    setArtLoading(true);
    try { setArticles(await fetchTrendingArticles({ limit: 20, days: 3 })); }
    catch (_) {}
    finally { setArtLoading(false); }
  }, []);
  useEffect(() => { loadArticles(); }, [loadArticles]);

  /* Markets + AI correlation */
  const [stocks, setStocks]           = useState([]);
  const [mktLoading, setMktLoading]   = useState(false);
  const [aiData, setAiData]           = useState(null);
  const [aiProvider, setAiProvider]   = useState(null);

  const loadMarkets = useCallback(async () => {
    setMktLoading(true);
    try {
      const result = await fetchStockQuotes();
      setStocks(result.data || []);
    } catch (_) {}

    /* AI correlation call */
    try {
      const res = await fetch(`${BACKEND_URL}/api/finance/correlations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: events.slice(0, 15).map(e => ({
            title: e.title, category: e.category, country: e.country, type: e.type,
          })),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await res.json();
      setAiData(json.data);
      setAiProvider(json.provider);
    } catch (_) {}
    finally { setMktLoading(false); }
  }, [events]);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  /* ── render ── */
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}>
        {/* ── TOPBAR ── */}
        <Topbar events={events} onExit={onExit} clock={clock} />

        {/* ── MAIN GRID ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr 240px',
          gap: 10,
          padding: '10px 12px',
          flex: 1,
          minHeight: 0,
        }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <LiveNewsPanel />
            <ArticlesPanel articles={articles} loading={artLoading} onRefresh={loadArticles} />
          </div>

          {/* CENTER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <MapPanel
              events={events}
              markers={markers}
              onEventClick={onEventClick}
              onCountryClick={onCountryClick}
            />
            <StatsBar events={events} />
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <MarketsPanel
              stocks={stocks}
              loading={mktLoading}
              riskLevel={aiData?.risk_level}
              summary={aiData?.summary}
              provider={aiProvider}
              onRefresh={loadMarkets}
            />
            <WeatherPanel />
          </div>
        </div>

        {/* ── BOTTOM EVENT FEED ── */}
        <EventFeed
          events={filteredEvents}
          onEventClick={onEventClick}
          onCountryClick={onCountryClick}
        />
      </div>
    </>
  );
}
// DATA HUB

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Newspaper, Flame, CloudSun, TrendingUp, RefreshCw, PanelRightClose, PanelRightOpen, ExternalLink } from 'lucide-react';
import { fetchStockQuotes, fetchTrendingArticles, fetchWeatherForecast, fetchWeatherRegions } from '../services/api';
import './component-css/TopRightDataHub.css';

const WEATHER_METRICS = [
  { id: 'temperature_2m', label: 'Temperature' },
  { id: 'wind_speed_10m', label: 'Wind Speed' },
  { id: 'precipitation_probability', label: 'Precipitation' },
];

const TABS = [
  { id: 'live', label: 'Live News', icon: Newspaper },
  { id: 'articles', label: 'Articles', icon: Flame },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'stocks', label: 'Stocks', icon: TrendingUp },
];

const LIVE_CHANNELS = [
  {
    id: 'bbc-news',
    name: 'BBC News',
    embedUrl: 'https://www.youtube.com/embed/gCNeDWCI0vo',
    externalUrl: 'https://www.youtube.com/watch?v=gCNeDWCI0vo',
  },
  {
    id: 'cnn-international',
    name: 'CNN International',
    embedUrl: 'https://www.youtube.com/embed/1fueZCTYkpA',
    externalUrl: 'https://www.youtube.com/watch?v=1fueZCTYkpA',
  },
  {
    id: 'al-jazeera',
    name: 'Al Jazeera',
    embedUrl: 'https://www.youtube.com/embed/bNyUyrR0PHo',
    externalUrl: 'https://www.youtube.com/watch?v=bNyUyrR0PHo',
  },
  {
    id: 'fox-news',
    name: 'Fox News',
    embedUrl: 'https://www.youtube.com/embed/Zbw9-K8xj94',
    externalUrl: 'https://www.youtube.com/watch?v=Zbw9-K8xj94',
  },
  {
    id: 'sky-news',
    name: 'Sky News',
    embedUrl: 'https://www.youtube.com/embed/9Auq9mYxFEE',
    externalUrl: 'https://www.youtube.com/watch?v=9Auq9mYxFEE',
  },
];

export default function TopRightDataHub({ className = '' }) {
  const dragControls = useDragControls();
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('live');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedLiveChannelId, setSelectedLiveChannelId] = useState(LIVE_CHANNELS[0].id);
  const [articles, setArticles] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [stocksLive, setStocksLive] = useState(false);

  const [weatherRegions, setWeatherRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [weatherMetric, setWeatherMetric] = useState('temperature_2m');
  const [weatherDays, setWeatherDays] = useState(7);
  const [weatherForecast, setWeatherForecast] = useState(null);

  const selectedRegion = useMemo(
    () => weatherRegions.find((region) => region.id === selectedRegionId) || null,
    [weatherRegions, selectedRegionId],
  );
  const selectedLiveChannel = useMemo(
    () => LIVE_CHANNELS.find((channel) => channel.id === selectedLiveChannelId) || LIVE_CHANNELS[0],
    [selectedLiveChannelId],
  );

  const loadTabData = async (tab = activeTab) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'articles') {
        const data = await fetchTrendingArticles({ limit: 20, days: 3 });
        setArticles(data);
      } else if (tab === 'stocks') {
        const result = await fetchStockQuotes();
        setStocks(result.data);
        setStocksLive(result.live);
      } else if (tab === 'weather') {
        let regions = weatherRegions;
        if (regions.length === 0) {
          regions = await fetchWeatherRegions();
          setWeatherRegions(regions);
        }

        const defaultRegion = selectedRegion || regions[0];
        if (!defaultRegion) {
          setWeatherForecast(null);
          return;
        }

        if (!selectedRegionId) {
          setSelectedRegionId(defaultRegion.id);
        }

        const forecast = await fetchWeatherForecast({
          latitude: defaultRegion.latitude,
          longitude: defaultRegion.longitude,
          days: weatherDays,
          hourly: weatherMetric,
        });
        setWeatherForecast(forecast);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTabData(activeTab);
    }
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const run = async () => {
      if (!selectedRegion || activeTab !== 'weather' || !isOpen) return;
      setLoading(true);
      setError('');
      try {
        const forecast = await fetchWeatherForecast({
          latitude: selectedRegion.latitude,
          longitude: selectedRegion.longitude,
          days: weatherDays,
          hourly: weatherMetric,
        });
        setWeatherForecast(forecast);
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Failed to load weather');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedRegionId, weatherMetric, weatherDays]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className={className}
      data-testid="top-right-data-hub"
    >
      <div className={`glass-panel rounded-xl overflow-hidden max-w-[90vw] ${isOpen ? 'w-[320px] h-[520px] min-w-[300px] min-h-[260px] max-h-[82vh] resize overflow-auto' : 'w-[320px]'}`}>
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="px-3 py-2 border-b border-[var(--border-default)] flex items-center justify-between cursor-move select-none"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--text-secondary)]">
            Data Hub
          </span>
          <button
            className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isOpen && (
          <div>
            <div className="px-2 py-2 border-b border-[var(--border-default)] flex gap-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-mono flex items-center justify-center gap-1.5 transition-colors ${activeTab === id
                    ? 'bg-[var(--cat-political)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="p-3 h-[calc(100%-84px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                  {activeTab}
                </span>
                <button
                  onClick={() => loadTabData(activeTab)}
                  className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                  disabled={loading || activeTab === 'live'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[var(--text-secondary)] ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {error && <p className="text-xs text-[var(--cat-war)] mb-2">{error}</p>}

              {activeTab === 'live' && (
                <div className="space-y-2.5">
                  <div className="rounded-md overflow-hidden border border-[var(--border-default)] bg-black">
                    <iframe
                      title={`${selectedLiveChannel.name} live stream`}
                      src={`${selectedLiveChannel.embedUrl}?autoplay=1&mute=1`}
                      className="w-full aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">
                      {selectedLiveChannel.name} Live
                    </p>
                    <a
                      href={selectedLiveChannel.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--cat-political)] hover:text-white transition-colors"
                    >
                      Open Source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LIVE_CHANNELS.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedLiveChannelId(channel.id)}
                        className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${channel.id === selectedLiveChannelId
                            ? 'bg-[var(--cat-war)] border-[var(--cat-war)] text-white'
                            : 'bg-[var(--bg-panel)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                          }`}
                      >
                        {channel.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                    Streams are provider-hosted and may vary by region/availability.
                  </p>
                </div>
              )}

              {activeTab === 'articles' && articles.map((item) => (
                <a
                  key={item.id}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md p-2 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug line-clamp-2">{item.title}</p>
                    <span className="text-[10px] text-[var(--cat-sanctions)] font-mono">{Math.round((item.score || 0) * 100)}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{item.country || 'Global'} • {item.source || 'Unknown source'}</p>
                </a>
              ))}

              {activeTab === 'stocks' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">
                    Source: {stocksLive ? 'Live market feed' : 'Fallback'}
                  </p>
                  {stocks.map((item) => {
                    const isUp = item.direction === 'up';
                    const isDown = item.direction === 'down';
                    const color = isUp ? 'var(--cat-diplomacy)' : isDown ? 'var(--cat-war)' : 'var(--text-secondary)';
                    return (
                      <div key={item.symbol} className="rounded-md p-2 bg-[var(--bg-panel)] border border-[var(--border-default)]">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono">{item.symbol}</p>
                          <p className="text-xs font-mono" style={{ color }}>
                            {item.changePct > 0 ? '+' : ''}{Number(item.changePct || 0).toFixed(2)}%
                          </p>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">{item.name}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'weather' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="col-span-2 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
                      value={selectedRegionId}
                      onChange={(e) => setSelectedRegionId(e.target.value)}
                    >
                      {weatherRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
                      value={weatherDays}
                      onChange={(e) => setWeatherDays(Number(e.target.value))}
                    >
                      {[1, 3, 5, 7].map((day) => (
                        <option key={day} value={day}>{day}d</option>
                      ))}
                    </select>
                  </div>

                  <select
                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
                    value={weatherMetric}
                    onChange={(e) => setWeatherMetric(e.target.value)}
                  >
                    {WEATHER_METRICS.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {metric.label}
                      </option>
                    ))}
                  </select>

                  {weatherForecast?.current && (
                    <div className="rounded-md p-2 bg-[var(--bg-panel)] border border-[var(--border-default)]">
                      <p className="text-xs font-medium">
                        {selectedRegion?.name || 'Region'} • Current {weatherForecast.current.temperature_2m}°C
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Wind {weatherForecast.current.wind_speed_10m} km/h • Rain {weatherForecast.current.precipitation_probability}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

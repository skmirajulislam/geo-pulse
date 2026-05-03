import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Globe } from 'lucide-react';
import axios from 'axios';
import './component-css/SimulationPanel.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const SEVERITY_COLORS = ['#22C55E', '#22C55E', '#84CC16', '#F59E0B', '#F59E0B', '#FF8A00', '#FF8A00', '#FF3B30', '#FF3B30', '#DC2626', '#DC2626'];
const MARKET_ICONS = { up: TrendingUp, down: TrendingDown, stable: Minus };

const presets = [
  "If the Strait of Hormuz closes, what happens globally?",
  "If NATO deploys forces to Eastern Europe, what are the consequences?",
  "If a major earthquake hits Tokyo, what's the global economic impact?",
  "If oil prices spike to $200/barrel, what happens?",
  "If the US-China trade war escalates with full tariffs, what happens?",
];

export default function SimulationPanel({ isOpen, onClose }) {
  const [scenario, setScenario] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);

  const runSimulation = async (text) => {
    const input = text || scenario;
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setProvider(null);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/simulate`, { scenario: input }, { timeout: 45000 });
      setResult(res.data.simulation);
      setProvider(res.data.provider);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      setError(`Simulation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="sp-panel glass-panel"
          data-testid="simulation-panel"
        >
          {/* Header */}
          <div className="sp-header">
            <div className="sp-header-left">
              <Zap style={{ width: '1.25rem', height: '1.25rem', color: 'var(--cat-economic)' }} />
              <h2 className="sp-header-title">Predictive Simulation</h2>
              <span className="sp-header-badge">AI</span>
            </div>
            <button onClick={onClose} className="sp-close-btn" data-testid="simulation-close-btn">
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          </div>

          {/* Body */}
          <div className="sp-body">
            {/* Input */}
            <div className="sp-input-section">
              <label className="sp-input-label">Scenario Input</label>
              <div className="sp-input-row">
                <input
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSimulation()}
                  placeholder="What if..."
                  className="sp-input"
                  data-testid="simulation-input"
                />
                <button
                  onClick={() => runSimulation()}
                  disabled={loading || !scenario.trim()}
                  className="sp-run-btn"
                  data-testid="simulation-run-btn"
                >
                  {loading ? <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" /> : 'Simulate'}
                </button>
              </div>
              {/* Presets */}
              <div className="sp-presets">
                {presets.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setScenario(p); runSimulation(p); }}
                    className="sp-preset-btn"
                    data-testid={`preset-${i}`}
                  >
                    {p.substring(0, 50)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="sp-loading">
                <div className="sp-loading-inner">
                  <Loader2 style={{ width: '2rem', height: '2rem', color: 'var(--cat-economic)' }} className="animate-spin" />
                  <p className="sp-loading-text">Running geopolitical simulation...</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="sp-error">
                <div className="sp-error-inner">
                  <AlertTriangle style={{ width: '1rem', height: '1rem' }} />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sp-results">
                {/* Summary */}
                <div className="sp-summary-card">
                  <p className="sp-summary-text" data-testid="simulation-summary">{result.summary}</p>
                  {provider && <p className="sp-provider-note">Analysis by {provider}</p>}
                </div>

                {/* Metrics */}
                <div className="sp-metrics-grid">
                  <div className="sp-metric-card">
                    <span className="sp-metric-label">Probability</span>
                    <p className="sp-metric-value" style={{ color: SEVERITY_COLORS[Math.round((result.probability || 0) * 10)] }}>
                      {Math.round((result.probability || 0) * 100)}%
                    </p>
                  </div>
                  <div className="sp-metric-card">
                    <span className="sp-metric-label">Severity</span>
                    <p className="sp-metric-value" style={{ color: SEVERITY_COLORS[result.severity || 5] }}>
                      {result.severity || '?'}/10
                    </p>
                  </div>
                  <div className="sp-metric-card">
                    <span className="sp-metric-label">Timeline</span>
                    <p className="sp-metric-timeline-value">
                      <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
                      {(result.timeline || '').replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Chain Reactions */}
                {result.chain_reactions?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span className="sp-section-label">Chain Reactions</span>
                    <div className="sp-chain-list">
                      {result.chain_reactions.map((chain, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="sp-chain-item"
                          data-testid={`chain-${i}`}
                        >
                          <div className="sp-chain-step">
                            <span className="sp-chain-step-num">{chain.step || i + 1}</span>
                          </div>
                          <div className="sp-chain-content">
                            <p className="sp-chain-event">{chain.event}</p>
                            <div className="sp-chain-meta">
                              <span className="sp-chain-cat">{chain.category}</span>
                              <span className="sp-chain-delay">{chain.delay}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Market Impact */}
                {result.market_impact && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span className="sp-section-label">Market Impact</span>
                    <div className="sp-market-grid">
                      {['oil', 'gold', 'stocks'].map(key => {
                        const dir = result.market_impact[key] || 'stable';
                        const Icon = MARKET_ICONS[dir] || Minus;
                        const color = dir === 'up' ? '#22C55E' : dir === 'down' ? '#FF3B30' : '#94A3B8';
                        return (
                          <div key={key} className="sp-market-item">
                            <Icon style={{ width: '1rem', height: '1rem', color, flexShrink: 0 }} />
                            <span className="sp-market-key">{key}</span>
                            <span className="sp-market-dir" style={{ color }}>{dir}</span>
                          </div>
                        );
                      })}
                    </div>
                    {result.market_impact.description && (
                      <p className="sp-market-desc">{result.market_impact.description}</p>
                    )}
                  </div>
                )}

                {/* Affected Regions */}
                {result.affected_regions?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span className="sp-section-label">Affected Regions</span>
                    <div className="sp-regions-grid">
                      {result.affected_regions.map((r, i) => (
                        <div key={i} className="sp-region-card" data-testid={`region-${i}`}>
                          <div className="sp-region-header">
                            <span className="sp-region-name">
                              <Globe style={{ width: '0.75rem', height: '0.75rem' }} />
                              {r.region}
                            </span>
                            <span className={`sp-region-impact sp-region-impact--${r.impact}`}>{r.impact}</span>
                          </div>
                          <p className="sp-region-desc">{r.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

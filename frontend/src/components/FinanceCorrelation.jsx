import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import './component-css/FinanceCorrelation.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

/**
 * FinanceCorrelation — AI-powered market correlation panel.
 * Calls /api/finance/correlations with multi-provider LLM failover.
 */

const FALLBACK_DATA = {
  correlations: [
    { symbol: 'CL', name: 'Crude Oil', direction: 'stable', change_pct: 0, reason: 'Awaiting analysis' },
    { symbol: 'GC', name: 'Gold', direction: 'stable', change_pct: 0, reason: 'Awaiting analysis' },
    { symbol: 'SPX', name: 'S&P 500', direction: 'stable', change_pct: 0, reason: 'Awaiting analysis' },
  ],
  risk_level: 'medium',
  summary: 'Click refresh to generate AI market analysis based on current events.',
};

export default function FinanceCorrelation({ events = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);

  const fetchCorrelations = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/finance/correlations`, {
        events: events.slice(0, 15).map(e => ({
          title: e.title,
          category: e.category,
          country: e.country,
          type: e.type,
        })),
      }, { timeout: 30000 });
      setData(res.data.data);
      setProvider(res.data.provider);
    } catch (err) {
      console.error('Finance correlation error:', err);
      setData(FALLBACK_DATA);
    } finally {
      setLoading(false);
    }
  }, [events, loading]);

  const handleExpand = () => {
    setIsExpanded(true);
    if (!data && !loading) {
      fetchCorrelations();
    }
  };

  const displayData = data || FALLBACK_DATA;
  const correlations = displayData.correlations || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative glass-panel rounded-xl overflow-hidden transition-all ${isExpanded ? 'w-[260px]' : 'w-auto'}`}
      data-testid="finance-panel"
    >
      {!isExpanded ? (
        <button
          onClick={handleExpand}
          className="p-3 hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-2"
          data-testid="finance-toggle-btn"
        >
          <BarChart3 className="w-4 h-4 text-[var(--cat-economic)]" />
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">Markets</span>
        </button>
      ) : (
        <div>
          <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3 h-3 text-[var(--cat-economic)]" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--text-secondary)]">Market Correlation</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchCorrelations}
                disabled={loading}
                className="p-1 hover:bg-[var(--bg-elevated)] rounded transition-colors"
                title="Refresh analysis"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[var(--cat-economic)]" />
                ) : (
                  <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
                )}
              </button>
              <button onClick={() => setIsExpanded(false)} className="text-[10px] text-[var(--text-muted)] hover:text-white ml-1">
                ×
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {correlations.map((item, idx) => {
              const isUp = item.direction === 'up' || item.change_pct > 0;
              const isDown = item.direction === 'down' || item.change_pct < 0;
              const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
              const changeColor = isUp ? '#22C55E' : isDown ? '#FF3B30' : '#94A3B8';

              return (
                <div key={idx} className="flex items-center gap-2 py-1.5" data-testid={`finance-${item.symbol?.toLowerCase()}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold">{item.symbol}</span>
                      <Icon className="w-3 h-3" style={{ color: changeColor }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{item.name}</span>
                      <span className="text-[10px] font-mono" style={{ color: changeColor }}>
                        {isUp ? '+' : ''}{item.change_pct?.toFixed(1)}%
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5 leading-snug">{item.reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {displayData.summary && (
              <div className="pt-1 border-t border-[var(--border-default)]">
                <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">{displayData.summary}</p>
                {provider && (
                  <p className="text-[8px] font-mono text-[var(--text-muted)] mt-1 opacity-50">via {provider}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}


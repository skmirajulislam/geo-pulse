import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, GitBranch, ZoomIn, ZoomOut } from 'lucide-react';
import * as d3Force from 'd3-force';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/EventGraph.css';

const EDGE_LABELS = {
  causes: { color: '#FF3B30', dash: '' },
  escalates: { color: '#FF8A00', dash: '' },
  affects: { color: '#F59E0B', dash: '5,3' },
  responds_to: { color: '#3B82F6', dash: '5,3' },
  linked_to: { color: '#94A3B8', dash: '3,3' },
};

export default function EventGraph({ isOpen, onClose, allEvents = [] }) {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [scale, setScale] = useState(1);
  const simulationRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

  // Build a simple relationship graph from the loaded events (demo)
  const buildGraph = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      if (!allEvents.length) { setLoading(false); return; }

      const nodes = allEvents.slice(0, 20).map(e => ({
        id: e.id,
        label: e.title.substring(0, 40),
        category: e.category,
        country: e.country,
        intensity: e.severity || 3,
      }));

      // Build edges between events that share the same country
      const edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].country === nodes[j].country) {
            edges.push({
              source: nodes[i].id,
              target: nodes[j].id,
              label: 'linked_to',
              strength: 1,
            });
          }
        }
      }

      setGraphData({ nodes, edges });
      setLoading(false);
    }, 500);
  }, [allEvents]);

  useEffect(() => {
    if (isOpen && !graphData) buildGraph();
  }, [isOpen, graphData, buildGraph]);

  useEffect(() => {
    if (!graphData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const nodes = graphData.nodes.map(n => ({ ...n, x: Math.random() * width / 2, y: Math.random() * height / 2 }));
    const edges = graphData.edges.map(e => ({ ...e }));
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const simulation = d3Force.forceSimulation(nodes)
      .force('charge', d3Force.forceManyBody().strength(-200))
      .force('center', d3Force.forceCenter(width / 4, height / 4))
      .force('link', d3Force.forceLink(edges).id(d => d.id).distance(120).strength(0.5))
      .force('collision', d3Force.forceCollide().radius(30))
      .on('tick', () => draw(ctx, nodes, edges, width / 2, height / 2));

    simulationRef.current = simulation;
    return () => simulation.stop();
  }, [graphData, scale]);

  const draw = (ctx, nodes, edges, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Draw edges
    edges.forEach(e => {
      const source = typeof e.source === 'object' ? e.source : nodes.find(n => n.id === e.source);
      const target = typeof e.target === 'object' ? e.target : nodes.find(n => n.id === e.target);
      if (!source || !target) return;

      const edgeStyle = EDGE_LABELS[e.label] || EDGE_LABELS.linked_to;
      ctx.beginPath();
      ctx.strokeStyle = edgeStyle.color + '60';
      ctx.lineWidth = (e.strength || 1) * 0.8;
      if (edgeStyle.dash) ctx.setLineDash(edgeStyle.dash.split(',').map(Number));
      else ctx.setLineDash([]);
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Edge label
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.font = '8px "JetBrains Mono"';
      ctx.fillStyle = edgeStyle.color + '80';
      ctx.textAlign = 'center';
      ctx.fillText(e.label || '', mx, my - 3);
    });

    ctx.setLineDash([]);

    // Draw nodes
    nodes.forEach(n => {
      const color = CATEGORY_COLORS[n.category] || '#3B82F6';
      const r = 12 + (n.intensity || 5) * 0.8;
      const isHovered = hoveredNode && hoveredNode.id === n.id;

      // Glow
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = color + '15';
      ctx.fill();

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + (isHovered ? 'ff' : 'cc');
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.font = '9px "IBM Plex Sans"';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      const label = (n.label || '').substring(0, 25);
      ctx.fillText(label, n.x, n.y + r + 14);

      // Country tag
      if (n.country) {
        ctx.font = '7px "JetBrains Mono"';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(n.country, n.x, n.y + r + 24);
      }
    });

    ctx.restore();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-8 z-50 glass-panel rounded-xl overflow-hidden flex flex-col"
          data-testid="event-graph-panel"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-[var(--cat-political)]" />
              <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Chivo' }}>Event Relationship Graph</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[var(--cat-political)]/20 text-[var(--cat-political)]">Demo</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setScale(s => Math.min(s + 0.2, 2))} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => { setGraphData(null); buildGraph(); }} className="text-xs font-mono text-[var(--cat-political)] px-3 py-1.5 glass-light rounded-md hover:bg-[var(--bg-elevated)]" data-testid="graph-refresh-btn">
                Regenerate
              </button>
              <button onClick={onClose} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]" data-testid="graph-close-btn">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="px-6 py-2 border-b border-[var(--border-default)] flex items-center gap-4 flex-shrink-0">
            {Object.entries(EDGE_LABELS).map(([label, style]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{ backgroundColor: style.color }} />
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">{label}</span>
              </div>
            ))}
          </div>

          {/* Graph Canvas */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--cat-political)] mx-auto" />
                  <p className="text-sm text-[var(--text-secondary)] font-mono">Building event relationships...</p>
                </div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
                data-testid="graph-canvas"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

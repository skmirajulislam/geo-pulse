import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, GitBranch, ZoomIn, ZoomOut, Move } from 'lucide-react';
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function EventGraph({ isOpen, onClose, allEvents = [] }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const simulationRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const pointerRef = useRef({ isDown: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const buildGraph = useCallback(() => {
    setLoading(true);
    setSelectedNode(null);

    setTimeout(() => {
      if (!allEvents.length) {
        setGraphData({ nodes: [], edges: [] });
        setLoading(false);
        return;
      }

      const nodes = allEvents.slice(0, 45).map((event) => ({
        id: event.id,
        label: event.title?.substring(0, 46) || 'Untitled event',
        title: event.title || 'Untitled event',
        description: event.description || 'No description available.',
        category: event.category,
        country: event.country,
        intensity: event.severity || event.intensity || 3,
        timestamp: event.timestamp,
        source: event.sources?.[0]?.name || 'Unknown source',
        sourceRegion: event.sources?.[0]?.region || 'Global',
        url: event.sources?.[0]?.url,
      }));

      const edges = [];
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const sameCountry = nodes[i].country && nodes[i].country === nodes[j].country;
          const sameRegion = nodes[i].sourceRegion && nodes[i].sourceRegion === nodes[j].sourceRegion;
          const sameCategory = nodes[i].category && nodes[i].category === nodes[j].category;
          if (!sameCountry && !sameRegion && !sameCategory) continue;

          edges.push({
            source: nodes[i].id,
            target: nodes[j].id,
            label: sameCountry ? 'linked_to' : sameCategory ? 'affects' : 'responds_to',
            strength: sameCountry ? 1 : 0.65,
          });
        }
      }

      setGraphData({ nodes, edges: edges.slice(0, 90) });
      setLoading(false);
    }, 300);
  }, [allEvents]);

  useEffect(() => {
    if (isOpen && !graphData) buildGraph();
  }, [isOpen, graphData, buildGraph]);

  const toGraphPoint = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const current = transformRef.current;
    return {
      x: (clientX - rect.left - current.x) / current.k,
      y: (clientY - rect.top - current.y) / current.k,
    };
  }, []);

  const findNodeAt = useCallback((clientX, clientY) => {
    const point = toGraphPoint(clientX, clientY);
    for (let i = nodesRef.current.length - 1; i >= 0; i -= 1) {
      const node = nodesRef.current[i];
      const radius = 12 + (node.intensity || 5) * 0.8;
      const distance = Math.hypot(point.x - node.x, point.y - node.y);
      if (distance <= radius + 8) return node;
    }
    return null;
  }, [toGraphPoint]);

  const draw = useCallback((ctx, nodes, edges, width, height) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    const current = transformRef.current;
    ctx.translate(current.x, current.y);
    ctx.scale(current.k, current.k);

    edges.forEach((edge) => {
      const source = typeof edge.source === 'object' ? edge.source : nodes.find((node) => node.id === edge.source);
      const target = typeof edge.target === 'object' ? edge.target : nodes.find((node) => node.id === edge.target);
      if (!source || !target) return;

      const edgeStyle = EDGE_LABELS[edge.label] || EDGE_LABELS.linked_to;
      ctx.beginPath();
      ctx.strokeStyle = `${edgeStyle.color}60`;
      ctx.lineWidth = (edge.strength || 1) * 0.8;
      ctx.setLineDash(edgeStyle.dash ? edgeStyle.dash.split(',').map(Number) : []);
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      ctx.font = '8px "JetBrains Mono"';
      ctx.fillStyle = `${edgeStyle.color}85`;
      ctx.textAlign = 'center';
      ctx.fillText(edge.label || '', midX, midY - 3);
    });

    ctx.setLineDash([]);

    nodes.forEach((node) => {
      const color = CATEGORY_COLORS[node.category] || '#3B82F6';
      const radius = 12 + (node.intensity || 5) * 0.8;
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + (isSelected ? 11 : 6), 0, Math.PI * 2);
      ctx.fillStyle = color + (isSelected ? '35' : '15');
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color + (isHovered || isSelected ? 'ff' : 'cc');
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FDE68A' : color;
      ctx.lineWidth = isSelected ? 2.4 : 1.5;
      ctx.stroke();

      ctx.font = '9px "IBM Plex Sans"';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText((node.label || '').substring(0, 28), node.x, node.y + radius + 14);

      ctx.font = '7px "JetBrains Mono"';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(node.country || node.sourceRegion || 'Global', node.x, node.y + radius + 24);
    });

    ctx.restore();
  }, [hoveredNode, selectedNode]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    draw(ctx, nodesRef.current, edgesRef.current, canvas.width, canvas.height);
  }, [draw]);

  useEffect(() => {
    transformRef.current = transform;
    redraw();
  }, [transform, redraw]);

  useEffect(() => {
    if (!graphData || !canvasRef.current || !wrapperRef.current) return;

    const canvas = canvasRef.current;
    const rect = wrapperRef.current.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const width = rect.width;
    const height = rect.height;
    const nodes = graphData.nodes.map((node, index) => ({
      ...node,
      x: width / 2 + Math.cos(index) * Math.min(width, height) * 0.18 + (Math.random() - 0.5) * 80,
      y: height / 2 + Math.sin(index) * Math.min(width, height) * 0.18 + (Math.random() - 0.5) * 80,
    }));
    const edges = graphData.edges.map((edge) => ({ ...edge }));
    nodesRef.current = nodes;
    edgesRef.current = edges;
    transformRef.current = { x: 0, y: 0, k: 1 };
    setTransform({ x: 0, y: 0, k: 1 });

    const ctx = canvas.getContext('2d');
    const simulation = d3Force.forceSimulation(nodes)
      .force('charge', d3Force.forceManyBody().strength(-280))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('link', d3Force.forceLink(edges).id((node) => node.id).distance(145).strength(0.45))
      .force('collision', d3Force.forceCollide().radius(42))
      .on('tick', () => draw(ctx, nodes, edges, width, height));

    simulationRef.current = simulation;
    return () => simulation.stop();
  }, [graphData, draw]);

  const zoomBy = useCallback((delta) => {
    setTransform((current) => ({ ...current, k: clamp(current.k + delta, 0.35, 3) }));
  }, []);

  const handlePointerDown = useCallback((event) => {
    pointerRef.current = {
      isDown: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
  }, []);

  const handlePointerMove = useCallback((event) => {
    const hitNode = findNodeAt(event.clientX, event.clientY);
    setHoveredNode(hitNode);

    if (!pointerRef.current.isDown) return;
    const deltaX = event.clientX - pointerRef.current.startX;
    const deltaY = event.clientY - pointerRef.current.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) pointerRef.current.moved = true;
    setTransform((current) => ({
      ...current,
      x: pointerRef.current.originX + deltaX,
      y: pointerRef.current.originY + deltaY,
    }));
  }, [findNodeAt]);

  const handlePointerUp = useCallback((event) => {
    const wasDrag = pointerRef.current.moved;
    pointerRef.current.isDown = false;
    if (!wasDrag) setSelectedNode(findNodeAt(event.clientX, event.clientY));
  }, [findNodeAt]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const point = toGraphPoint(event.clientX, event.clientY);
    const nextScale = clamp(transformRef.current.k * (event.deltaY > 0 ? 0.9 : 1.1), 0.35, 3);
    setTransform({
      x: event.clientX - canvasRef.current.getBoundingClientRect().left - point.x * nextScale,
      y: event.clientY - canvasRef.current.getBoundingClientRect().top - point.y * nextScale,
      k: nextScale,
    });
  }, [toGraphPoint]);

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
          <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-[var(--cat-political)]" />
              <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Chivo' }}>Event Relationship Graph</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[var(--cat-political)]/20 text-[var(--cat-political)]">Live</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                <Move className="w-3 h-3" /> drag to pan, wheel to zoom, tap node for details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => zoomBy(0.2)} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => zoomBy(-0.2)} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => setTransform({ x: 0, y: 0, k: 1 })} className="text-xs font-mono text-[var(--cat-political)] px-3 py-1.5 glass-light rounded-md hover:bg-[var(--bg-elevated)]">
                Reset View
              </button>
              <button onClick={() => { setGraphData(null); buildGraph(); }} className="text-xs font-mono text-[var(--cat-political)] px-3 py-1.5 glass-light rounded-md hover:bg-[var(--bg-elevated)]" data-testid="graph-refresh-btn">
                Regenerate
              </button>
              <button onClick={onClose} className="p-2 glass-light rounded-md hover:bg-[var(--bg-elevated)]" data-testid="graph-close-btn">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-2 border-b border-[var(--border-default)] flex items-center gap-4 flex-shrink-0">
            {Object.entries(EDGE_LABELS).map(([label, style]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{ backgroundColor: style.color }} />
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">{label}</span>
              </div>
            ))}
          </div>

          <div ref={wrapperRef} className="flex-1 relative overflow-hidden">
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
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  pointerRef.current.isDown = false;
                  setHoveredNode(null);
                }}
                onWheel={handleWheel}
                data-testid="graph-canvas"
              />
            )}

            {selectedNode && (
              <div className="eg-node-card glass-panel">
                <div className="eg-node-card__eyebrow">{selectedNode.category || 'Event'} • {selectedNode.country || selectedNode.sourceRegion}</div>
                <div className="eg-node-card__title">{selectedNode.title}</div>
                <p className="eg-node-card__desc">{selectedNode.description}</p>
                <div className="eg-node-card__meta">
                  <span>{selectedNode.source}</span>
                  <span>{selectedNode.sourceRegion}</span>
                </div>
                {selectedNode.url && (
                  <a href={selectedNode.url} target="_blank" rel="noreferrer" className="eg-node-card__link">
                    Open source
                  </a>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

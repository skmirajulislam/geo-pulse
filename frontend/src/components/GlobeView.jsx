import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/GlobeView.css';

export default function GlobeView({
  events,
  weatherMarkers = [],
  naturalEventMarkers = [],
  cablesLayerEnabled = false,
  pipelinesLayerEnabled = false,
  dataCentersLayerEnabled = false,
  shipsLayerEnabled = false,
  iaeaDiifLayerEnabled = false,
  shipData = [],
  onEventClick,
  selectedEvent,
}) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Keep Globe sized to its container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [isHovered, setIsHovered] = useState(false);
  const [cablesGeo, setCablesGeo] = useState(null);
  const [pipelinesGeo, setPipelinesGeo] = useState(null);
  const [dataCentersGeo, setDataCentersGeo] = useState(null);
  const [iaeaDiifData, setIaeaDiifData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadGeo = async (url, setter, label) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setter(data);
      } catch (err) {
        console.error(`Failed to fetch ${label}:`, err);
      }
    };

    loadGeo('/data/cables.geojson', setCablesGeo, 'Submarine Cables');
    loadGeo('/data/pipelines.geojson', setPipelinesGeo, 'Pipelines');
    loadGeo('/data/datacenters.geojson', setDataCentersGeo, 'Data Centers');
    loadGeo('/data/gamma-irradiators.json', setIaeaDiifData, 'IAEA DIIF Facilities');

    return () => { cancelled = true; };
  }, []);

  // Manage auto-rotate state declaratively based on user interactions
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = !selectedEvent && !isHovered;
      }
    }
  }, [selectedEvent, isHovered]);

  // Initial camera + basic rotate speed setup
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.3;
      globeRef.current.pointOfView({ altitude: 2.5 }, 0);
    }
  }, []);

  // Zoom explicitly to selected event
  useEffect(() => {
    if (
      selectedEvent &&
      selectedEvent.location &&
      typeof selectedEvent.location.lat === 'number' &&
      globeRef.current
    ) {
      globeRef.current.pointOfView({
        lat: selectedEvent.location.lat,
        lng: selectedEvent.location.lng,
        altitude: 0.8,
      }, 1000);
    }
  }, [selectedEvent]);

  const pointsData = useMemo(() => {
    const eventPoints = events
      .filter(e => e.location && typeof e.location.lat === 'number' && typeof e.location.lng === 'number')
      .map((e, idx) => {
        const hash = e.id ? e.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : idx;
        const isDefault = e.location.lat === 0 && e.location.lng === 0;
        const spread = isDefault ? 12.0 : 1.2;
        const offsetLat = (((hash * 7) % 100) / 100 - 0.5) * spread;
        const offsetLng = (((hash * 13) % 100) / 100 - 0.5) * spread;
        return {
          lat: e.location.lat + offsetLat,
          lng: e.location.lng + offsetLng,
          size: Math.max(0.15, (e.intensity || 5) * 0.06),
          color: CATEGORY_COLORS[e.category] || '#3B82F6',
          label: e.title,
          kind: 'event',
          payload: e,
        };
      });

    const weatherPoints = weatherMarkers
      .filter(m => typeof m.latitude === 'number' && typeof m.longitude === 'number')
      .map(m => ({
        lat: m.latitude,
        lng: m.longitude,
        size: 0.25,
        color: '#14B8A6',
        label: `${m.name}, ${m.country}`,
        kind: 'weather',
        payload: m,
      }));

    const naturalPoints = (naturalEventMarkers || [])
      .filter(e => Array.isArray(e.coords) && e.coords.length === 2 && typeof e.coords[0] === 'number' && typeof e.coords[1] === 'number')
      .map(e => {
        const type = String(e.type || '').toLowerCase();
        const color =
          type === 'earthquake' ? '#F97316' :
          type === 'storm' ? '#6366F1' :
          type === 'wildfire' ? '#EF4444' :
          type === 'volcano' ? '#DC2626' :
          type === 'flood' ? '#3B82F6' :
          type === 'blizzard' ? '#93C5FD' :
          type === 'drought' ? '#F59E0B' :
          type === 'tsunami' ? '#0EA5E9' :
          '#14B8A6';
        return {
          lat: e.coords[0],
          lng: e.coords[1],
          size: 0.2,
          color,
          label: e.title || 'Natural Event',
          kind: 'natural',
          payload: e,
        };
      });

    const toFeaturePoints = (geo, kind, color) => {
      if (!geo?.features) return [];
      const pointSize = kind === 'datacenter' ? 0.24 : 0.16;
      return geo.features.flatMap((f, idx) => {
        const g = f?.geometry;
        const name = f?.properties?.name || kind;
        if (g?.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
          const [lng, lat] = g.coordinates;
          if (typeof lat === 'number' && typeof lng === 'number') {
            return [{
              lat,
              lng,
              size: pointSize,
              color,
              label: name,
              kind,
              payload: { ...f.properties, geometryType: 'Point', idx },
            }];
          }
        }
        if (g?.type === 'MultiPoint' && Array.isArray(g.coordinates)) {
          return g.coordinates
            .filter((coord) => Array.isArray(coord) && coord.length >= 2)
            .map((coord, pIdx) => {
              const [lng, lat] = coord;
                return {
                  lat,
                  lng,
                  size: pointSize,
                  color,
                  label: name,
                  kind,
                  payload: { ...f.properties, geometryType: 'MultiPoint', idx: `${idx}-${pIdx}` },
                };
            });
        }
        return [];
      });
    };

    const infraPoints = [
      ...(cablesLayerEnabled ? toFeaturePoints(cablesGeo, 'cable', '#00E5FF') : []),
      ...(pipelinesLayerEnabled ? toFeaturePoints(pipelinesGeo, 'pipeline', '#FF6B00') : []),
      ...(dataCentersLayerEnabled ? toFeaturePoints(dataCentersGeo, 'datacenter', '#00FFB2') : []),
    ];

    const iaeaDiifPoints = iaeaDiifLayerEnabled
      ? (iaeaDiifData?.facilities || [])
        .filter((facility) =>
          typeof facility.lat === 'number' &&
          typeof facility.lon === 'number' &&
          Number.isFinite(facility.lat) &&
          Number.isFinite(facility.lon)
        )
        .map((facility) => ({
          lat: facility.lat,
          lng: facility.lon,
          size: 0.22,
          color: '#A78BFA',
          label: facility.city,
          kind: 'iaea-diif',
          payload: facility,
        }))
      : [];

    return [...eventPoints, ...weatherPoints, ...naturalPoints, ...infraPoints, ...iaeaDiifPoints];
  }, [
    events,
    weatherMarkers,
    naturalEventMarkers,
    cablesLayerEnabled,
    pipelinesLayerEnabled,
    dataCentersLayerEnabled,
    iaeaDiifLayerEnabled,
    cablesGeo,
    pipelinesGeo,
    dataCentersGeo,
    iaeaDiifData,
  ]);

  const shipMarkersData = useMemo(() => {
    if (!shipsLayerEnabled) return [];
    return shipData
      .filter(s => s.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number')
      .map(s => ({
        lat: s.location.lat,
        lng: s.location.lng,
        text: 'S',
        size: 1.2,
        color: (s.type || '').toLowerCase() === 'tanker' ? '#F59E0B' : '#60A5FA',
        payload: s,
      }));
  }, [shipsLayerEnabled, shipData]);

  const pathsData = useMemo(() => {
    const toFeaturePaths = (geo, kind, color, altitude) => {
      if (!geo?.features) return [];
      return geo.features.flatMap((f) => {
        const g = f?.geometry;
        const name = f?.properties?.name || kind;
        if (g?.type === 'LineString' && Array.isArray(g.coordinates)) {
          const points = g.coordinates
            .filter((coord) => Array.isArray(coord) && coord.length >= 2)
            .map(([lng, lat]) => ({ lat, lng }));
          if (points.length >= 2) return [{ points, kind, color, altitude, label: name }];
        }
        if (g?.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
          return g.coordinates
            .map((line) => line
              .filter((coord) => Array.isArray(coord) && coord.length >= 2)
              .map(([lng, lat]) => ({ lat, lng })))
            .filter((line) => line.length >= 2)
            .map((points) => ({ points, kind, color, altitude, label: name }));
        }
        return [];
      });
    };

    const toDataCenterMesh = (geo) => {
      if (!geo?.features) return [];
      const points = geo.features.flatMap((f, idx) => {
        const g = f?.geometry;
        const name = f?.properties?.name || `Data Center ${idx + 1}`;
        if (g?.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
          const [lng, lat] = g.coordinates;
          if (typeof lat === 'number' && typeof lng === 'number') return [{ lat, lng, name }];
        }
        if (g?.type === 'MultiPoint' && Array.isArray(g.coordinates)) {
          return g.coordinates
            .filter((coord) => Array.isArray(coord) && coord.length >= 2)
            .map(([lng, lat], pIdx) => ({ lat, lng, name: `${name} ${pIdx + 1}` }));
        }
        return [];
      });

      const links = [];
      const maxLinks = 400;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          links.push({
            points: [points[i], points[j]],
            kind: 'datacenter-link',
            color: '#00FFB2',
            altitude: 0.014,
            label: `${points[i].name} ↔ ${points[j].name}`,
          });
          if (links.length >= maxLinks) return links;
        }
      }
      return links;
    };

    return [
      ...(cablesLayerEnabled ? toFeaturePaths(cablesGeo, 'cable', '#00E5FF', 0.015) : []),
      ...(pipelinesLayerEnabled ? toFeaturePaths(pipelinesGeo, 'pipeline', '#FF6B00', 0.012) : []),
      ...(dataCentersLayerEnabled ? toFeaturePaths(dataCentersGeo, 'datacenter', '#00FFB2', 0.01) : []),
      ...(dataCentersLayerEnabled ? toDataCenterMesh(dataCentersGeo) : []),
    ];
  }, [cablesLayerEnabled, pipelinesLayerEnabled, dataCentersLayerEnabled, cablesGeo, pipelinesGeo, dataCentersGeo]);

  const ringsData = useMemo(() => events
    .filter(e => e.location && typeof e.location.lat === 'number' && typeof e.location.lng === 'number' && (e.intensity || 0) >= 4)
    .map(e => ({
      lat: e.location.lat,
      lng: e.location.lng,
      maxR: 3,
      propagationSpeed: 2,
      repeatPeriod: 1200,
      color: () => CATEGORY_COLORS[e.category] || '#3B82F6',
    })), [events]);

  const handlePointClick = useCallback((point) => {
    if (point?.kind === 'event' && point.payload && onEventClick) onEventClick(point.payload);
  }, [onEventClick]);

  const handlePointHover = useCallback((point) => { setIsHovered(!!point); }, []);
  const handleLabelHover = useCallback((label) => { setIsHovered(!!label); }, []);

  return (
    <div ref={containerRef} data-testid="globe-container" className="globe-container">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl=""
        backgroundColor="#0A0B0E"
        atmosphereColor="#3B82F6"
        atmosphereAltitude={0.15}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude="size"
        pointRadius={0.4}
        pointsMerge={false}
        onPointClick={handlePointClick}
        onPointHover={handlePointHover}
        pointLabel={(d) => `
          <div style="background:rgba(10,11,14,0.95);backdrop-filter:blur(12px);color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;max-width:380px;word-wrap:break-word;white-space:normal;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${d.color};margin-bottom:4px;">
              ${d.kind === 'weather'
                ? 'Weather'
                : d.kind === 'natural'
                  ? (d.payload.type || 'Natural Event')
                : d.kind === 'ship'
                  ? (d.payload.type || 'Vessel')
                  : d.kind === 'cable'
                    ? 'Submarine Cable'
                    : d.kind === 'pipeline'
                      ? 'Pipeline'
                      : d.kind === 'datacenter'
                        ? 'Data Center'
                        : d.kind === 'iaea-diif'
                          ? 'IAEA DIIF'
                        : d.payload.category}
            </div>
            <div style="font-size:12px;font-weight:500;line-height:1.4;">${d.label}</div>
            <div style="font-size:10px;color:#94A3B8;margin-top:6px;">
              ${d.kind === 'weather'
                ? `Temp ${d.payload.current?.temperature_2m ?? "N/A"}°C • Wind ${d.payload.current?.wind_speed_10m ?? "N/A"} km/h`
                : d.kind === 'natural'
                  ? `${d.payload.country || 'Global'}${d.payload.sources?.[0]?.name ? ` • ${d.payload.sources[0].name}` : ''}`
                : d.kind === 'ship'
                  ? `Speed ${d.payload.speed || 0} kn • Heading ${d.payload.heading || 0}°${d.payload.destination ? ` • Dest ${d.payload.destination}` : ''}`
                  : d.kind === 'cable'
                    ? 'Submarine cable node'
                  : d.kind === 'pipeline'
                    ? 'Pipeline node'
                    : d.kind === 'datacenter'
                        ? 'Data center'
                    : d.kind === 'iaea-diif'
                      ? `Gamma irradiator facility • ${d.payload.country || 'Unknown country'}`
                  : d.payload.country}
            </div>
          </div>
        `}
        pathsData={pathsData}
        pathPoints="points"
        pathPointLat="lat"
        pathPointLng="lng"
        pathColor="color"
        pathStroke={0.9}
        pathAltitude="altitude"
        pathDashLength={0.25}
        pathDashGap={0.12}
        pathDashAnimateTime={3000}
        pathLabel={(d) => `
          <div style="background:rgba(10,11,14,0.95);color:#fff;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:${d.color};margin-bottom:3px;">
              ${d.kind === 'cable'
                ? 'Submarine Cable'
                : d.kind === 'pipeline'
                  ? 'Pipeline'
                  : d.kind === 'datacenter-link'
                    ? 'Data Center Mesh'
                    : 'Infrastructure'}
            </div>
            <div style="font-size:12px;line-height:1.35;">${d.label}</div>
          </div>
        `}
        labelsData={shipMarkersData}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize="size"
        labelColor="color"
        labelDotRadius={0}
        labelAltitude={0.02}
        onLabelHover={handleLabelHover}
        labelLabel={(d) => `
          <div style="background:rgba(10,11,14,0.95);backdrop-filter:blur(12px);color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;max-width:380px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${d.color};margin-bottom:4px;">
              ${d.payload?.type || 'Vessel'}
            </div>
            <div style="font-size:12px;font-weight:500;line-height:1.4;">${d.payload?.name || 'Unknown Vessel'}</div>
            <div style="font-size:10px;color:#94A3B8;margin-top:6px;">
              Speed ${d.payload?.speed || 0} kn • Heading ${d.payload?.heading || 0}°${d.payload?.destination ? ` • Dest ${d.payload.destination}` : ''}
            </div>
          </div>
        `}
        ringsData={ringsData}
        ringColor="color"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />
    </div>
  );
}

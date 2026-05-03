import React, { useState, useEffect, useMemo } from 'react';
import { GeoJSON, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Normalizes country names so they have a better chance of matching GeoJSON properties.ADMIN
 */
function normalizeCountryName(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  // Simple overrides if needed (e.g. US -> United States of America)
  if (lower === 'usa' || lower === 'united states') return 'united states of America';
  if (lower === 'uk' || lower === 'united kingdom') return 'united kingdom';
  if (lower === 'russia') return 'russia'; // GeoJSON might use Russia
  return lower;
}

export default function ZoneOverlays({ events }) {
  const [geoData, setGeoData] = useState(null);
  const map = useMap();

  useEffect(() => {
    fetch('/countries.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error('Failed to load GeoJSON:', err));
  }, []);

  // Compute maximum severity per country for relevant categories
  const { conflictMap, conflictLocals, healthMap, healthLocals } = useMemo(() => {
    const cMap = new Map();
    const hMap = new Map();
    if (!events) return { conflictMap: cMap, conflictLocals: [], healthMap: hMap, healthLocals: [] };

    events.forEach(evt => {
      const country = normalizeCountryName(evt.country);
      if (!country) return;

      if (evt.category === 'Armed Conflict' || evt.category === 'Terrorism & Security') {
        const currentData = cMap.get(country) || { count: 0, maxSeverity: 0, events: [] };
        currentData.count += 1;
        const severity = evt.intensity || 1;
        if (severity > currentData.maxSeverity) currentData.maxSeverity = severity;
        if (evt.location) currentData.events.push(evt);
        cMap.set(country, currentData);
      }
      else if (evt.category === 'Health & Disaster') {
        const currentData = hMap.get(country) || { count: 0, maxSeverity: 0, events: [] };
        currentData.count += 1;
        const severity = evt.intensity || 1;
        if (severity > currentData.maxSeverity) currentData.maxSeverity = severity;
        if (evt.location) currentData.events.push(evt);
        hMap.set(country, currentData);
      }
    });

    const cLocals = [];
    cMap.forEach((data, country) => {
      if (data.count <= 3) data.events.forEach(evt => cLocals.push(evt));
    });

    const hLocals = [];
    hMap.forEach((data, country) => {
      if (data.count <= 1) data.events.forEach(evt => hLocals.push(evt));
    });

    return { conflictMap: cMap, conflictLocals: cLocals, healthMap: hMap, healthLocals: hLocals };
  }, [events]);

  const geoJsonStyle = (feature) => {
    const adminName = normalizeCountryName(feature.properties.ADMIN);
    const formalName = normalizeCountryName(feature.properties.FORMAL_EN);
    const sovName = normalizeCountryName(feature.properties.SOVEREIGNT);

    const cData = conflictMap.get(adminName) || conflictMap.get(formalName) || conflictMap.get(sovName);
    const hData = healthMap.get(adminName) || healthMap.get(formalName) || healthMap.get(sovName);

    if (cData && cData.count > 3) {
      const severity = cData.maxSeverity;
      let color = '#FCD34D'; // Yellow for low severity (1-2)
      if (severity >= 4) color = '#FF3B30'; // Red for high severity (4-5)
      else if (severity === 3) color = '#F59E0B'; // Orange for medium severity

      return {
        fillColor: color,
        color: color,
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.15,
        className: 'glowing-zone'
      };
    }

    if (hData && hData.count >= 2) {
      return {
        fillColor: 'url(#health-stripes)',
        color: '#FCD34D',
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.5,
        className: 'glowing-zone'
      };
    }

    return { fillOpacity: 0, weight: 0, opacity: 0 };
  };

  // Re-render when geoData or events change
  if (!geoData) return null;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <pattern id="health-stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#FCD34D" strokeWidth="3" opacity="0.6" />
          </pattern>
        </defs>
      </svg>
      <GeoJSON
        key={`zones-${events.length}`}
        data={geoData}
        style={geoJsonStyle}
      />
      {conflictLocals.map(evt => {
        const severity = evt.intensity || 1;
        let color = '#f8f40fff';
        if (severity >= 4) color = '#e90c0cff';
        else if (severity === 3) color = '#ec650aff';
        
        // Scale radius based on severity (e.g., 15km to 75km radius)
        const radius = severity * 15000;

        const hash = evt.id ? evt.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
        const isDefault = evt.location.lat === 0 && evt.location.lng === 0;
        const spread = isDefault ? 12.0 : 1.2;
        const offsetLat = (((hash * 7) % 100) / 100 - 0.5) * spread;
        const offsetLng = (((hash * 13) % 100) / 100 - 0.5) * spread;

        return (
          <Circle
            key={`zone-c-${evt.id}`}
            center={[evt.location.lat + offsetLat, evt.location.lng + offsetLng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              color: color,
              weight: 1.5,
              opacity: 0.8,
              fillOpacity: 0.15,
              className: 'glowing-zone'
            }}
          />
        );
      })}
      {healthLocals.map(evt => {
        const severity = evt.intensity || 1;
        const radius = severity * 15000;

        const hash = evt.id ? evt.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
        const isDefault = evt.location.lat === 0 && evt.location.lng === 0;
        const spread = isDefault ? 12.0 : 1.2;
        const offsetLat = (((hash * 7) % 100) / 100 - 0.5) * spread;
        const offsetLng = (((hash * 13) % 100) / 100 - 0.5) * spread;

        return (
          <Circle
            key={`zone-h-${evt.id}`}
            center={[evt.location.lat + offsetLat, evt.location.lng + offsetLng]}
            radius={radius}
            pathOptions={{
              fillColor: 'url(#health-stripes)',
              color: '#f81a94ff',
              weight: 1.5,
              opacity: 0.8,
              fillOpacity: 0.5,
              className: 'glowing-zone'
            }}
          />
        );
      })}
    </>
  );
}

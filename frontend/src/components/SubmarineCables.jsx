import React, { useState, useEffect } from 'react';
import { GeoJSON, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';

export default function SubmarineCables() {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/cables.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setGeoData(data))
      .catch(err => console.error('Failed to fetch Submarine Cables:', err));
  }, []);

  if (!geoData) return null;

  const cableIcon = L.divIcon({
    className: 'cable-icon',
    html: `<div style="font-size: 18px; filter: drop-shadow(0 0 6px #00E5FF);">🌊</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const meshLines = [];
  if (geoData?.features) {
    const midpoints = geoData.features.map(f => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length === 0) return null;
      const mid = coords[Math.floor(coords.length / 2)];
      return [mid[1], mid[0]];
    }).filter(Boolean);

    for (let i = 0; i < midpoints.length; i++) {
      for (let j = i + 1; j < midpoints.length; j++) {
        meshLines.push(
          <Polyline 
            key={`mesh-${i}-${j}`} 
            positions={[midpoints[i], midpoints[j]]} 
            pathOptions={{ color: '#00E5FF', weight: 1, opacity: 0.2, dashArray: '4, 8' }} 
          />
        );
      }
    }
  }

  return (
    <>
      {meshLines}
      <GeoJSON
        data={geoData}
        style={{
          color: '#00E5FF',
          weight: 2,
          opacity: 0.6,
          dashArray: '5, 8',
          className: 'submarine-cables-layer'
        }}
      />
      {geoData.features?.map((feature, i) => {
        if (feature.geometry?.type === 'LineString') {
          const coords = feature.geometry.coordinates;
          if (!coords || coords.length === 0) return null;
          const mid = coords[Math.floor(coords.length / 2)];
          return <Marker key={`cable-${i}`} position={[mid[1], mid[0]]} icon={cableIcon} />;
        }
        return null;
      })}
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { GeoJSON, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import osmtogeojson from 'osmtogeojson';

export default function Pipelines() {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/pipelines.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setGeoData(data);
      })
      .catch(err => console.error('Failed to fetch Pipelines:', err));
  }, []);

  if (!geoData) return null;

  const pipelineIcon = L.divIcon({
    className: 'pipeline-icon',
    html: `<div style="font-size: 18px; filter: drop-shadow(0 0 6px #FF6B00);">🛢️</div>`,
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
            pathOptions={{ color: '#FF6B00', weight: 1, opacity: 0.2, dashArray: '4, 8' }} 
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
          color: '#FF6B00',
          weight: 1.5,
          opacity: 0.7,
          dashArray: '4, 6',
          className: 'pipelines-layer'
        }}
      />
      {geoData.features?.map((feature, i) => {
        if (feature.geometry?.type === 'LineString') {
          const coords = feature.geometry.coordinates;
          if (!coords || coords.length === 0) return null;
          const mid = coords[Math.floor(coords.length / 2)];
          return <Marker key={`pipe-${i}`} position={[mid[1], mid[0]]} icon={pipelineIcon} />;
        }
        return null;
      })}
    </>
  );
}

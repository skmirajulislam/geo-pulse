import React, { useState, useEffect } from 'react';
import { GeoJSON, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';

export default function DataCenters() {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/datacenters.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setGeoData(data);
      })
      .catch(err => console.error('Failed to fetch Data Centers:', err));
  }, []);

  if (!geoData) return null;

  const meshLines = [];
  if (geoData?.features) {
    const coords = geoData.features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        meshLines.push(
          <Polyline 
            key={`mesh-${i}-${j}`} 
            positions={[coords[i], coords[j]]} 
            pathOptions={{ color: '#00FFB2', weight: 1, opacity: 0.3, dashArray: '4, 6' }} 
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
        pointToLayer={(feature, latlng) => {
          const icon = L.divIcon({
            className: 'datacenter-icon',
            html: `<div style="font-size: 18px; filter: drop-shadow(0 0 6px #00FFB2);">🏢</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        }}
      />
    </>
  );
}

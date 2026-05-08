import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Create a custom icon for ships
const createShipIcon = (type, heading) => {
  const color = type.toLowerCase() === 'tanker' ? '#F59E0B' : '#3B82F6';
  
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14.5l8-10 8 10-2 6H6z" opacity="0.9" />
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const shipLayerRef = { current: null };

export default function ShipMarkers({ ships = [] }) {
  const map = useMap();

  useEffect(() => {
    if (shipLayerRef.current) map.removeLayer(shipLayerRef.current);
    
    const layerGroup = L.layerGroup();

    ships.forEach(ship => {
      if (!ship.location || typeof ship.location.lat !== 'number' || typeof ship.location.lng !== 'number') return;

      const icon = createShipIcon(ship.type, ship.heading);
      const marker = L.marker([ship.location.lat, ship.location.lng], { icon });

      marker.bindTooltip(
        `<div style="background:#101217;color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#3B82F6;margin-bottom:4px;">${ship.type || 'Vessel'}</div>
          <div style="font-size:12px;font-weight:500;">${ship.name || 'Unknown Vessel'}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:6px;">
            Speed: ${ship.speed || 0} knots • Heading: ${ship.heading || 0}°
          </div>
          ${ship.destination ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;">Dest: ${ship.destination}</div>` : ''}
        </div>`,
        { direction: 'top', offset: [0, -12], className: 'custom-tooltip', opacity: 1 }
      );
      
      layerGroup.addLayer(marker);
    });

    layerGroup.addTo(map);
    shipLayerRef.current = layerGroup;

    return () => { 
      if (shipLayerRef.current) map.removeLayer(shipLayerRef.current); 
    };
  }, [ships, map]);

  return null;
}

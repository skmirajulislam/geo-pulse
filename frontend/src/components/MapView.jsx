import React, { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CATEGORY_COLORS } from '../services/api';
import './component-css/MapView.css';
import ZoneOverlays from './ZoneOverlays';
import SubmarineCables from './SubmarineCables';
import Pipelines from './Pipelines';
import DataCenters from './DataCenters';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createMarkerIcon = (category, intensity) => {
  const color = CATEGORY_COLORS[category] || '#3B82F6';
  const size = Math.max(10, Math.min(24, 8 + intensity * 1.6));
  const pulseSize = size * 2.5;

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:${pulseSize}px;height:${pulseSize}px;
          border-radius:50%;
          background:${color};
          opacity:0.2;
          animation:marker-ping 2s cubic-bezier(0,0,0.2,1) infinite;
        "></div>
        <div style="
          position:absolute;
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:${color};
          box-shadow:0 0 12px ${color}aa, 0 0 4px ${color}60;
          cursor:pointer;
          z-index:2;
          transition:transform 0.2s;
        " onmouseover="this.style.transform='scale(1.4)'" onmouseout="this.style.transform='scale(1)'"></div>
      </div>
    `,
    iconSize: [pulseSize, pulseSize],
    iconAnchor: [pulseSize / 2, pulseSize / 2],
  });
};

const markersLayerRef  = { current: null };
const weatherLayerRef  = { current: null };
const naturalLayerRef  = { current: null };

/* Cross (✕) icon for natural events */
const createNaturalMarkerIcon = (type, severity) => {
  const COLOR_MAP = {
    earthquake: '#F97316', storm: '#6366F1', wildfire: '#EF4444',
    volcano: '#DC2626', flood: '#3B82F6', blizzard: '#93C5FD', weather: '#14B8A6',
  };
  const color = COLOR_MAP[type?.toLowerCase()] || '#14B8A6';
  const size  = Math.max(10, Math.min(22, 7 + (severity || 2) * 1.5));
  const half  = size / 2;

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${size * 2}px;height:${size * 2}px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:${size * 2}px;height:${size * 2}px;
          border-radius:50%;
          background:${color};
          opacity:0.15;
          animation:marker-ping 2.4s cubic-bezier(0,0,0.2,1) infinite;
        "></div>
        <svg width="${size}" height="${size}" viewBox="0 0 20 20" style="position:absolute;z-index:2;">
          <line x1="2" y1="2" x2="18" y2="18" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
          <line x1="18" y1="2" x2="2" y2="18" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize:   [size * 2, size * 2],
    iconAnchor: [size, size],
  });
};

const createWeatherMarkerIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
        <div style="
          width:12px;height:12px;border-radius:50%;
          background:#14B8A6;
          box-shadow:0 0 12px #14B8A6aa, 0 0 4px #14B8A660;
          border:1px solid rgba(255,255,255,0.45);
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const EventMarkers = ({ events, onEventClick, onCountryClick }) => {
  const map = useMap();

  const handleMarkerClick = useCallback((event) => {
    onEventClick(event);
  }, [onEventClick]);

  useEffect(() => {
    if (markersLayerRef.current) map.removeLayer(markersLayerRef.current);
    const layerGroup = L.layerGroup();

    events.forEach((event) => {
      if (!event.location || typeof event.location.lat !== 'number' || typeof event.location.lng !== 'number') return;

      const icon = createMarkerIcon(event.category, event.intensity);
      const hash = event.id ? event.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
      const isDefault = event.location.lat === 0 && event.location.lng === 0;
      const spread = isDefault ? 12.0 : 1.2;
      const offsetLat = (((hash * 7) % 100) / 100 - 0.5) * spread;
      const offsetLng = (((hash * 13) % 100) / 100 - 0.5) * spread;

      const marker = L.marker([event.location.lat + offsetLat, event.location.lng + offsetLng], { icon });
      marker.on('click', () => handleMarkerClick(event));

      const color = CATEGORY_COLORS[event.category] || '#3B82F6';
      marker.bindTooltip(
        `<div style="background:#101217;color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;max-width:380px;word-wrap:break-word;white-space:normal;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${color};margin-bottom:4px;">${event.category}</div>
          <div style="font-size:12px;font-weight:500;line-height:1.4;">${event.title}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:6px;">${event.country}</div>
        </div>`,
        { direction: 'top', offset: [0, -10], className: 'custom-tooltip', opacity: 1 }
      );
      layerGroup.addLayer(marker);
    });

    layerGroup.addTo(map);
    markersLayerRef.current = layerGroup;

    return () => { if (markersLayerRef.current) map.removeLayer(markersLayerRef.current); };
  }, [events, map, handleMarkerClick]);

  return null;
};

const WeatherMarkers = ({ weatherMarkers }) => {
  const map = useMap();

  useEffect(() => {
    if (weatherLayerRef.current) map.removeLayer(weatherLayerRef.current);
    const layerGroup = L.layerGroup();
    const icon = createWeatherMarkerIcon();

    weatherMarkers.forEach((marker) => {
      if (typeof marker.latitude !== 'number' || typeof marker.longitude !== 'number') return;
      const weatherMarker = L.marker([marker.latitude, marker.longitude], { icon });
      weatherMarker.bindTooltip(
        `<div style="background:#101217;color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;max-width:320px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#14B8A6;margin-bottom:4px;">Weather</div>
          <div style="font-size:12px;font-weight:500;">${marker.name}, ${marker.country}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:6px;">
            Temp ${marker.current?.temperature_2m ?? "N/A"}°C • Wind ${marker.current?.wind_speed_10m ?? "N/A"} km/h • Rain ${marker.current?.precipitation_probability ?? "N/A"}%
          </div>
        </div>`,
        { direction: 'top', offset: [0, -10], className: 'custom-tooltip', opacity: 1 }
      );
      layerGroup.addLayer(weatherMarker);
    });

    layerGroup.addTo(map);
    weatherLayerRef.current = layerGroup;

    return () => { if (weatherLayerRef.current) map.removeLayer(weatherLayerRef.current); };
  }, [weatherMarkers, map]);

  return null;
};

const NaturalEventMarkers = ({ events, onEventClick }) => {
  const map = useMap();

  useEffect(() => {
    if (naturalLayerRef.current) map.removeLayer(naturalLayerRef.current);
    const layerGroup = L.layerGroup();

    (events || []).forEach(event => {
      if (!Array.isArray(event.coords) || event.coords.length !== 2) return;
      const [lat, lng] = event.coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const icon   = createNaturalMarkerIcon(event.type, event.severity);
      const COLOR_MAP = {
        earthquake: '#F97316', storm: '#6366F1', wildfire: '#EF4444',
        volcano: '#DC2626', flood: '#3B82F6', blizzard: '#93C5FD', weather: '#14B8A6',
      };
      const color = COLOR_MAP[event.type?.toLowerCase()] || '#14B8A6';
      const marker = L.marker([lat, lng], { icon });

      marker.on('click', () => onEventClick && onEventClick(event));
      marker.bindTooltip(
        `<div style="background:#101217;color:#fff;padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-family:'IBM Plex Sans',sans-serif;width:max-content;max-width:320px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${color};margin-bottom:4px;">${event.type || 'Natural Event'}</div>
          <div style="font-size:12px;font-weight:500;line-height:1.4;">${event.title}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:6px;">${event.country || ''}</div>
        </div>`,
        { direction: 'top', offset: [0, -10], className: 'custom-tooltip', opacity: 1 }
      );
      layerGroup.addLayer(marker);
    });

    layerGroup.addTo(map);
    naturalLayerRef.current = layerGroup;

    return () => { if (naturalLayerRef.current) map.removeLayer(naturalLayerRef.current); };
  }, [events, map, onEventClick]);

  return null;
};

const MapController = ({ selectedEvent }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedEvent?.location && typeof selectedEvent.location.lat === 'number') {
      map.flyTo([selectedEvent.location.lat, selectedEvent.location.lng], 5, { duration: 1.5 });
    }
  }, [selectedEvent, map]);
  return null;
};

export default function MapView({ 
  events, 
  weatherMarkers = [], 
  naturalEventMarkers = [], 
  cablesLayerEnabled = false,
  pipelinesLayerEnabled = false,
  dataCentersLayerEnabled = false,
  onEventClick, 
  onCountryClick, 
  selectedEvent 
}) {
  return (
    <div data-testid="map-container" className="mv-container">
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        style={{ height: '100vh', width: '100vw' }}
        zoomControl={false}
        attributionControl={false}
        worldCopyJump={true}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" attribution="" />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="" pane="overlayPane" />
        <MapController selectedEvent={selectedEvent} />
        {cablesLayerEnabled && <SubmarineCables />}
        {pipelinesLayerEnabled && <Pipelines />}
        {dataCentersLayerEnabled && <DataCenters />}
        <ZoneOverlays events={events} />
        <EventMarkers events={events} onEventClick={onEventClick} onCountryClick={onCountryClick} />
        <WeatherMarkers weatherMarkers={weatherMarkers} />
        <NaturalEventMarkers events={naturalEventMarkers} onEventClick={onEventClick} />
      </MapContainer>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

const DIIF_COLOR = '#A78BFA';
const DIIF_ACCENT = '#FDE68A';

const createDiifIcon = () => L.divIcon({
  className: '',
  html: `
    <div class="diif-marker">
      <div class="diif-marker__pulse"></div>
      <div class="diif-marker__core">☢</div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const isValidFacility = (facility) =>
  facility &&
  typeof facility.lat === 'number' &&
  typeof facility.lon === 'number' &&
  Number.isFinite(facility.lat) &&
  Number.isFinite(facility.lon);

export default function IaeaDiifFacilities() {
  const map = useMap();
  const [dataset, setDataset] = useState(null);
  const [rawDataset, setRawDataset] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [processedRes, rawRes] = await Promise.all([
          fetch('/data/gamma-irradiators.json'),
          fetch('/data/gamma-irradiators-raw.json'),
        ]);

        if (!processedRes.ok) throw new Error(`Processed DIIF HTTP ${processedRes.status}`);
        if (!rawRes.ok) throw new Error(`Raw DIIF HTTP ${rawRes.status}`);

        const [processed, raw] = await Promise.all([processedRes.json(), rawRes.json()]);
        if (!cancelled) {
          setDataset(processed);
          setRawDataset(raw);
          setLoadError('');
        }
      } catch (error) {
        console.error('Failed to fetch IAEA DIIF data:', error);
        if (!cancelled) setLoadError('DIIF data unavailable');
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  const icon = useMemo(() => createDiifIcon(), []);
  const facilities = useMemo(
    () => (dataset?.facilities || []).filter(isValidFacility),
    [dataset]
  );

  useEffect(() => {
    if (!facilities.length) return;
    const bounds = L.latLngBounds(facilities.map((facility) => [facility.lat, facility.lon]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 3 });
  }, [facilities, map]);

  return (
    <>
      <div className="diif-panel glass-panel">
        <div className="diif-panel__eyebrow">IAEA DIIF</div>
        <div className="diif-panel__title">Industrial Irradiation Facilities</div>
        <div className="diif-panel__grid">
          <div>
            <span>{facilities.length}</span>
            <small>mapped</small>
          </div>
          <div>
            <span>{dataset?.totalFacilities || facilities.length || '—'}</span>
            <small>records</small>
          </div>
          <div>
            <span>{rawDataset?.realValues?.length || '—'}</span>
            <small>raw coords</small>
          </div>
        </div>
        <div className="diif-panel__source">
          {loadError || dataset?.source || 'Loading DIIF data…'}
        </div>
      </div>

      {facilities.map((facility) => (
        <React.Fragment key={facility.id}>
          <CircleMarker
            center={[facility.lat, facility.lon]}
            radius={9}
            pathOptions={{
              color: DIIF_ACCENT,
              weight: 1,
              fillColor: DIIF_COLOR,
              fillOpacity: 0.14,
              opacity: 0.55,
            }}
          />
          <Marker position={[facility.lat, facility.lon]} icon={icon}>
            <Tooltip direction="top" offset={[0, -12]} className="custom-tooltip" opacity={1}>
              <div className="diif-tooltip">
                <div className="diif-tooltip__eyebrow">Gamma Irradiator</div>
                <div className="diif-tooltip__title">{facility.city}</div>
                <div className="diif-tooltip__meta">{facility.country}</div>
              </div>
            </Tooltip>
          </Marker>
        </React.Fragment>
      ))}
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { mapsAPI } from '../services/api';
import { University } from '../data/universities';
import { MapPin, Loader2 } from 'lucide-react';

interface CampusMapProps {
  university: University;
  pickupLocationId?: string;
  dropoffLocationId?: string;
  highlightLocationId?: string;
  userCoords?: { lat: number; lng: number };
}

const CATEGORY_COLORS: Record<string, string> = {
  academic: '#16a34a',
  hostel:   '#7c3aed',
  facility: '#2563eb',
  food:     '#ea580c',
  sports:   '#dc2626',
  gate:     '#737373',
  religious:'#ca8a04',
};

// ── Singleton loader ─────────────────────────────────────────────────────────
let cachedApiKey: string | null = null;
let mapsLoaded = false;
let loadPromise: Promise<void> | null = null;

async function ensureGoogleMaps(): Promise<void> {
  if (mapsLoaded && typeof google !== 'undefined' && google.maps?.Map) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      if (!cachedApiKey) {
        const data = await mapsAPI.getConfig();
        if (!data.apiKey) throw new Error('Google Maps API key missing from server');
        cachedApiKey = data.apiKey;
      }
      setOptions({ key: cachedApiKey, version: 'weekly' });
      await Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
      ]);
      mapsLoaded = true;
    } catch (err) {
      loadPromise = null; // allow retry
      throw err;
    }
  })();

  return loadPromise;
}

// ── HTML element factories for AdvancedMarkerElement ─────────────────────────

/** Inject the GPS pulse keyframe once into <head> */
function injectPulseStyle() {
  if (document.getElementById('cr-pulse-style')) return;
  const s = document.createElement('style');
  s.id = 'cr-pulse-style';
  s.textContent = `@keyframes cr-pulse {
    0%   { transform: scale(1);   opacity: .55; }
    70%  { transform: scale(2.4); opacity: 0;   }
    100% { transform: scale(2.4); opacity: 0;   }
  }`;
  document.head.appendChild(s);
}

function makeDotEl(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    `width:12px`, `height:12px`, `background:${color}`,
    `border:2px solid white`, `border-radius:50%`,
    `box-shadow:0 1px 4px rgba(0,0,0,.3)`,
  ].join(';');
  return el;
}

function makePinEl(color: string, label: string): HTMLDivElement {
  // Sanitise label for inline HTML
  const safe = (label.length > 24 ? label.slice(0, 22) + '…' : label)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const el = document.createElement('div');
  // Column: pill → stem → dot. Bottom of element = geographic position.
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
  el.innerHTML = `
    <div style="background:${color};color:#fff;
      font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;
      padding:4px 10px;border-radius:20px;white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,.28);border:1.5px solid rgba(255,255,255,.75);
      user-select:none;">${safe}</div>
    <div style="width:2px;height:14px;background:${color};"></div>
    <div style="width:10px;height:10px;background:${color};
      border:2px solid white;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>
  `;
  return el;
}

function makeGpsEl(): HTMLDivElement {
  injectPulseStyle();
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:22px;height:22px;';
  el.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(59,130,246,.28);
      border-radius:50%;animation:cr-pulse 2s ease-out infinite;"></div>
    <div style="position:absolute;inset:4px;background:#3b82f6;
      border:2.5px solid white;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>
  `;
  return el;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CampusMap({
  university,
  pickupLocationId,
  dropoffLocationId,
  highlightLocationId,
  userCoords,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Initialise map ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    ensureGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (mapRef.current) { setStatus('ready'); return; }

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: university.center.lat, lng: university.center.lng },
          zoom: university.zoom,
          // mapId is required for AdvancedMarkerElement
          mapId: 'DEMO_MAP_ID',
          mapTypeId: 'roadmap',
          gestureHandling: 'greedy',
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        });

        mapRef.current = map;
        if (!cancelled) setStatus('ready');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[CampusMap] init error:', msg);
          setErrorMsg(msg);
          setStatus('error');
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-centre on university change ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    map.setCenter({ lat: university.center.lat, lng: university.center.lng });
    map.setZoom(university.zoom);
  }, [university, status]);

  // ── Markers / route ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    if (typeof google === 'undefined' || !google.maps?.marker?.AdvancedMarkerElement) return;

    const { AdvancedMarkerElement } = google.maps.marker;

    // Use an array of cleanup functions so we handle AME and overlays uniformly
    const cleanups: Array<() => void> = [];

    const addMarker = (
      position: google.maps.LatLngLiteral,
      content: HTMLElement,
      title: string,
      zIndex = 1,
    ) => {
      const m = new AdvancedMarkerElement({ position, map, content, title, zIndex });
      cleanups.push(() => { m.map = null; });
      return m;
    };

    const pickup    = university.locations.find((l) => l.id === pickupLocationId);
    const dropoff   = university.locations.find((l) => l.id === dropoffLocationId);
    const highlight = university.locations.find((l) => l.id === highlightLocationId);

    // ── Category dot markers ─────────────────────────────────────────────
    university.locations.forEach((loc) => {
      const isSpecial =
        loc.id === pickupLocationId ||
        loc.id === dropoffLocationId ||
        (loc.id === highlightLocationId && !pickupLocationId && !dropoffLocationId);
      if (isSpecial) return;

      const color = CATEGORY_COLORS[loc.category] || '#6b7280';
      addMarker({ lat: loc.lat, lng: loc.lng }, makeDotEl(color), loc.name, 1);
    });

    // ── Labelled pin markers ─────────────────────────────────────────────
    if (pickup)
      addMarker({ lat: pickup.lat, lng: pickup.lng }, makePinEl('#16a34a', `Pickup: ${pickup.name}`),   `Pickup: ${pickup.name}`,   10);
    if (dropoff)
      addMarker({ lat: dropoff.lat, lng: dropoff.lng }, makePinEl('#2563eb', `Drop-off: ${dropoff.name}`), `Drop-off: ${dropoff.name}`, 10);
    if (highlight && !pickupLocationId && !dropoffLocationId)
      addMarker({ lat: highlight.lat, lng: highlight.lng }, makePinEl('#dc2626', highlight.name), highlight.name, 10);

    // ── Dashed route polyline ────────────────────────────────────────────
    if (pickup && dropoff) {
      const line = new google.maps.Polyline({
        path: [
          { lat: pickup.lat,  lng: pickup.lng },
          { lat: dropoff.lat, lng: dropoff.lng },
        ],
        map,
        strokeOpacity: 0,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#3b82f6', scale: 3.5 },
          offset: '0',
          repeat: '14px',
        }],
      });
      cleanups.push(() => { line.setMap(null); });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: pickup.lat,  lng: pickup.lng });
      bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });
      map.fitBounds(bounds, { top: 80, right: 40, bottom: 60, left: 40 });
    }

    // ── GPS pulsing dot ──────────────────────────────────────────────────
    if (userCoords) {
      const ring = new google.maps.Circle({
        center: userCoords,
        radius: 28,
        map,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        zIndex: 19,
      });
      cleanups.push(() => { ring.setMap(null); });
      addMarker(userCoords, makeGpsEl(), 'You are here', 20);
    }

    // Cleanup: remove all overlays on re-render or unmount
    return () => {
      cleanups.forEach((fn) => { try { fn(); } catch (_) {} });
    };
  }, [status, university, pickupLocationId, dropoffLocationId, highlightLocationId, userCoords]);

  // ── Error state ──────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div
        className="relative w-full rounded-xl overflow-hidden border border-red-200 bg-red-50 flex flex-col items-center justify-center gap-2"
        style={{ height: '280px' }}
      >
        <MapPin className="w-8 h-8 text-red-400" />
        <p className="text-sm font-medium text-red-700">Map failed to load</p>
        <p className="text-xs text-red-500 text-center px-4">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: '280px' }}
    >
      {/* Google Maps mount point */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-3 z-10">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading map…</p>
        </div>
      )}

      {/* Legend */}
      {status === 'ready' && (
        <div className="absolute bottom-8 left-2 z-[1000] bg-white/95 backdrop-blur rounded-lg px-2.5 py-1.5 shadow-md border border-gray-100 pointer-events-none">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {[
              { label: 'Academic', color: '#16a34a' },
              { label: 'Hostel',   color: '#7c3aed' },
              { label: 'Food',     color: '#ea580c' },
              { label: 'Sports',   color: '#dc2626' },
              { label: 'Facility', color: '#2563eb' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-[9px] text-gray-600 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

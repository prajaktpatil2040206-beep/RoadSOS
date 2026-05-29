import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF, DirectionsRenderer, InfoWindowF } from '@react-google-maps/api';
import { MapPin, Route, Download, Play, Clock, Search, Crosshair, X } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import { cacheRoute, getCachedRoute } from '../services/offlineCache';
import type { NearbyPlace, PlaceCategory } from '../types';
import { PLACE_CATEGORY_META } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const JOURNEY_CATEGORIES: PlaceCategory[] = ['hospital', 'police', 'petrol', 'puncture', 'food', 'washroom'];

export default function JourneyPlanner() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const { isLoaded } = useGoogleMapsLoader();

  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showOriginSug, setShowOriginSug] = useState(false);
  const [showDestSug, setShowDestSug] = useState(false);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; distanceValue: number } | null>(null);
  const [routePlaces, setRoutePlaces] = useState<NearbyPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [planning, setPlanning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    placesServiceRef.current = new google.maps.places.PlacesService(map);
  }, []);

  useEffect(() => {
    if (isLoaded && !autocompleteRef.current) {
      autocompleteRef.current = new google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  // Fetch suggestions for origin
  const fetchOriginSuggestions = useCallback((val: string) => {
    if (!val.trim() || !autocompleteRef.current) { setOriginSuggestions([]); return; }
    autocompleteRef.current.getPlacePredictions({ input: val }, (preds, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
        setOriginSuggestions(preds.slice(0, 5));
        setShowOriginSug(true);
      } else setOriginSuggestions([]);
    });
  }, []);

  // Fetch suggestions for destination
  const fetchDestSuggestions = useCallback((val: string) => {
    if (!val.trim() || !autocompleteRef.current) { setDestSuggestions([]); return; }
    autocompleteRef.current.getPlacePredictions({ input: val }, (preds, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
        setDestSuggestions(preds.slice(0, 5));
        setShowDestSug(true);
      } else setDestSuggestions([]);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchOriginSuggestions(origin), 300);
    return () => clearTimeout(t);
  }, [origin, fetchOriginSuggestions]);

  useEffect(() => {
    const t = setTimeout(() => fetchDestSuggestions(dest), 300);
    return () => clearTimeout(t);
  }, [dest, fetchDestSuggestions]);

  // Resolve placeId → coords
  function resolvePlace(placeId: string): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      const svc = placesServiceRef.current || new google.maps.places.PlacesService(document.createElement('div'));
      svc.getDetails({ placeId, fields: ['geometry'] }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        } else reject(new Error('Could not resolve place'));
      });
    });
  }

  // Select origin suggestion
  const selectOrigin = useCallback(async (pred: google.maps.places.AutocompletePrediction) => {
    setOrigin(pred.description);
    setOriginSuggestions([]);
    setShowOriginSug(false);
    try {
      const coords = await resolvePlace(pred.place_id);
      setOriginCoords(coords);
    } catch { /* will geocode on plan */ }
  }, []);

  // Select dest suggestion
  const selectDest = useCallback(async (pred: google.maps.places.AutocompletePrediction) => {
    setDest(pred.description);
    setDestSuggestions([]);
    setShowDestSug(false);
    try {
      const coords = await resolvePlace(pred.place_id);
      setDestCoords(coords);
    } catch { /* will geocode on plan */ }
  }, []);

  // Use current location as origin
  function useCurrentLocation() {
    if (!geo.lat || !geo.lng) { toast.error('Location not detected yet'); return; }
    const label = `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`;
    setOrigin(label);
    setOriginCoords({ lat: geo.lat, lng: geo.lng });
    setOriginSuggestions([]);
    setShowOriginSug(false);
    toast.success('Using your current location as starting point');
  }

  // Geocode text → coords
  function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      const gc = new google.maps.Geocoder();
      gc.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          });
        } else reject(new Error(`Could not geocode: ${address}`));
      });
    });
  }

  const planRoute = useCallback(async () => {
    if (!origin || !dest || !isLoaded) return;
    setPlanning(true);
    setDownloaded(false);

    try {
      // Resolve coords if not already done
      let fromCoords = originCoords;
      let toCoords = destCoords;

      if (!fromCoords) {
        try { fromCoords = await geocodeAddress(origin); setOriginCoords(fromCoords); }
        catch { toast.error('Could not find starting location. Please select from suggestions.'); setPlanning(false); return; }
      }
      if (!toCoords) {
        try { toCoords = await geocodeAddress(dest); setDestCoords(toCoords); }
        catch { toast.error('Could not find destination. Please select from suggestions.'); setPlanning(false); return; }
      }

      // Check cache
      const cacheKey = `journey_${origin}_${dest}`.replace(/\s+/g, '_').toLowerCase().slice(0, 80);
      const cached = await getCachedRoute(cacheKey);
      if (cached) {
        const data = cached.data as any;
        if (data.directions) {
          setDirections(data.directions);
          setRouteInfo(data.routeInfo);
          setRoutePlaces(data.places || []);
          setPlanning(false);
          toast.success('Loaded from offline cache!');
          return;
        }
      }

      const ds = new google.maps.DirectionsService();
      ds.route({
        origin: fromCoords,
        destination: toCoords,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
      }, async (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs[0];
          const info = {
            distance: leg?.distance?.text || '',
            duration: leg?.duration_in_traffic?.text || leg?.duration?.text || '',
            distanceValue: leg?.distance?.value || 0,
          };
          setRouteInfo(info);
          mapRef.current?.fitBounds(result.routes[0].bounds);

          // Fetch places along route
          const places = await fetchPlacesAlongRoute(result);
          setRoutePlaces(places);
          setPlanning(false);
        } else {
          toast.error('Could not find route. Please verify the locations and try again.');
          setPlanning(false);
        }
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to plan route');
      setPlanning(false);
    }
  }, [origin, dest, isLoaded, originCoords, destCoords]);

  async function fetchPlacesAlongRoute(directionsResult: google.maps.DirectionsResult): Promise<NearbyPlace[]> {
    const legs = directionsResult.routes[0]?.legs || [];
    const steps = legs.flatMap(l => l.steps || []);
    const samplePoints: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i < steps.length; i += Math.max(1, Math.floor(steps.length / 5))) {
      samplePoints.push({ lat: steps[i].start_location.lat(), lng: steps[i].start_location.lng() });
    }

    const allPlaces: NearbyPlace[] = [];
    const seen = new Set<string>();
    const service = new google.maps.places.PlacesService(document.createElement('div'));

    for (const pt of samplePoints.slice(0, 4)) {
      for (const cat of JOURNEY_CATEGORIES.slice(0, 3)) {
        try {
          await new Promise<void>(resolve => {
            service.nearbySearch({
              location: new google.maps.LatLng(pt.lat, pt.lng),
              radius: 3000,
              keyword: PLACE_CATEGORY_META[cat].keyword,
            }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                results.slice(0, 4).forEach(p => {
                  if (!seen.has(p.place_id || '')) {
                    seen.add(p.place_id || '');
                    allPlaces.push({
                      id: p.place_id || Math.random().toString(36).slice(2),
                      name: p.name || 'Unknown',
                      lat: p.geometry?.location?.lat() || 0,
                      lng: p.geometry?.location?.lng() || 0,
                      category: cat,
                      address: p.vicinity || '',
                      rating: p.rating,
                      isOpen: p.opening_hours?.isOpen?.(),
                    });
                  }
                });
              }
              resolve();
            });
          });
        } catch { /* skip */ }
      }
    }
    return allPlaces;
  }

  async function downloadForOffline() {
    if (!directions || !routeInfo) return;
    setDownloading(true);
    try {
      const cacheKey = `journey_${origin}_${dest}`.replace(/\s+/g, '_').toLowerCase().slice(0, 80);
      // Serialize directions for storage (remove non-serializable parts)
      const serializable = JSON.parse(JSON.stringify(directions));
      await cacheRoute(cacheKey, {
        directions: serializable,
        routeInfo,
        places: routePlaces,
        origin,
        dest,
        originCoords,
        destCoords,
        cachedAt: Date.now(),
      });
      setDownloaded(true);
      toast.success(`✅ Journey saved offline! ${routePlaces.length} places cached along route. Valid for 7 days.`);
    } catch (e: any) {
      toast.error('Failed to save offline: ' + (e.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }

  function startJourney() {
    if (!dest) return;
    navigate(`/navigation?dest=${encodeURIComponent(dest)}`);
  }

  const center = geo.lat && geo.lng ? { lat: geo.lat, lng: geo.lng } : { lat: 20.5937, lng: 78.9629 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Controls */}
      <div style={{
        padding: '12px 16px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: '1rem' }}>🗺 Journey Planner</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: 4 }}>Pre-download maps for offline use</span>
        </div>

        {/* From / To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Origin */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: 'var(--green)', fontWeight: 800, zIndex: 1 }}>A</div>
            <input
              className="input"
              style={{ paddingLeft: 28, paddingRight: 36, height: 38, fontSize: '0.84rem' }}
              value={origin}
              onChange={e => { setOrigin(e.target.value); setOriginCoords(null); }}
              onFocus={() => originSuggestions.length > 0 && setShowOriginSug(true)}
              onBlur={() => setTimeout(() => setShowOriginSug(false), 200)}
              placeholder="From (city or place)"
            />
            <button
              onMouseDown={e => { e.preventDefault(); useCurrentLocation(); }}
              title="Use my current location"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', display: 'flex', padding: 2 }}
            >
              <Crosshair size={14} />
            </button>
            {showOriginSug && originSuggestions.length > 0 && (
              <SuggestionDropdown
                predictions={originSuggestions}
                onSelect={selectOrigin}
              />
            )}
          </div>

          {/* Destination */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: 'var(--red)', fontWeight: 800, zIndex: 1 }}>B</div>
            <input
              className="input"
              style={{ paddingLeft: 28, height: 38, fontSize: '0.84rem' }}
              value={dest}
              onChange={e => { setDest(e.target.value); setDestCoords(null); }}
              onFocus={() => destSuggestions.length > 0 && setShowDestSug(true)}
              onBlur={() => setTimeout(() => setShowDestSug(false), 200)}
              onKeyDown={e => e.key === 'Enter' && planRoute()}
              placeholder="To (city or place)"
            />
            {showDestSug && destSuggestions.length > 0 && (
              <SuggestionDropdown
                predictions={destSuggestions}
                onSelect={selectDest}
              />
            )}
          </div>
        </div>

        {/* Plan button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={planRoute}
            disabled={planning || !origin.trim() || !dest.trim()}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {planning ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Planning…</> : <><Route size={15} /> Plan Route</>}
          </button>
          {directions && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setDirections(null); setRouteInfo(null); setRoutePlaces([]); setDownloaded(false); }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Route info */}
        {routeInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: 'var(--blue)' }}>
              <MapPin size={13} /> {routeInfo.distance}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: 'var(--green)' }}>
              <Clock size={13} /> {routeInfo.duration} (with traffic)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {routePlaces.length} places cached
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={downloadForOffline}
                disabled={downloading || downloaded}
              >
                {downloading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Download size={13} />}
                {downloaded ? '✅ Saved Offline' : 'Save Offline'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={startJourney}>
                <Play size={13} /> Start
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map + sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {!isLoaded ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
              <LoadingSpinner text="Loading map…" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={12}
              mapTypeId="hybrid"
              options={{ disableDefaultUI: false, zoomControl: true, streetViewControl: false, fullscreenControl: false, mapTypeControl: false }}
              onLoad={onMapLoad}
            >
              {!directions && geo.lat && geo.lng && (
                <MarkerF
                  position={{ lat: geo.lat, lng: geo.lng }}
                  icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }}
                />
              )}
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{ polylineOptions: { strokeColor: '#ef4444', strokeWeight: 5, strokeOpacity: 0.9 } }}
                />
              )}
              {routePlaces.map(p => {
                const meta = PLACE_CATEGORY_META[p.category];
                return (
                  <MarkerF
                    key={p.id}
                    position={{ lat: p.lat, lng: p.lng }}
                    onClick={() => setSelectedPlace(p)}
                    icon={{
                      url: `data:image/svg+xml,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                          <circle cx="14" cy="14" r="13" fill="${meta.color}" opacity="0.9" stroke="white" stroke-width="2"/>
                          <text x="14" y="18" text-anchor="middle" font-size="12" font-family="sans-serif">${meta.icon}</text>
                        </svg>
                      `)}`,
                      scaledSize: new google.maps.Size(28, 28),
                      anchor: new google.maps.Point(14, 14),
                    }}
                  />
                );
              })}
              {selectedPlace && (
                <InfoWindowF position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} onCloseClick={() => setSelectedPlace(null)}>
                  <div style={{ maxWidth: 180, fontFamily: 'Inter, sans-serif', color: '#111' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>{selectedPlace.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 4 }}>{selectedPlace.address}</div>
                    {selectedPlace.rating && <div style={{ fontSize: '0.75rem' }}>⭐ {selectedPlace.rating}</div>}
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}

          {/* Center button */}
          {isLoaded && geo.lat && (
            <button
              onClick={() => { mapRef.current?.panTo({ lat: geo.lat!, lng: geo.lng! }); }}
              style={{
                position: 'absolute', bottom: 16, right: 16,
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--bg-card)', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: 'var(--shadow-md)',
              }}
            >
              <Crosshair size={20} color="var(--primary)" />
            </button>
          )}
        </div>

        {/* Places sidebar */}
        {routePlaces.length > 0 && (
          <div style={{ width: 270, overflowY: 'auto', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.76rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Along Route ({routePlaces.length})
            </div>
            {JOURNEY_CATEGORIES.map(cat => {
              const catPlaces = routePlaces.filter(p => p.category === cat);
              if (!catPlaces.length) return null;
              const meta = PLACE_CATEGORY_META[cat];
              return (
                <div key={cat}>
                  <div style={{ padding: '7px 14px', background: 'var(--bg-card)', fontSize: '0.7rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {meta.icon} {meta.label} ({catPlaces.length})
                  </div>
                  {catPlaces.map(p => (
                    <div key={p.id} onClick={() => setSelectedPlace(p)}
                      style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }} className="truncate">{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }} className="truncate">{p.address}</div>
                      {p.rating && <div style={{ fontSize: '0.7rem', color: 'var(--yellow)', marginTop: 2 }}>⭐ {p.rating}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable suggestion dropdown component
function SuggestionDropdown({
  predictions,
  onSelect,
}: {
  predictions: google.maps.places.AutocompletePrediction[];
  onSelect: (p: google.maps.places.AutocompletePrediction) => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', marginTop: 3,
      boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
    }}>
      {predictions.map(pred => (
        <div
          key={pred.place_id}
          onMouseDown={() => onSelect(pred)}
          style={{
            padding: '9px 12px', cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <MapPin size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-1)' }}>
              {pred.structured_formatting.main_text}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              {pred.structured_formatting.secondary_text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

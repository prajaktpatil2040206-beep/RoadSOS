import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF, DirectionsRenderer, InfoWindowF, PolylineF } from '@react-google-maps/api';
import { MapPin, Route, Download, Play, Clock, Search, Crosshair, X } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import { cacheRoute, getCachedRoute } from '../services/offlineCache';
import type { NearbyPlace, PlaceCategory } from '../types';
import { PLACE_CATEGORY_META } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const JOURNEY_CATEGORIES: PlaceCategory[] = ['hospital', 'police', 'petrol', 'puncture', 'food', 'washroom'];

const LIGHT_MAP_OPTIONS = {
  mapTypeId: 'roadmap',
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
  ]
};

export default function JourneyPlanner() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const { isLoaded, loadError } = useGoogleMapsLoader();

  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showOriginSug, setShowOriginSug] = useState(false);
  const [showDestSug, setShowDestSug] = useState(false);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeStart, setRouteStart] = useState<{ lat: number; lng: number } | null>(null);
  const [routeEnd, setRouteEnd] = useState<{ lat: number; lng: number } | null>(null);

  const originTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const destTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

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
    // No-op
  }, [isLoaded]);

  const fetchOriginSuggestions = useCallback(async (val: string) => {
    if (!val.trim() || !isLoaded) { setOriginSuggestions([]); return; }
    try {
      const placesLib = google.maps.places as any;
      if (!originTokenRef.current) originTokenRef.current = new placesLib.AutocompleteSessionToken();
      
      const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: val,
        sessionToken: originTokenRef.current
      });
      if (response && response.suggestions) {
        const preds = response.suggestions.map((s: any) => ({
          description: s.placePrediction.text.text,
          place_id: s.placePrediction.placeId,
          structured_formatting: {
            main_text: s.placePrediction.text.text.split(',')[0],
            secondary_text: s.placePrediction.text.text.split(',').slice(1).join(',').trim() || ''
          }
        }));
        setOriginSuggestions(preds.slice(0, 5));
        setShowOriginSug(true);
      } else {
        setOriginSuggestions([]);
      }
    } catch (err) {
      console.error('Origin autocomplete failed:', err);
      setOriginSuggestions([]);
    }
  }, [isLoaded]);

  const fetchDestSuggestions = useCallback(async (val: string) => {
    if (!val.trim() || !isLoaded) { setDestSuggestions([]); return; }
    try {
      const placesLib = google.maps.places as any;
      if (!destTokenRef.current) destTokenRef.current = new placesLib.AutocompleteSessionToken();
      
      const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: val,
        sessionToken: destTokenRef.current
      });
      if (response && response.suggestions) {
        const preds = response.suggestions.map((s: any) => ({
          description: s.placePrediction.text.text,
          place_id: s.placePrediction.placeId,
          structured_formatting: {
            main_text: s.placePrediction.text.text.split(',')[0],
            secondary_text: s.placePrediction.text.text.split(',').slice(1).join(',').trim() || ''
          }
        }));
        setDestSuggestions(preds.slice(0, 5));
        setShowDestSug(true);
      } else {
        setDestSuggestions([]);
      }
    } catch (err) {
      console.error('Dest autocomplete failed:', err);
      setDestSuggestions([]);
    }
  }, [isLoaded]);

  useEffect(() => {
    const t = setTimeout(() => fetchOriginSuggestions(origin), 300);
    return () => clearTimeout(t);
  }, [origin, fetchOriginSuggestions]);

  useEffect(() => {
    const t = setTimeout(() => fetchDestSuggestions(dest), 300);
    return () => clearTimeout(t);
  }, [dest, fetchDestSuggestions]);

  async function resolvePlace(placeId: string, tokenRef: React.MutableRefObject<any>): Promise<{ lat: number; lng: number }> {
    try {
      const placesLib = google.maps.places as any;
      const place = new placesLib.Place({ id: placeId });
      await place.fetchFields({ fields: ['location'] });
      
      // Reset token after use
      tokenRef.current = new placesLib.AutocompleteSessionToken();
      
      if (place.location) {
        return { lat: place.location.lat(), lng: place.location.lng() };
      }
      throw new Error('Place location not found');
    } catch (err) {
      console.error('Resolve place failed:', err);
      throw err;
    }
  }

  const selectOrigin = useCallback(async (pred: google.maps.places.AutocompletePrediction) => {
    setOrigin(pred.description);
    setOriginSuggestions([]);
    setShowOriginSug(false);
    try {
      const coords = await resolvePlace(pred.place_id, originTokenRef);
      setOriginCoords(coords);
    } catch { /* will geocode on plan */ }
  }, []);

  const selectDest = useCallback(async (pred: google.maps.places.AutocompletePrediction) => {
    setDest(pred.description);
    setDestSuggestions([]);
    setShowDestSug(false);
    try {
      const coords = await resolvePlace(pred.place_id, destTokenRef);
      setDestCoords(coords);
    } catch { /* will geocode on plan */ }
  }, []);

  async function useCurrentLocation() {
    const fresh = await geo.refresh();
    if (!fresh) {
      toast.error(geo.error || 'Location not detected. Please enable GPS.');
      return;
    }
    const label = `${fresh.lat.toFixed(5)}, ${fresh.lng.toFixed(5)}`;
    setOrigin(label);
    setOriginCoords(fresh);
    setOriginSuggestions([]);
    setShowOriginSug(false);
    toast.success('Using your exact live location as starting point');
  }

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
      let fromCoords = originCoords;
      let toCoords = destCoords;

      if (!fromCoords) {
        if (originSuggestions.length > 0) {
          try {
            fromCoords = await resolvePlace(originSuggestions[0].place_id, originTokenRef);
            setOriginCoords(fromCoords);
            setOrigin(originSuggestions[0].description);
          } catch { /* fallback to geocode */ }
        }
        if (!fromCoords) {
          try { fromCoords = await geocodeAddress(origin); setOriginCoords(fromCoords); }
          catch { toast.error('Could not find starting location. Please select from suggestions.'); setPlanning(false); return; }
        }
      }
      
      if (!toCoords) {
        if (destSuggestions.length > 0) {
          try {
            toCoords = await resolvePlace(destSuggestions[0].place_id, destTokenRef);
            setDestCoords(toCoords);
            setDest(destSuggestions[0].description);
          } catch { /* fallback to geocode */ }
        }
        if (!toCoords) {
          try { toCoords = await geocodeAddress(dest); setDestCoords(toCoords); }
          catch { toast.error('Could not find destination. Please select from suggestions.'); setPlanning(false); return; }
        }
      }

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
          if (leg) {
            setRouteStart({ lat: leg.start_location.lat(), lng: leg.start_location.lng() });
            setRouteEnd({ lat: leg.end_location.lat(), lng: leg.end_location.lng() });
          }
          setRouteInfo(info);
          mapRef.current?.fitBounds(result.routes[0].bounds);

          const places = await fetchPlacesAlongRoute(result);
          setRoutePlaces(places);
          setPlanning(false);
        } else {
          toast.error('Could not find a valid route between these locations.');
          setDirections(null);
          setRouteStart(null);
          setRouteEnd(null);
        }
        setPlanning(false);
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: '#F8FAFC' }}>
      {/* Controls */}
      <div style={{
        padding: '12px 16px', background: '#fff',
        borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 12,
        flexShrink: 0, zIndex: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>🗺 Journey Planner</h2>
          <span style={{ fontSize: '0.72rem', color: '#64748B', marginLeft: 4, fontWeight: 600 }}>Pre-download maps for offline use</span>
        </div>

        {/* From / To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Origin */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: '#10B981', fontWeight: 800, zIndex: 1 }}>A</div>
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
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', display: 'flex', padding: 2 }}
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
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: '#EF4444', fontWeight: 800, zIndex: 1 }}>B</div>
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
            {planning ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Planning…</> : <><Route size={15} /> Plan Route</>}
          </button>
          {directions && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setDirections(null); setRouteInfo(null); setRoutePlaces([]); setDownloaded(false); }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Route info */}
        {routeInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: '#4F46E5', fontWeight: 700 }}>
              <MapPin size={13} /> {routeInfo.distance}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: '#10B981', fontWeight: 700 }}>
              <Clock size={13} /> {routeInfo.duration} (with traffic)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              {routePlaces.length} places cached
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={downloadForOffline}
                disabled={downloading || downloaded}
              >
                {downloading ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Download size={13} />}
                {downloaded ? '✅ Saved Offline' : 'Save Offline'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={startJourney}>
                <Play size={13} /> Start
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loadError ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#EF4444' }}>
            Failed to load Google Maps. Please check your network connection.
          </div>
        ) : !isLoaded ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
            <LoadingSpinner text="Loading map…" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={12}
            options={LIGHT_MAP_OPTIONS}
            onLoad={onMapLoad}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: { strokeColor: '#4F46E5', strokeWeight: 5, strokeOpacity: 0.8 },
                }}
              />
            )}

            {/* Off-Road Dotted Polylines */}
            {directions && originCoords && routeStart && (
              <PolylineF
                path={[originCoords, routeStart]}
                options={{
                  strokeColor: '#64748B', strokeOpacity: 0, strokeWeight: 0,
                  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }],
                }}
              />
            )}
            {directions && destCoords && routeEnd && (
              <PolylineF
                path={[routeEnd, destCoords]}
                options={{
                  strokeColor: '#64748B', strokeOpacity: 0, strokeWeight: 0,
                  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }],
                }}
              />
            )}

            {/* Start and End Markers */}
            {originCoords && (
              <MarkerF position={originCoords}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8, fillColor: '#10B981', fillOpacity: 1,
                  strokeColor: '#fff', strokeWeight: 2,
                }}
              />
            )}
            {destCoords && (
              <MarkerF position={destCoords}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
            )}

            {/* Places along route */}
            {routePlaces.map(p => (
              <MarkerF
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                icon={markerIcon(p.category, selectedPlace?.id === p.id)}
                onClick={() => setSelectedPlace(p)}
                zIndex={selectedPlace?.id === p.id ? 50 : 10}
              >
                {selectedPlace?.id === p.id && (
                  <InfoWindowF
                    position={{ lat: p.lat, lng: p.lng }}
                    onCloseClick={() => setSelectedPlace(null)}
                    options={{ pixelOffset: new google.maps.Size(0, -45) }}
                  >
                    <div style={{ padding: '0.25rem', maxWidth: 200, color: '#0F172A', fontFamily: 'inherit' }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 700 }}>{p.name}</h4>
                      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748B' }}>{p.address}</p>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.id}`, '_blank')}
                      >
                        View on Google Maps
                      </button>
                    </div>
                  </InfoWindowF>
                )}
              </MarkerF>
            ))}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}

function SuggestionDropdown({
  predictions,
  onSelect,
}: {
  predictions: google.maps.places.AutocompletePrediction[];
  onSelect: (pred: google.maps.places.AutocompletePrediction) => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
      background: '#fff', border: '1px solid #E2E8F0',
      borderRadius: 'var(--r-md)', marginTop: 4, boxShadow: '0 10px 25px rgba(15,23,42,0.1)',
      overflow: 'hidden',
    }}>
      {predictions.map(pred => (
        <div
          key={pred.place_id}
          onMouseDown={() => onSelect(pred)}
          style={{
            padding: '10px 14px', cursor: 'pointer',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <MapPin size={14} color="#4F46E5" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>
              {pred.structured_formatting.main_text}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {pred.structured_formatting.secondary_text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function markerIcon(cat: PlaceCategory, isSelected: boolean) {
  const meta = PLACE_CATEGORY_META[cat];
  const size = isSelected ? 40 : 32;
  const pinH = isSelected ? 48 : 38;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinH}" viewBox="0 0 ${size} ${pinH}">
    <path d="M${size / 2} 0C${size * 0.224} 0 0 ${pinH * 0.346} 0 ${pinH * 0.577}c0 ${pinH * 0.462} ${size / 2} ${pinH * 0.423} ${size / 2} ${pinH * 0.423}S${size} ${pinH * 1.038} ${size} ${pinH * 0.577}C${size} ${pinH * 0.346} ${size * 0.776} 0 ${size / 2} 0z" fill="${meta.color}" />
    <circle cx="${size / 2}" cy="${pinH * 0.42}" r="${size * 0.3}" fill="white" opacity="0.95"/>
    <text x="${size / 2}" y="${pinH * 0.48}" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.36}" font-family="sans-serif">${meta.icon}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, pinH),
    anchor: new google.maps.Point(size / 2, pinH),
  };
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleMap, MarkerF, DirectionsRenderer, PolylineF } from '@react-google-maps/api';
import { Navigation, MapPin, Search, X, Gauge, Clock, ArrowLeft, Crosshair } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import LoadingSpinner from '../components/common/LoadingSpinner';

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

export default function NavigationPage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [params] = useSearchParams();
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const { isLoaded, loadError } = useGoogleMapsLoader();

  const [inputVal, setInputVal] = useState(params.get('dest') || '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinnedLoc, setPinnedLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [routeStart, setRouteStart] = useState<google.maps.LatLngLiteral | null>(null);
  const [routeEnd, setRouteEnd] = useState<google.maps.LatLngLiteral | null>(null);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (geo.lat && geo.lng) setUserPos({ lat: geo.lat, lng: geo.lng });
  }, [geo.lat, geo.lng]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    // No-op
  }, [isLoaded]);

  const fetchSuggestions = useCallback(async (val: string) => {
    if (!val.trim() || !isLoaded) { setSuggestions([]); return; }
    
    try {
      const placesLib = google.maps.places as any;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }

      const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: val,
        sessionToken: sessionTokenRef.current
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
        setSuggestions(preds.slice(0, 5));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Autocomplete fetch failed:', err);
      setSuggestions([]);
    }
  }, [isLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(inputVal), 300);
    return () => clearTimeout(timer);
  }, [inputVal, fetchSuggestions]);

  const buildRoute = useCallback((dest: { lat: number; lng: number }) => {
    if (!userPos || !isLoaded) return;
    setLoading(true);
    const ds = new google.maps.DirectionsService();
    ds.route({
      origin: userPos,
      destination: dest,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
    }, (result, status) => {
      if (status === 'OK' && result) {
        setDirections(result);
        const leg = result.routes[0]?.legs[0];
        if (leg) {
          setRouteInfo({
            distance: leg.distance?.text || '',
            duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
          });
          setRouteStart({ lat: leg.start_location.lat(), lng: leg.start_location.lng() });
          setRouteEnd({ lat: leg.end_location.lat(), lng: leg.end_location.lng() });
        }
        setNavigating(true);
        mapRef.current?.fitBounds(result.routes[0].bounds);
      } else {
        alert('Could not find route. Try searching for a more specific location.');
        setDirections(null);
        setRouteStart(null);
        setRouteEnd(null);
      }
      setLoading(false);
    });
  }, [userPos, isLoaded]);

  const selectSuggestion = useCallback(async (pred: any) => {
    setInputVal(pred.description);
    setSuggestions([]);
    setShowSuggestions(false);

    if (!isLoaded) return;

    try {
      const placesLib = google.maps.places as any;
      const place = new placesLib.Place({
        id: pred.place_id,
      });

      await place.fetchFields({
        fields: ['location', 'displayName']
      });

      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();

      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        const dest = { name: pred.description, lat, lng };
        setDestination(dest);
        setPinnedLoc(null);
        buildRoute({ lat, lng });
      }
    } catch (err) {
      console.error('Failed to get place details via new API:', err);
    }
  }, [isLoaded, buildRoute]);

  // buildRoute moved above selectSuggestion

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!pinMode || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPinnedLoc({ lat, lng });

    const gc = new google.maps.Geocoder();
    gc.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const addr = results[0].formatted_address;
        setInputVal(addr);
        setDestination({ name: addr, lat, lng });
      } else {
        setInputVal(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setDestination({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
      }
    });
    setPinMode(false);
    buildRoute({ lat, lng });
  }, [pinMode, buildRoute]);

  const handleGo = useCallback(() => {
    if (!inputVal.trim() || !userPos || !isLoaded) return;
    
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }

    setSuggestions([]);
    setShowSuggestions(false);

    const gc = new google.maps.Geocoder();
    gc.geocode({ address: inputVal }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setDestination({ name: inputVal, lat, lng });
        setPinnedLoc(null);
        buildRoute({ lat, lng });
      } else {
        alert('Location not found. Please select from suggestions or try a different search.');
      }
    });
  }, [inputVal, userPos, isLoaded, buildRoute]);

  function clearRoute() {
    setDirections(null);
    setRouteStart(null);
    setRouteEnd(null);
    setNavigating(false);
    setDestination(null);
    setPinnedLoc(null);
    setInputVal('');
    setRouteInfo(null);
    setPinMode(false);
  }

  function openInGoogleMaps() {
    if (!userPos || !destination) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  const center = userPos || { lat: 20.5937, lng: 78.9629 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', minHeight: 0 }}>
      {/* Top controls */}
      <div style={{
        padding: '12px 16px', background: '#fff',
        borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0, zIndex: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)} style={{ color: '#64748B' }}><ArrowLeft size={16} /></button>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Navigation</h2>
          {routeInfo && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#4F46E5', fontWeight: 700 }}>
                <MapPin size={13} /> {routeInfo.distance}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#10B981', fontWeight: 700 }}>
                <Clock size={13} /> {routeInfo.duration}
              </span>
            </div>
          )}
        </div>

        {/* Destination search */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none', zIndex: 1 }} />
            <input
              className="input"
              style={{ paddingLeft: 34, height: 38, fontSize: '0.85rem' }}
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={e => { if (e.key === 'Enter') handleGo(); if (e.key === 'Escape') setShowSuggestions(false); }}
              placeholder="Search destination (e.g. AIIMS Delhi, Pune)"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 'var(--r-md)', marginTop: 4, boxShadow: '0 10px 25px rgba(15,23,42,0.1)',
                overflow: 'hidden',
              }}>
                {suggestions.map(pred => (
                  <div
                    key={pred.place_id}
                    onMouseDown={() => selectSuggestion(pred)}
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
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleGo} disabled={loading || !inputVal.trim()}>
            {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Navigation size={15} />}
            Go
          </button>
          {navigating && (
            <button className="btn btn-secondary btn-sm" onClick={clearRoute}>
              <X size={15} /> Clear
            </button>
          )}
        </div>

        {/* Bottom bar: location status + pin toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: geo.lat ? '#10B981' : '#EF4444',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: '#64748B', flex: 1 }}>
            {geo.loading ? 'Detecting…' : geo.lat ? `📍 ${geo.lat.toFixed(5)}, ${geo.lng?.toFixed(5)}` : 'Location unavailable'}
          </span>
          {geo.speed !== null && (
            <span style={{ color: '#06B6D4', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
              <Gauge size={12} /> {Math.round((geo.speed || 0) * 3.6)} km/h
            </span>
          )}
          <button
            onClick={() => setPinMode(!pinMode)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--r-sm)', border: `1px solid ${pinMode ? '#4F46E5' : '#E2E8F0'}`,
              background: pinMode ? '#EEF2FF' : '#F1F5F9', color: pinMode ? '#4F46E5' : '#475569',
              fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
            }}
          >
            <Crosshair size={12} />
            {pinMode ? 'Click map to pin' : 'Pin Location'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, cursor: pinMode ? 'crosshair' : 'default' }}>
        {loadError ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FEE2E2', color: '#EF4444', padding: 20, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Failed to load Google Maps</div>
            <div style={{ fontSize: '0.9rem' }}>{loadError instanceof Error ? loadError.message : String(loadError)}</div>
          </div>
        ) : !isLoaded ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
            <LoadingSpinner text="Loading map…" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={14}
            options={LIGHT_MAP_OPTIONS}
            onLoad={onMapLoad}
            onClick={handleMapClick}
          >
            {/* User position */}
            {userPos && (
              <MarkerF position={userPos}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10, fillColor: '#3B82F6', fillOpacity: 1,
                  strokeColor: '#fff', strokeWeight: 2,
                }}
              />
            )}

            {/* Destination / Pinned Location */}
            {(pinnedLoc || destination) && (
              <MarkerF position={pinnedLoc || destination!}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
            )}

            {/* Route */}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: { strokeColor: '#4F46E5', strokeWeight: 5, strokeOpacity: 0.8 },
                }}
              />
            )}

            {/* Dotted Lines for Off-Road sections */}
            {directions && userPos && routeStart && (
              <PolylineF
                path={[userPos, routeStart]}
                options={{
                  strokeColor: '#64748B', strokeOpacity: 0, strokeWeight: 0,
                  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }],
                }}
              />
            )}
            {directions && destination && routeEnd && (
              <PolylineF
                path={[routeEnd, destination]}
                options={{
                  strokeColor: '#64748B', strokeOpacity: 0, strokeWeight: 0,
                  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }],
                }}
              />
            )}
          </GoogleMap>
        )}

        {/* Pin mode overlay hint */}
        {pinMode && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#4F46E5', color: '#fff', padding: '8px 16px',
            borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Crosshair size={14} /> Click anywhere on the map to set destination
          </div>
        )}

        {/* Navigate button */}
        {navigating && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 10,
          }}>
            <button className="btn btn-primary" onClick={openInGoogleMaps}
              style={{ boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}>
              <Navigation size={16} /> Open Turn-by-Turn in Google Maps
            </button>
          </div>
        )}

        {/* Center on me button */}
        <button
          onClick={async () => {
            const fresh = await geo.refresh();
            if (fresh) {
              setUserPos(fresh);
              mapRef.current?.panTo(fresh);
            } else if (geo.error) {
              alert(geo.error);
            }
          }}
          style={{
            position: 'absolute', bottom: navigating ? 70 : 20, right: 16,
            width: 44, height: 44, borderRadius: '50%',
            background: '#fff', border: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 10px rgba(15,23,42,0.1)',
          }}
          title="Center on me"
        >
          <Crosshair size={20} color="#4F46E5" />
        </button>
      </div>
    </div>
  );
}

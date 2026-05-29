import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleMap, MarkerF, DirectionsRenderer } from '@react-google-maps/api';
import { Navigation, MapPin, Search, X, Gauge, Clock, ArrowLeft, Crosshair } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import LoadingSpinner from '../components/common/LoadingSpinner';

const HYBRID_OPTIONS = {
  mapTypeId: 'hybrid',
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: false,
};

export default function NavigationPage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [params] = useSearchParams();
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const { isLoaded } = useGoogleMapsLoader();

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
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (geo.lat && geo.lng) setUserPos({ lat: geo.lat, lng: geo.lng });
  }, [geo.lat, geo.lng]);

  // Init services when map loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    placesServiceRef.current = new google.maps.places.PlacesService(map);
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
  }, []);

  // Also init autocomplete service when isLoaded even without map
  useEffect(() => {
    if (isLoaded && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  // Get autocomplete suggestions
  const fetchSuggestions = useCallback((val: string) => {
    if (!val.trim() || !isLoaded) { setSuggestions([]); return; }
    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    }
    autocompleteServiceRef.current.getPlacePredictions(
      { input: val, types: [] },
      (preds, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
          setSuggestions(preds.slice(0, 5));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, [isLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(inputVal), 300);
    return () => clearTimeout(timer);
  }, [inputVal, fetchSuggestions]);

  // Select a suggestion → get details → route
  const selectSuggestion = useCallback((pred: google.maps.places.AutocompletePrediction) => {
    setInputVal(pred.description);
    setSuggestions([]);
    setShowSuggestions(false);

    if (!isLoaded) return;
    const service = placesServiceRef.current || new google.maps.places.PlacesService(document.createElement('div'));
    service.getDetails({ placeId: pred.place_id, fields: ['geometry', 'name', 'formatted_address'] }, (place, st) => {
      if (st === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const dest = { name: pred.description, lat, lng };
        setDestination(dest);
        setPinnedLoc(null);
        buildRoute({ lat, lng });
      }
    });
  }, [isLoaded]);

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
        if (leg) setRouteInfo({
          distance: leg.distance?.text || '',
          duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        });
        setNavigating(true);
        // Fit map to route
        mapRef.current?.fitBounds(result.routes[0].bounds);
      } else {
        alert('Could not find route. Try searching for a more specific location.');
        setDirections(null);
      }
      setLoading(false);
    });
  }, [userPos, isLoaded]);

  // Handle map click for pin mode
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!pinMode || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPinnedLoc({ lat, lng });

    // Reverse geocode
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

  // Go button with typed text (not autocomplete)
  const handleGo = useCallback(() => {
    if (!inputVal.trim() || !userPos || !isLoaded) return;
    setSuggestions([]);
    setShowSuggestions(false);

    // Try to geocode the typed input
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', minHeight: 0 }}>
      {/* Top controls */}
      <div style={{
        padding: '12px 16px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
          <h2 style={{ fontSize: '1rem' }}>Navigation</h2>
          {routeInfo && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--blue)' }}>
                <MapPin size={13} /> {routeInfo.distance}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--green)' }}>
                <Clock size={13} /> {routeInfo.duration}
              </span>
            </div>
          )}
        </div>

        {/* Destination search */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 1 }} />
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
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', marginTop: 4, boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}>
                {suggestions.map(pred => (
                  <div
                    key={pred.place_id}
                    onMouseDown={() => selectSuggestion(pred)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <MapPin size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                        {pred.structured_formatting.main_text}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
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
            background: geo.lat ? 'var(--green)' : 'var(--red)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: 'var(--text-3)', flex: 1 }}>
            {geo.loading ? 'Detecting…' : geo.lat ? `📍 ${geo.lat.toFixed(5)}, ${geo.lng?.toFixed(5)}` : 'Location unavailable'}
          </span>
          {geo.speed !== null && (
            <span style={{ color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Gauge size={12} /> {Math.round((geo.speed || 0) * 3.6)} km/h
            </span>
          )}
          <button
            onClick={() => setPinMode(!pinMode)}
            style={{
              padding: '3px 10px', borderRadius: 'var(--r-sm)', border: `1px solid ${pinMode ? 'var(--primary)' : 'var(--border)'}`,
              background: pinMode ? 'var(--primary-soft)' : 'transparent', color: pinMode ? 'var(--primary)' : 'var(--text-2)',
              fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Crosshair size={12} />
            {pinMode ? 'Click map to pin' : 'Pin Location'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, cursor: pinMode ? 'crosshair' : 'default' }}>
        {!isLoaded ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
            <LoadingSpinner text="Loading map…" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={14}
            options={HYBRID_OPTIONS}
            onLoad={onMapLoad}
            onClick={handleMapClick}
          >
            {/* User position */}
            {userPos && !directions && (
              <MarkerF position={userPos}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10, fillColor: '#3b82f6', fillOpacity: 1,
                  strokeColor: '#fff', strokeWeight: 2,
                }}
              />
            )}

            {/* Pinned destination */}
            {pinnedLoc && !directions && (
              <MarkerF position={pinnedLoc}
                icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
              />
            )}

            {/* Route */}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  polylineOptions: { strokeColor: '#ef4444', strokeWeight: 5, strokeOpacity: 0.9 },
                }}
              />
            )}
          </GoogleMap>
        )}

        {/* Pin mode overlay hint */}
        {pinMode && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--primary)', color: '#fff', padding: '8px 16px',
            borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap',
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
              style={{ boxShadow: 'var(--shadow-lg)' }}>
              <Navigation size={16} /> Open Turn-by-Turn in Google Maps
            </button>
          </div>
        )}

        {/* Center on me button */}
        {isLoaded && userPos && (
          <button
            onClick={() => mapRef.current?.panTo(userPos)}
            style={{
              position: 'absolute', bottom: navigating ? 70 : 20, right: 16,
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: 'var(--shadow-md)',
            }}
          >
            <Crosshair size={20} color="var(--primary)" />
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Search, X, Navigation, Crosshair, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import type { NearbyPlace, PlaceCategory } from '../types';
import { PLACE_CATEGORY_META } from '../types';
import { cachePlaces, getCachedPlaces } from '../services/offlineCache';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CATEGORIES = Object.entries(PLACE_CATEGORY_META) as [PlaceCategory, typeof PLACE_CATEGORY_META[PlaceCategory]][];
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

const PLACE_TYPES_NEW: Record<PlaceCategory, string[]> = {
  hospital:  ['hospital', 'medical_clinic', 'pharmacy'],
  police:    ['police'],
  petrol:    ['gas_station'],
  puncture:  ['car_repair'],
  towing:    ['car_repair'],
  food:      ['restaurant', 'fast_food_restaurant', 'cafe'],
  washroom:  ['public_bathroom', 'rest_stop'],
  showroom:  ['car_dealer', 'auto_parts_store'],
};

async function fetchFromPlacesAPINew(lat: number, lng: number, cat: PlaceCategory, radiusMeters = 8000): Promise<NearbyPlace[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const types = PLACE_TYPES_NEW[cat];
  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  const fieldMask = [
    'places.id', 'places.displayName', 'places.location', 'places.formattedAddress',
    'places.rating', 'places.regularOpeningHours', 'places.photos', 'places.types',
    'places.shortFormattedAddress', 'places.internationalPhoneNumber', 'places.userRatingCount',
    'places.priceLevel', 'places.businessStatus',
  ].join(',');

  const body = {
    includedTypes: types,
    maxResultCount: 20,
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } },
    rankPreference: 'DISTANCE',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Places API (New) error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const places: NearbyPlace[] = (data.places || []).map((p: any) => {
    const pLat = p.location?.latitude ?? 0;
    const pLng = p.location?.longitude ?? 0;
    const photoRef = p.photos?.[0]?.name;
    const photoUrl = photoRef ? `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${apiKey}` : undefined;

    return {
      id: p.id ?? Math.random().toString(36).slice(2),
      name: p.displayName?.text ?? 'Unknown',
      lat: pLat,
      lng: pLng,
      category: cat,
      address: p.shortFormattedAddress ?? p.formattedAddress ?? '',
      rating: p.rating,
      ratingCount: p.userRatingCount,
      distance: haversine(lat, lng, pLat, pLng),
      isOpen: p.regularOpeningHours?.openNow,
      photoUrl,
      phone: p.internationalPhoneNumber,
      businessStatus: p.businessStatus,
    } as NearbyPlace;
  });

  return places.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export default function NearMe() {
  const [params] = useSearchParams();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const [activeCat, setActiveCat] = useState<PlaceCategory>((params.get('cat') as PlaceCategory) || 'hospital');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Name filter
  const [searchTxt, setSearchTxt] = useState('');
  
  // Custom location search
  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const errorMsgRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const activeLat = customCoords?.lat ?? geo.lat;
  const activeLng = customCoords?.lng ?? geo.lng;
  const mapCenter = activeLat && activeLng ? { lat: activeLat, lng: activeLng } : DEFAULT_CENTER;

  const { isLoaded, loadError } = useGoogleMapsLoader();

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // PlacesService and AutocompleteService are deprecated for new customers
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
        // Map new API format to old AutocompletePrediction format for UI compatibility
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

      // Reset token after use
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();

      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        setCustomCoords({ lat, lng });
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(14);
      }
    } catch (err) {
      console.error('Failed to get place details via new API:', err);
    }
  }, [isLoaded]);

  const handleSearchGo = useCallback(() => {
    if (!inputVal.trim() || !isLoaded) return;
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }
    setShowSuggestions(false);
    const gc = new google.maps.Geocoder();
    gc.geocode({ address: inputVal }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setInputVal(results[0].formatted_address || inputVal);
        setCustomCoords({ lat, lng });
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(14);
      } else {
        alert('Location not found. Please select from suggestions or try a different search.');
      }
    });
  }, [inputVal, suggestions, isLoaded, selectSuggestion]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setCustomCoords({ lat, lng });
    
    const gc = new google.maps.Geocoder();
    gc.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setInputVal(results[0].formatted_address);
      } else {
        setInputVal(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  }, []);

  const fetchPlaces = useCallback(async (cat: PlaceCategory) => {
    const lat = activeLat;
    const lng = activeLng;
    if (!lat || !lng) {
      setErrorMsg('Location not available yet. Allow location access or search a location.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const queryKey = `new_${lat.toFixed(3)}_${lng.toFixed(3)}_${cat}`;
    const cached = await getCachedPlaces(queryKey);
    if (cached && cached.length > 0) {
      setPlaces(cached);
      setLoading(false);
      return;
    }

    try {
      const list = await fetchFromPlacesAPINew(lat, lng, cat);
      if (list.length === 0) {
        const wider = await fetchFromPlacesAPINew(lat, lng, cat, 20000);
        if (wider.length > 0) {
          cachePlaces(queryKey, wider);
          setPlaces(wider);
        } else {
          setPlaces([]);
          setErrorMsg(`No ${PLACE_CATEGORY_META[cat].label.toLowerCase()} found within 20km.`);
        }
      } else {
        cachePlaces(queryKey, list);
        setPlaces(list);
      }
    } catch (err: any) {
      console.error('Places API failed:', err);
      setErrorMsg(`Could not fetch places: ${err?.message ?? 'Unknown error'}`);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [activeLat, activeLng]);

  useEffect(() => {
    if (activeLat && activeLng) {
      setPlaces([]);
      fetchPlaces(activeCat);
    }
  }, [activeCat, activeLat, activeLng, fetchPlaces]);

  function startNavigation(place: NearbyPlace) {
    if (!activeLat || !activeLng) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${activeLat},${activeLng}&destination=${place.lat},${place.lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  const filtered = searchTxt
    ? places.filter(p => p.name.toLowerCase().includes(searchTxt.toLowerCase()) || p.address?.toLowerCase().includes(searchTxt.toLowerCase()))
    : places;

  function markerIcon(cat: PlaceCategory, isSelected: boolean) {
    const meta = PLACE_CATEGORY_META[cat];
    const size = isSelected ? 44 : 36;
    const pinH = isSelected ? 52 : 42;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinH}" viewBox="0 0 ${size} ${pinH}">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
      </filter>
      <path d="M${size / 2} 0C${size * 0.224} 0 0 ${pinH * 0.346} 0 ${pinH * 0.577}c0 ${pinH * 0.462} ${size / 2} ${pinH * 0.423} ${size / 2} ${pinH * 0.423}S${size} ${pinH * 1.038} ${size} ${pinH * 0.577}C${size} ${pinH * 0.346} ${size * 0.776} 0 ${size / 2} 0z" fill="${meta.color}" filter="url(#shadow)"/>
      <circle cx="${size / 2}" cy="${pinH * 0.42}" r="${size * 0.3}" fill="white" opacity="0.92"/>
      <text x="${size / 2}" y="${pinH * 0.48}" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.36}" font-family="sans-serif">${meta.icon}</text>
    </svg>`;
    return {
      url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, pinH),
      anchor: new google.maps.Point(size / 2, pinH),
    };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', minHeight: 0 }}>
      {/* ── Main Content Area ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: window.innerWidth < 1024 ? 'column' : 'row' }}>
        
        {/* Map Section (70% on desktop) */}
        <div style={{ flex: '1 1 70%', position: 'relative', minHeight: 300 }}>
          {loadError ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FEE2E2', color: '#EF4444', padding: 20, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', marginBottom: 8 }}>
                <AlertTriangle size={24} style={{ marginRight: 8 }} /> Failed to load Google Maps
              </div>
              <div style={{ fontSize: '0.9rem' }}>{loadError instanceof Error ? loadError.message : String(loadError)}</div>
            </div>
          ) : !isLoaded ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={14}
              options={{
                styles: MAP_STYLES,
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: true,
              }}
              onLoad={onMapLoad}
              onClick={handleMapClick}
            >
              {/* User/Custom Location Marker */}
              {activeLat && activeLng && (
                <MarkerF
                  position={{ lat: activeLat, lng: activeLng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#3B82F6',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                  }}
                  zIndex={100}
                />
              )}

              {/* Place Markers */}
              {filtered.map(place => (
                <MarkerF
                  key={place.id}
                  position={{ lat: place.lat, lng: place.lng }}
                  icon={markerIcon(place.category, selected?.id === place.id)}
                  onClick={() => {
                    setSelected(place);
                    mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
                  }}
                  zIndex={selected?.id === place.id ? 50 : 10}
                >
                  {selected?.id === place.id && (
                    <InfoWindowF
                      position={{ lat: place.lat, lng: place.lng }}
                      onCloseClick={() => setSelected(null)}
                      options={{ pixelOffset: new google.maps.Size(0, -45) }}
                    >
                      <div style={{ padding: '0.25rem', maxWidth: 220, color: '#0F172A', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 700 }}>{place.name}</h4>
                        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748B' }}>{place.address}</p>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => startNavigation(place)}
                        >
                          <Navigation size={12} /> Navigate
                        </button>
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              ))}
            </GoogleMap>
          )}

          {/* Recenter button */}
          <button
            onClick={async () => {
              setCustomCoords(null);
              setInputVal('');
              const fresh = await geo.refresh();
              if (fresh) {
                mapRef.current?.panTo({ lat: fresh.lat, lng: fresh.lng });
                mapRef.current?.setZoom(15);
              } else if (geo.error) {
                alert(geo.error);
              }
            }}
            style={{
              position: 'absolute', bottom: 20, right: 20,
              width: 44, height: 44, borderRadius: '50%', background: '#fff',
              border: 'none', boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4F46E5', cursor: 'pointer', zIndex: 10,
            }}
            title="Center on my location"
          >
            <Crosshair size={20} />
          </button>
        </div>

        {/* List Section (30% on desktop) */}
        <div style={{
          flex: '1 1 30%', overflowY: 'auto', background: '#F8FAFC',
          borderLeft: window.innerWidth >= 1024 ? '1px solid #E2E8F0' : 'none',
          display: 'flex', flexDirection: 'column'
        }}>
          {/* Controls Panel Inside List Area */}
          <div style={{ background: '#fff', padding: '1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 10, flexShrink: 0 }}>
            {/* Custom Location Search */}
            <div style={{ position: 'relative' }}>
              <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4F46E5', zIndex: 1 }} />
              <input
                className="input"
                style={{ paddingLeft: '2.5rem', width: '100%', fontSize: '0.85rem' }}
                placeholder="Search a location..."
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchGo(); if (e.key === 'Escape') setShowSuggestions(false); }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 'var(--r-md)', marginTop: 4, 
                  boxShadow: '0 10px 25px rgba(15,23,42,0.1)', overflow: 'hidden'
                }}>
                  {suggestions.map(pred => (
                    <div
                      key={pred.place_id}
                      onMouseDown={() => selectSuggestion(pred)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'flex-start', gap: 10 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <MapPin size={15} style={{ color: '#94A3B8', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {pred.structured_formatting.main_text}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {pred.structured_formatting.secondary_text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Categories */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {CATEGORIES.map(([key, meta]) => {
                const isActive = activeCat === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCat(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', 
                      borderRadius: 'var(--r-full)', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.75rem',
                      border: isActive ? `1px solid ${meta.color}` : '1px solid #E2E8F0',
                      background: isActive ? `${meta.color}11` : '#F8FAFC',
                      color: isActive ? meta.color : '#64748B',
                      transition: 'all 0.15s', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Name Filter */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text" className="input"
                value={searchTxt} onChange={e => setSearchTxt(e.target.value)}
                placeholder="Filter results by name..."
                style={{ paddingLeft: '2.5rem', paddingRight: searchTxt ? '2.5rem' : '1rem', width: '100%', height: '2.25rem', fontSize: '0.8rem' }}
              />
              {searchTxt && (
                <button 
                  onClick={() => setSearchTxt('')} 
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: '1rem', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                {PLACE_CATEGORY_META[activeCat].label}s Nearby
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="badge" style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.7rem' }}>
                  {filtered.length} found
                </span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => fetchPlaces(activeCat)} title="Refresh" disabled={loading}>
                  <RefreshCw size={14} className={loading ? "animate-spin text-accent" : "text-textMuted"} />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 'var(--r-md)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {errorMsg}
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                <LoadingSpinner />
              </div>
            ) : filtered.length === 0 && !errorMsg ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748B', background: '#fff', borderRadius: 'var(--r-md)', border: '1px dashed #CBD5E1' }}>
                <MapPin size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                No results found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map(place => (
                  <div
                    key={place.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: selected?.id === place.id ? `2px solid ${PLACE_CATEGORY_META[place.category].color}` : '1px solid #E2E8F0',
                      padding: '0.75rem', display: 'flex', gap: '0.75rem', transition: 'all 0.15s',
                      transform: selected?.id === place.id ? 'translateY(-2px)' : 'none',
                    }}
                    onClick={() => {
                      setSelected(place);
                      mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
                      if (window.innerWidth < 1024) {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    {place.photoUrl ? (
                      <img src={place.photoUrl} alt={place.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        {PLACE_CATEGORY_META[place.category].icon}
                      </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.15rem' }} className="truncate">
                        {place.name}
                      </h3>
                      <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {place.distance !== undefined && (
                          <span style={{ fontWeight: 700, color: '#4F46E5' }}>{formatDist(place.distance)}</span>
                        )}
                        {place.isOpen !== undefined && (
                          <>
                            <span>•</span>
                            <span style={{ color: place.isOpen ? '#059669' : '#DC2626', fontWeight: 600 }}>
                              {place.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </>
                        )}
                        {place.rating !== undefined && (
                          <>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#D97706', fontWeight: 600 }}>
                              ⭐ {place.rating} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({place.ratingCount})</span>
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, justifyContent: 'center', padding: '0.25rem', height: '1.75rem', fontSize: '0.75rem' }}
                          onClick={e => { e.stopPropagation(); startNavigation(place); }}
                        >
                          <Navigation size={12} /> Nav
                        </button>
                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, justifyContent: 'center', padding: '0.25rem', height: '1.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}
                            onClick={e => e.stopPropagation()}
                          >
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

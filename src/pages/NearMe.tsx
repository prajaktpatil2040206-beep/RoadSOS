import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleMap, MarkerF, InfoWindowF, Autocomplete } from '@react-google-maps/api';
import { Search, X, Navigation, Star, Crosshair, MapPin } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import type { NearbyPlace, PlaceCategory } from '../types';
import { PLACE_CATEGORY_META } from '../types';
import { cachePlaces, getCachedPlaces } from '../services/offlineCache';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CATEGORIES = Object.entries(PLACE_CATEGORY_META) as [PlaceCategory, typeof PLACE_CATEGORY_META[PlaceCategory]][];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

// Map category to Google Places type
const PLACE_TYPES: Record<PlaceCategory, string[]> = {
  hospital: ['hospital', 'health'],
  police: ['police'],
  petrol: ['gas_station'],
  puncture: ['car_repair'],
  towing: ['car_repair'],
  food: ['restaurant', 'food'],
  washroom: ['lodging', 'public_toilets'],
  showroom: ['car_dealer'],
};

export default function NearMe() {
  const [params] = useSearchParams();
  const geo = useGeolocation();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [activeCat, setActiveCat] = useState<PlaceCategory>(
    (params.get('cat') as PlaceCategory) || 'hospital'
  );
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTxt, setSearchTxt] = useState('');
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap' | 'terrain'>('hybrid');
  const [error, setError] = useState('');

  // Custom location search coords (override)
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const activeLat = customCoords ? customCoords.lat : geo.lat;
  const activeLng = customCoords ? customCoords.lng : geo.lng;

  const { isLoaded } = useGoogleMapsLoader();

  const fetchPlaces = useCallback(async (cat: PlaceCategory) => {
    if (!activeLat || !activeLng || !isLoaded) return;
    setLoading(true);
    setError('');

    const queryKey = `${activeLat.toFixed(3)}_${activeLng.toFixed(3)}_${cat}_5000`;
    const cached = await getCachedPlaces(queryKey);
    if (cached && cached.length > 0) {
      setPlaces(cached);
      setLoading(false);
      return;
    }

    try {
      const meta = PLACE_CATEGORY_META[cat];
      const types = PLACE_TYPES[cat];
      const mapDiv = (mapRef.current ? mapRef.current.getDiv() : document.createElement('div')) as HTMLDivElement;
      const service = new google.maps.places.PlacesService(mapDiv);

      // Use keyword search for better results
      service.nearbySearch({
        location: new google.maps.LatLng(activeLat, activeLng),
        radius: 8000,
        keyword: meta.keyword,
        type: types[0] as any,
      }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const list: NearbyPlace[] = results.slice(0, 25).map(p => ({
            id: p.place_id ?? Math.random().toString(36).slice(2),
            name: p.name ?? 'Unknown',
            lat: p.geometry?.location?.lat() ?? 0,
            lng: p.geometry?.location?.lng() ?? 0,
            category: cat,
            address: p.vicinity ?? '',
            rating: p.rating,
            distance: haversine(activeLat!, activeLng!, p.geometry?.location?.lat() ?? 0, p.geometry?.location?.lng() ?? 0),
            isOpen: p.opening_hours?.isOpen?.(),
            photoUrl: p.photos?.[0]?.getUrl({ maxWidth: 400 }),
          }));
          list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
          cachePlaces(queryKey, list);
          setPlaces(list);
          setError('');
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          // Try with just keyword, no type filter
          service.nearbySearch({
            location: new google.maps.LatLng(activeLat!, activeLng!),
            radius: 10000,
            keyword: meta.keyword,
          }, (results2, status2) => {
            if (status2 === google.maps.places.PlacesServiceStatus.OK && results2) {
              const list: NearbyPlace[] = results2.slice(0, 25).map(p => ({
                id: p.place_id ?? Math.random().toString(36).slice(2),
                name: p.name ?? 'Unknown',
                lat: p.geometry?.location?.lat() ?? 0,
                lng: p.geometry?.location?.lng() ?? 0,
                category: cat,
                address: p.vicinity ?? '',
                rating: p.rating,
                distance: haversine(activeLat!, activeLng!, p.geometry?.location?.lat() ?? 0, p.geometry?.location?.lng() ?? 0),
                isOpen: p.opening_hours?.isOpen?.(),
                photoUrl: p.photos?.[0]?.getUrl({ maxWidth: 400 }),
              }));
              list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
              cachePlaces(queryKey, list);
              setPlaces(list);
            } else {
              setPlaces([]);
              setError('No places found nearby. Try a different category.');
            }
            setLoading(false);
          });
          return;
        } else {
          setPlaces([]);
          setError(`Search failed: ${status}. Check your internet connection.`);
        }
        setLoading(false);
      });
    } catch (err) {
      setLoading(false);
      setError('Failed to fetch places. Please check your connection.');
    }
  }, [activeLat, activeLng, isLoaded]);

  useEffect(() => {
    if (isLoaded && activeLat && activeLng) {
      setPlaces([]);
      fetchPlaces(activeCat);
    }
  }, [activeCat, activeLat, activeLng, isLoaded]);

  function startNavigation(place: NearbyPlace) {
    if (!activeLat || !activeLng) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${activeLat},${activeLng}&destination=${place.lat},${place.lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setCustomCoords({ lat, lng });
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(15);
      }
    }
  };

  const filtered = searchTxt
    ? places.filter(p => p.name.toLowerCase().includes(searchTxt.toLowerCase()) || p.address?.toLowerCase().includes(searchTxt.toLowerCase()))
    : places;

  const center = activeLat && activeLng ? { lat: activeLat, lng: activeLng } : { lat: 20.5937, lng: 78.9629 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Top bar */}
      <div style={{
        padding: '10px 14px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8,
        flexShrink: 0,
      }}>
        {/* Dual Search Fields */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Search/Filter by name */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ paddingLeft: 38, paddingRight: searchTxt ? 38 : 14, height: 36 }}
              value={searchTxt}
              onChange={e => setSearchTxt(e.target.value)}
              placeholder="Filter results by name…"
            />
            {searchTxt && (
              <button onClick={() => setSearchTxt('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Custom Location Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none', zIndex: 1 }} />
            {isLoaded ? (
              <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                <input
                  className="input"
                  style={{ paddingLeft: 38, paddingRight: customCoords ? 38 : 14, height: 36, width: '100%' }}
                  placeholder="Search/Set another location…"
                />
              </Autocomplete>
            ) : (
              <input
                className="input"
                style={{ paddingLeft: 38, height: 36, width: '100%' }}
                placeholder="Loading maps location search…"
                disabled
              />
            )}
            {customCoords && (
              <button
                onClick={() => {
                  setCustomCoords(null);
                  if (geo.lat && geo.lng) {
                    mapRef.current?.panTo({ lat: geo.lat, lng: geo.lng });
                  }
                }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', zIndex: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIES.map(([cat, meta]) => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 'var(--r-full)', border: 'none',
                background: activeCat === cat ? meta.color : 'var(--bg-card2)',
                color: activeCat === cat ? '#fff' : 'var(--text-2)',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>

        {/* Map type */}
        <div style={{ display: 'flex', gap: 5 }}>
          {(['hybrid', 'roadmap', 'terrain'] as const).map(t => (
            <button key={t} onClick={() => setMapType(t)}
              style={{
                padding: '3px 10px', borderRadius: 'var(--r-sm)', border: 'none',
                background: mapType === t ? 'var(--primary)' : 'var(--bg-card2)',
                color: mapType === t ? '#fff' : 'var(--text-2)',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer',
                textTransform: 'capitalize',
              }}>
              {t === 'hybrid' ? '🛰 Satellite' : t === 'roadmap' ? '🗺 Road' : '⛰ Terrain'}
            </button>
          ))}
          {loading && <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', alignSelf: 'center', marginLeft: 8 }}>Searching…</span>}
        </div>
      </div>

      {/* Map + List */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {!isLoaded || !activeLat ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
              <LoadingSpinner text={!isLoaded ? 'Loading map…' : 'Detecting your location…'} />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={14}
              mapTypeId={mapType}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                fullscreenControl: false,
                mapTypeControl: false,
              }}
              onLoad={m => { mapRef.current = m; }}
            >
              {/* GPS User location */}
              {geo.lat && geo.lng && (
                <MarkerF
                  position={{ lat: geo.lat, lng: geo.lng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 9, fillColor: '#3b82f6', fillOpacity: 0.9,
                    strokeColor: '#fff', strokeWeight: 2,
                  }}
                  zIndex={990}
                  title="Your Actual Location"
                />
              )}

              {/* Searched Custom Location target pin */}
              {customCoords && (
                <MarkerF
                  position={customCoords}
                  zIndex={995}
                  title="Search Location Center"
                  icon={{
                    url: `data:image/svg+xml,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3" fill="%2310b981"></circle>
                      </svg>
                    `)}`,
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16),
                  }}
                />
              )}

              {/* Place markers */}
              {filtered.map((place, idx) => {
                const meta = PLACE_CATEGORY_META[place.category];
                return (
                  <MarkerF
                    key={place.id}
                    position={{ lat: place.lat, lng: place.lng }}
                    onClick={() => {
                      setSelected(place);
                      mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
                    }}
                    title={place.name}
                    zIndex={selected?.id === place.id ? 100 : idx}
                    icon={{
                      url: `data:image/svg+xml,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
                          <path d="M18 0C8.06 0 0 8.06 0 18c0 12 18 24 18 24S36 30 36 18C36 8.06 27.94 0 18 0z" fill="${meta.color}" opacity="0.95"/>
                          <text x="18" y="22" text-anchor="middle" font-size="14" font-family="sans-serif">${meta.icon}</text>
                        </svg>
                      `)}`,
                      scaledSize: new google.maps.Size(36, 42),
                      anchor: new google.maps.Point(18, 42),
                    }}
                  />
                );
              })}

              {/* Info window */}
              {selected && (
                <InfoWindowF
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div style={{ maxWidth: 240, fontFamily: 'Inter, sans-serif', color: '#111' }}>
                    {selected.photoUrl && (
                      <img src={selected.photoUrl} alt={selected.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                    )}
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 3 }}>{selected.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 6 }}>{selected.address}</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', marginBottom: 8, flexWrap: 'wrap' }}>
                      {selected.rating && <span>⭐ {selected.rating}</span>}
                      {selected.distance && <span>📍 {formatDist(selected.distance)}</span>}
                      {selected.isOpen !== undefined && (
                        <span style={{ color: selected.isOpen ? '#22c55e' : '#ef4444' }}>
                          {selected.isOpen ? '🟢 Open' : '🔴 Closed'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => startNavigation(selected)}
                      style={{ width: '100%', padding: '7px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                      🧭 Navigate Here
                    </button>
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}

          {/* Center on me */}
          {isLoaded && geo.lat && (
            <button
              onClick={() => {
                setCustomCoords(null);
                mapRef.current?.panTo({ lat: geo.lat!, lng: geo.lng! });
                mapRef.current?.setZoom(15);
              }}
              style={{
                position: 'absolute', bottom: 16, right: 16,
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--bg-card)', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: 'var(--shadow-md)',
              }}
              title="Center on my GPS location"
            >
              <Crosshair size={20} color="var(--primary)" />
            </button>
          )}
        </div>

        {/* Side list */}
        <div style={{ width: 290, overflowY: 'auto', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>
            {loading ? '⏳ Searching…' : error ? '⚠️ Error' : `${filtered.length} results nearby`}
          </div>

          {error && !loading && (
            <div style={{ padding: '16px 14px', color: 'var(--orange)', fontSize: '0.82rem' }}>
              {error}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                onClick={() => fetchPlaces(activeCat)}>Retry</button>
            </div>
          )}

          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner text="Finding nearby…" />
            </div>
          ) : !error && filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: '0.85rem' }}>No {PLACE_CATEGORY_META[activeCat].label.toLowerCase()} found in 8km radius</div>
            </div>
          ) : (
            filtered.map(place => {
              const meta = PLACE_CATEGORY_META[place.category];
              return (
                <div
                  key={place.id}
                  onClick={() => { setSelected(place); mapRef.current?.panTo({ lat: place.lat, lng: place.lng }); mapRef.current?.setZoom(16); }}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: selected?.id === place.id ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selected?.id === place.id ? 'var(--bg-hover)' : 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 'var(--r-md)',
                      background: `${meta.color}22`, border: `1px solid ${meta.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }} className="truncate">{place.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', marginBottom: 4 }} className="truncate">{place.address}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {place.distance && <span style={{ color: 'var(--blue)' }}>📍 {formatDist(place.distance)}</span>}
                        {place.rating && <span>⭐ {place.rating}</span>}
                        {place.isOpen !== undefined && (
                          <span style={{ color: place.isOpen ? 'var(--green)' : 'var(--red)' }}>
                            {place.isOpen ? '● Open' : '● Closed'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); startNavigation(place); }}
                        style={{
                          marginTop: 6, padding: '4px 10px',
                          background: 'var(--primary)', color: '#fff', border: 'none',
                          borderRadius: 'var(--r-sm)', fontSize: '0.72rem', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Navigation size={10} /> Navigate
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

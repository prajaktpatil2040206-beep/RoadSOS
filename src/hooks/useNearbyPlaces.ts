import { useState, useCallback } from 'react';
import type { NearbyPlace, PlaceCategory } from '../types';
import { cachePlaces, getCachedPlaces } from '../services/offlineCache';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function useNearbyPlaces() {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaces = useCallback(async (
    lat: number,
    lng: number,
    categories: PlaceCategory[],
    radius = 5000
  ) => {
    setLoading(true);
    setError(null);

    const allPlaces: NearbyPlace[] = [];

    for (const category of categories) {
      const queryKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${category}_${radius}`;

      // Try cache first
      const cached = await getCachedPlaces(queryKey);
      if (cached) { allPlaces.push(...cached); continue; }

      try {
        // Use Google Places Nearby Search via fetch
        const keyword = getCategoryKeyword(category);
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${MAPS_KEY}`;
        
        // Since direct API call has CORS issues from browser, use Places JS SDK approach
        // We'll use the Places library loaded via @react-google-maps/api
        const fetched = await fetchViaPlacesAPI(lat, lng, keyword, radius, category);
        await cachePlaces(queryKey, fetched);
        allPlaces.push(...fetched);
      } catch (e) {
        console.warn(`Failed to fetch ${category}:`, e);
      }
    }

    setPlaces(allPlaces);
    setLoading(false);
  }, []);

  return { places, fetchPlaces, loading, error, setPlaces };
}

function getCategoryKeyword(category: PlaceCategory): string {
  const map: Record<PlaceCategory, string> = {
    hospital: 'hospital',
    police: 'police station',
    petrol: 'petrol pump gas station',
    puncture: 'tyre puncture shop',
    towing: 'towing service',
    food: 'restaurant',
    washroom: 'toilet washroom',
    showroom: 'car showroom',
  };
  return map[category];
}

function fetchViaPlacesAPI(
  lat: number,
  lng: number,
  keyword: string,
  radius: number,
  category: PlaceCategory
): Promise<NearbyPlace[]> {
  return new Promise((resolve, reject) => {
    if (!(window as any).google?.maps?.places) {
      reject(new Error('Google Maps Places not loaded'));
      return;
    }

    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(lat, lng),
      radius,
      keyword,
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const places: NearbyPlace[] = results.slice(0, 15).map(p => {
          const plLat = p.geometry?.location?.lat() ?? 0;
          const plLng = p.geometry?.location?.lng() ?? 0;
          const dist = haversine(lat, lng, plLat, plLng);
          return {
            id: p.place_id ?? Math.random().toString(36).slice(2),
            name: p.name ?? 'Unknown',
            lat: plLat,
            lng: plLng,
            category,
            address: p.vicinity ?? '',
            rating: p.rating,
            distance: dist,
            isOpen: p.opening_hours?.isOpen?.() ?? undefined,
            photoUrl: p.photos?.[0]?.getUrl({ maxWidth: 400 }),
          };
        });
        resolve(places);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(`Places API: ${status}`));
      }
    });
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

import { useState, useEffect, useRef } from 'react';

interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;   // m/s
  heading: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, accuracy: null,
    speed: null, heading: null, error: null, loading: true,
  });
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }));
      return;
    }

    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 };

    const success = (pos: GeolocationPosition) => {
      setState({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        error: null,
        loading: false,
      });
    };

    const fail = (err: GeolocationPositionError) => {
      setState(s => ({ ...s, error: err.message, loading: false }));
    };

    watchId.current = navigator.geolocation.watchPosition(success, fail, opts);
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  return state;
}

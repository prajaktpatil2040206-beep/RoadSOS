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
  const isPreciseRef = useRef<boolean>(false);

  useEffect(() => {
    let timeoutId: number | null = null;

    const fetchIpLocation = async () => {
      if (isPreciseRef.current) return;
      try {
        const res = await fetch('https://freeipapi.com/api/json');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude && !isPreciseRef.current) {
            setState({
              lat: Number(data.latitude),
              lng: Number(data.longitude),
              accuracy: 15000,
              speed: null,
              heading: null,
              error: 'Rough location from IP address.',
              loading: false,
            });
            return true;
          }
        }
      } catch (e) {
        try {
          const res2 = await fetch('https://ipapi.co/json/');
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.latitude && data2.longitude && !isPreciseRef.current) {
              setState({
                lat: data2.latitude,
                lng: data2.longitude,
                accuracy: 15000,
                speed: null,
                heading: null,
                error: 'Rough location from IP address.',
                loading: false,
              });
              return true;
            }
          }
        } catch (e2) {
          console.warn('IP geolocation failed:', e2);
        }
      }
      return false;
    };

    if (!navigator.geolocation) {
      fetchIpLocation().then(success => {
        if (!success) {
          setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }));
        }
      });
      return;
    }

    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 6000 };

    const success = (pos: GeolocationPosition) => {
      isPreciseRef.current = true;
      if (timeoutId) window.clearTimeout(timeoutId);
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

    const fail = async (err: GeolocationPositionError) => {
      console.warn('GPS location failed:', err.message);
      if (isPreciseRef.current) return;
      const ok = await fetchIpLocation();
      if (!ok) {
        setState(s => ({ ...s, error: err.message, loading: false }));
      }
    };

    // Set a 3.5s timeout to trigger IP fallback if GPS is taking too long
    timeoutId = window.setTimeout(() => {
      if (!isPreciseRef.current) {
        fetchIpLocation();
      }
    }, 3500);

    watchId.current = navigator.geolocation.watchPosition(success, fail, opts);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  return state;
}

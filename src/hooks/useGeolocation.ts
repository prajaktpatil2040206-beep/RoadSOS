import { useState, useEffect, useRef, useCallback } from 'react';

interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;   // m/s
  heading: number | null;
  error: string | null;
  loading: boolean;
  permission: PermissionState | 'unknown';
}

interface GeoHook extends GeoState {
  refresh: () => Promise<{ lat: number; lng: number } | null>;
}

export function useGeolocation(): GeoHook {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, accuracy: null,
    speed: null, heading: null, error: null, loading: true,
    permission: 'unknown'
  });
  const watchId = useRef<number | null>(null);

  // Monitor Permissions API for mid-session changes (e.g. user clicks lock icon and denies)
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setState(s => ({ ...s, permission: result.state }));
        result.onchange = () => {
          setState(s => ({ ...s, permission: result.state }));
        };
      }).catch(err => console.warn('Permissions API not supported', err));
    }
  }, []);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setState(s => ({
      ...s,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      error: null,
      loading: false,
    }));
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn('GPS location failed:', err.message);
    let errMsg = 'Location access failed.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errMsg = 'Location permission denied. Please enable it in browser settings.';
        break;
      case err.POSITION_UNAVAILABLE:
        errMsg = 'Location information is unavailable.';
        break;
      case err.TIMEOUT:
        errMsg = 'The request to get user location timed out.';
        break;
    }
    setState(s => ({ ...s, error: errMsg, loading: false }));
  }, []);

  // Background passive watch (handles user physically walking around)
  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation is not supported by your browser.', loading: false }));
      return;
    }

    // maximumAge: 10000 (allow up to 10s old cache) to prevent strict timeouts
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 };
    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, opts);

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [handleSuccess, handleError]);

  // Active Hardware Refresh (bypasses OS stale caches by forcing a fresh getCurrentPosition)
  const refresh = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setState(s => ({ ...s, error: 'Geolocation is not supported.', loading: false }));
        resolve(null);
        return;
      }

      setState(s => ({ ...s, loading: true }));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          handleError(err);
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
      );
    });
  }, [handleSuccess, handleError]);

  return { ...state, refresh };
}

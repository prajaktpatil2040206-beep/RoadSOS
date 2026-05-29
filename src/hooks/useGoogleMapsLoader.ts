import { useJsApiLoader } from '@react-google-maps/api';
import { useEffect, useState } from 'react';

const GOOGLE_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

export function useGoogleMapsLoader() {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Catch global Google Maps auth/billing failures
    (window as any).gm_authFailure = () => {
      console.error('Google Maps API Failure: Check API key, API restrictions, or Billing status. Ensure Maps JS, Places, Geocoding, and Directions APIs are enabled.');
      setAuthError('Google Maps API Error: Authentication, Restrictions, or Billing issue detected.');
    };
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  return { isLoaded, loadError: loadError || (authError ? new Error(authError) : undefined) };
}

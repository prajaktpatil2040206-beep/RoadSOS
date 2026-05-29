import { useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

export function useGoogleMapsLoader() {
  return useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
}

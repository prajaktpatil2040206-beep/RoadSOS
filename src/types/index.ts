// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'hospital' | 'police' | 'fire' | 'towing' | 'mechanic';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  country?: string;
  photoUrl?: string;
  photoBase64?: string;      // Base64-encoded profile photo (stored in Firebase RTDB)
  sosId?: string;            // Unique RoadSOS ID e.g. RSOS-RAJ-4821
  aadharNumber?: string;
  drivingLicense?: string;
  vehicles?: Vehicle[];
  emergencyContacts?: EmergencyContact[];
  medicalInfo?: MedicalInfo;
  // Responder-specific
  responderName?: string;
  responderType?: UserRole;
  responderAddress?: string;
  responderPhone?: string;
  responderCapacity?: number;
  responderLat?: number;
  responderLng?: number;
  createdAt: number;
}

export interface Vehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  color?: string;
  registration: string;
  insurance?: string;
  licenseNumber?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface MedicalInfo {
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
  organDonor?: boolean;
}

// ─── Anomaly / Incident ───────────────────────────────────────────────────────

export type AnomalySeverity = 1 | 2 | 3 | 4 | 5;

export type AnomalyCategory =
  | 'vehicle_collision'
  | 'bike_accident'
  | 'pedestrian_hit'
  | 'vehicle_breakdown'
  | 'fire'
  | 'road_hazard'
  | 'other';

export type AnomalyStatus = 'reported' | 'responding' | 'resolved';

export interface AnomalyLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface AnomalyResponse {
  uid: string;
  responderName: string;
  responderType: UserRole;
  status: 'offered' | 'en_route' | 'arrived' | 'declined';
  eta?: number;
  updatedAt: number;
}

export interface Anomaly {
  id: string;
  location: AnomalyLocation;
  severity: AnomalySeverity;
  category: AnomalyCategory;
  description: string;
  reporterId: string;
  reporterName: string;
  mediaUrl?: string;
  status: AnomalyStatus;
  responses?: Record<string, AnomalyResponse>;
  resolvedAt?: number;
  createdAt: number;
}

// ─── Nearby Places ────────────────────────────────────────────────────────────

export type PlaceCategory =
  | 'hospital'
  | 'police'
  | 'petrol'
  | 'puncture'
  | 'towing'
  | 'food'
  | 'washroom'
  | 'showroom';

export interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  address?: string;
  rating?: number;
  ratingCount?: number;
  distance?: number;
  phone?: string;
  isOpen?: boolean;
  photoUrl?: string;
  businessStatus?: string;
}

// ─── Journey ──────────────────────────────────────────────────────────────────

export interface JourneyWaypoint {
  label: string;
  lat: number;
  lng: number;
}

export interface Journey {
  id: string;
  origin: JourneyWaypoint;
  destination: JourneyWaypoint;
  distance: number;
  duration: number;
  cachedAt: number;
}

// ─── Metadata Constants ───────────────────────────────────────────────────────

export const SEVERITY_META: Record<
  AnomalySeverity,
  { label: string; color: string; bg: string; description: string }
> = {
  1: { label: 'Minor', color: '#22c55e', bg: '#052e16', description: 'No injuries, minor damage' },
  2: { label: 'Moderate', color: '#84cc16', bg: '#1a2e05', description: 'Minor injuries, ambulance advised' },
  3: { label: 'Serious', color: '#eab308', bg: '#422006', description: 'Serious injuries, immediate help' },
  4: { label: 'Critical', color: '#f97316', bg: '#431407', description: 'Life-threatening injuries' },
  5: { label: 'Mass Casualty', color: '#ef4444', bg: '#450a0a', description: 'Multiple victims, major collision' },
};

export const CATEGORY_META: Record<AnomalyCategory, { label: string; icon: string }> = {
  vehicle_collision: { label: 'Vehicle Collision', icon: '🚗' },
  bike_accident: { label: 'Bike Accident', icon: '🏍️' },
  pedestrian_hit: { label: 'Pedestrian Hit', icon: '🚶' },
  vehicle_breakdown: { label: 'Vehicle Breakdown', icon: '🔧' },
  fire: { label: 'Fire', icon: '🔥' },
  road_hazard: { label: 'Road Hazard', icon: '⚠️' },
  other: { label: 'Other', icon: '📍' },
};

export const PLACE_CATEGORY_META: Record<
  PlaceCategory,
  { label: string; icon: string; color: string; keyword: string }
> = {
  hospital:  { label: 'Hospitals',       icon: '🏥', color: '#ef4444', keyword: 'hospital' },
  police:    { label: 'Police Stations',  icon: '🚔', color: '#3b82f6', keyword: 'police station' },
  petrol:    { label: 'Petrol Pumps',     icon: '⛽', color: '#eab308', keyword: 'petrol pump gas station' },
  puncture:  { label: 'Puncture Shops',   icon: '🔧', color: '#22c55e', keyword: 'tyre puncture shop' },
  towing:    { label: 'Towing Service',   icon: '🚛', color: '#f97316', keyword: 'towing service' },
  food:      { label: 'Food Points',      icon: '🍔', color: '#a78bfa', keyword: 'restaurant food' },
  washroom:  { label: 'Washrooms',        icon: '🚻', color: '#06b6d4', keyword: 'toilet washroom' },
  showroom:  { label: 'Car Showrooms',    icon: '🏪', color: '#ec4899', keyword: 'car showroom' },
};

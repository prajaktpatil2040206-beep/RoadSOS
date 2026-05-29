import Dexie, { type Table } from 'dexie';
import type { NearbyPlace, Anomaly, UserProfile } from '../types';

interface CachedPlace extends NearbyPlace { cachedAt: number; queryKey: string; }
interface CachedAnomaly extends Anomaly { cachedAt: number; }
interface PendingAction {
  id?: number;
  type: 'report_anomaly' | 'update_profile' | 'offer_response' | 'resolve_anomaly';
  payload: unknown;
  createdAt: number;
  retries: number;
}
interface CachedRoute { id: string; data: unknown; cachedAt: number; }

class RoadSOSDB extends Dexie {
  places!: Table<CachedPlace>;
  anomalies!: Table<CachedAnomaly>;
  profile!: Table<UserProfile & { cachedAt: number }>;
  pending!: Table<PendingAction>;
  routes!: Table<CachedRoute>;

  constructor() {
    super('roadsos_v1');
    this.version(1).stores({
      places:   '++id, queryKey, category, cachedAt',
      anomalies:'id, status, createdAt, cachedAt',
      profile:  'uid, cachedAt',
      pending:  '++id, type, createdAt',
      routes:   'id, cachedAt',
    });
  }
}

export const offlineDb = new RoadSOSDB();

const TTL_PLACES  = 15 * 60 * 1000;
const TTL_ANOMALY =  2 * 60 * 1000;

export async function cachePlaces(queryKey: string, places: NearbyPlace[]) {
  await offlineDb.places.where('queryKey').equals(queryKey).delete();
  const now = Date.now();
  await offlineDb.places.bulkAdd(places.map(p => ({ ...p, cachedAt: now, queryKey })));
}

export async function getCachedPlaces(queryKey: string): Promise<NearbyPlace[] | null> {
  const rows = await offlineDb.places.where('queryKey').equals(queryKey).toArray();
  if (!rows.length) return null;
  if (Date.now() - rows[0].cachedAt > TTL_PLACES) {
    await offlineDb.places.where('queryKey').equals(queryKey).delete();
    return null;
  }
  return rows;
}

export async function cacheAnomalies(anomalies: Anomaly[]) {
  const now = Date.now();
  await offlineDb.anomalies.bulkPut(anomalies.map(a => ({ ...a, cachedAt: now })));
}

export async function getCachedAnomalies(): Promise<Anomaly[] | null> {
  const rows = await offlineDb.anomalies.orderBy('createdAt').reverse().limit(50).toArray();
  if (!rows.length) return null;
  if (Date.now() - rows[0].cachedAt > TTL_ANOMALY) return null;
  return rows;
}

export async function cacheProfile(profile: UserProfile) {
  await offlineDb.profile.put({ ...profile, cachedAt: Date.now() });
}

export async function getCachedProfile(uid: string): Promise<UserProfile | null> {
  const row = await offlineDb.profile.get(uid);
  return row ?? null;
}

export async function queueAction(type: PendingAction['type'], payload: unknown) {
  await offlineDb.pending.add({ type, payload, createdAt: Date.now(), retries: 0 });
}

export async function getPendingActions() {
  return offlineDb.pending.toArray();
}

export async function removePendingAction(id: number) {
  await offlineDb.pending.delete(id);
}

export async function cacheRoute(id: string, data: unknown) {
  await offlineDb.routes.put({ id, data, cachedAt: Date.now() });
}

export async function getCachedRoute(id: string) {
  return offlineDb.routes.get(id);
}

export async function clearExpiredCache() {
  const now = Date.now();
  await offlineDb.places.where('cachedAt').below(now - TTL_PLACES).delete();
  await offlineDb.anomalies.where('cachedAt').below(now - TTL_ANOMALY * 30).delete();
}

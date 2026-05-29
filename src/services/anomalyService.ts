import { db } from '../firebase';
import {
  ref, push, set, update, get, query, orderByChild, limitToLast,
  onValue, off, type DataSnapshot,
} from 'firebase/database';
import type { Anomaly, AnomalyCategory, AnomalySeverity, AnomalyLocation, AnomalyResponse } from '../types';
import { queueAction, cacheAnomalies, getCachedAnomalies } from './offlineCache';

const REF = 'anomalies';

export async function reportAnomaly(data: {
  location: AnomalyLocation;
  severity: AnomalySeverity;
  category: AnomalyCategory;
  description: string;
  reporterId: string;
  reporterName: string;
  mediaUrl?: string;
}): Promise<string> {
  try {
    const r = push(ref(db, REF));
    const anomaly: Omit<Anomaly, 'id'> = { ...data, status: 'reported', createdAt: Date.now() };
    await set(r, anomaly);
    return r.key!;
  } catch {
    await queueAction('report_anomaly', data);
    throw new Error('Queued for sync when online');
  }
}

export async function getAnomalies(): Promise<Anomaly[]> {
  try {
    const q = query(ref(db, REF), orderByChild('createdAt'), limitToLast(100));
    const snap = await get(q);
    const list: Anomaly[] = [];
    snap.forEach(c => { list.unshift({ id: c.key!, ...c.val() }); });
    await cacheAnomalies(list);
    return list;
  } catch {
    return (await getCachedAnomalies()) ?? [];
  }
}

export async function getAnomaly(id: string): Promise<Anomaly | null> {
  const snap = await get(ref(db, `${REF}/${id}`));
  if (!snap.exists()) return null;
  return { id: snap.key!, ...snap.val() } as Anomaly;
}

export function subscribeToAnomalies(cb: (list: Anomaly[]) => void) {
  const q = query(ref(db, REF), orderByChild('createdAt'), limitToLast(100));
  const handler = (snap: DataSnapshot) => {
    const list: Anomaly[] = [];
    snap.forEach(c => { list.unshift({ id: c.key!, ...c.val() }); });
    cacheAnomalies(list);
    cb(list);
  };
  onValue(q, handler);
  return () => off(q, 'value', handler);
}

export function subscribeToAnomaly(id: string, cb: (a: Anomaly | null) => void) {
  const r = ref(db, `${REF}/${id}`);
  const handler = (snap: DataSnapshot) =>
    cb(snap.exists() ? ({ id: snap.key!, ...snap.val() } as Anomaly) : null);
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function offerResponse(
  anomalyId: string,
  responderUid: string,
  response: Omit<AnomalyResponse, 'uid' | 'updatedAt'>
) {
  await update(ref(db, `${REF}/${anomalyId}/responses/${responderUid}`), {
    ...response, uid: responderUid, updatedAt: Date.now(),
  });
  await update(ref(db, `${REF}/${anomalyId}`), { status: 'responding' });
}

export async function updateResponderStatus(
  anomalyId: string,
  uid: string,
  status: AnomalyResponse['status'],
  eta?: number
) {
  await update(ref(db, `${REF}/${anomalyId}/responses/${uid}`), {
    status, eta, updatedAt: Date.now(),
  });
}

export async function resolveAnomaly(anomalyId: string) {
  await update(ref(db, `${REF}/${anomalyId}`), {
    status: 'resolved', resolvedAt: Date.now(),
  });
}

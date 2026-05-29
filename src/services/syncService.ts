import { getPendingActions, removePendingAction, queueAction } from './offlineCache';
import { reportAnomaly } from './anomalyService';
import { updateUserProfile } from './userService';

let syncing = false;

export async function processPendingQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  const actions = await getPendingActions();
  for (const action of actions) {
    try {
      if (action.type === 'report_anomaly') {
        const data = action.payload as Parameters<typeof reportAnomaly>[0];
        await reportAnomaly(data);
      } else if (action.type === 'update_profile') {
        const { uid, updates } = action.payload as { uid: string; updates: Record<string, unknown> };
        await updateUserProfile(uid, updates as any);
      }
      if (action.id !== undefined) await removePendingAction(action.id);
    } catch (e) {
      console.warn('Sync failed for action', action.type, e);
    }
  }

  syncing = false;
}

export function startSyncListener() {
  window.addEventListener('online', processPendingQueue);
  processPendingQueue(); // try immediately
}

export { queueAction };

import { db } from '../firebase';
import { ref, set, update, get } from 'firebase/database';
import type { UserProfile } from '../types';
import { cacheProfile, getCachedProfile } from './offlineCache';

const USERS_REF = 'users';

/** Generate a unique RoadSOS ID like RSOS-RAJ-4821 */
function generateSosId(name: string): string {
  const initials = name.trim().split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3).padEnd(3, 'X');
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RSOS-${initials}-${num}`;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const profileToSave = { ...profile };
  if (!profileToSave.sosId) {
    profileToSave.sosId = generateSosId(profile.name || 'USR');
  }
  await set(ref(db, `${USERS_REF}/${profile.uid}`), profileToSave);
  await cacheProfile(profileToSave);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await get(ref(db, `${USERS_REF}/${uid}`));
    if (!snap.exists()) return null;
    const profile = snap.val() as UserProfile;
    // Generate sosId if missing (for existing users)
    if (!profile.sosId) {
      const sosId = generateSosId(profile.name || 'USR');
      await update(ref(db, `${USERS_REF}/${uid}`), { sosId });
      profile.sosId = sosId;
    }
    await cacheProfile(profile);
    return profile;
  } catch {
    return getCachedProfile(uid);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await update(ref(db, `${USERS_REF}/${uid}`), updates);
  const cached = await getCachedProfile(uid);
  if (cached) await cacheProfile({ ...cached, ...updates });
}

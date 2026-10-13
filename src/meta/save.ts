import { get, set } from 'idb-keyval';
import { migrate, newProfile } from './profile';
import type { Profile } from './profile';

const KEY = 'path-raiders-save';

/** Storage seam: IndexedDB now; a cloud implementation can be added later. */
export interface SaveStore {
  load(): Promise<Profile | null>;
  save(p: Profile): Promise<void>;
}

export const localStore: SaveStore = {
  async load() {
    try {
      const v = (await get(KEY)) as Profile | undefined;
      if (v) return v;
    } catch {
      /* fall through to localStorage */
    }
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  },
  async save(p) {
    try {
      await set(KEY, p);
    } catch {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...p, history: p.history.slice(0, 5) }));
      } catch {
        /* storage unavailable */
      }
    }
  },
};

export async function loadProfile(): Promise<Profile> {
  const p = await localStore.load();
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
  return p ? migrate(p) : newProfile();
}

let pending: number | null = null;
export function saveProfile(p: Profile): void {
  if (pending) clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    void localStore.save(p);
  }, 150);
}

export function exportSave(p: Profile): void {
  const blob = new Blob([JSON.stringify(p)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `path-raiders-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importSave(file: File): Promise<Profile> {
  const text = await file.text();
  const p = JSON.parse(text) as Profile;
  if (!p || typeof p !== 'object' || !p.cards) throw new Error('Not a Path Raiders save file');
  return migrate(p);
}

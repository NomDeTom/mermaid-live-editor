/**
 * A History slot backed by an offline hub instead of localStorage.
 *
 * The History panel already does everything a "save to the hub" feature needs -- naming,
 * dedup, restore, delete -- against a `Persisted<HistoryEntry[]>`. So this is not a new
 * feature but a fourth backing store behind the existing one: same entry shape, same UI,
 * different destination. The panel writes whole arrays, so writes are diffed here into
 * create/rename/delete calls rather than the store being told what changed.
 *
 * Availability is probed once. With no hub reachable (the normal case on a desktop) the
 * tab never appears and nothing else in the editor is affected.
 *
 * The hub is at the same origin when it serves this app. For development against a hub
 * elsewhere, set the override in the browser console:
 *
 *     localStorage.setItem('hubStoreUrl', 'http://127.0.0.1:8090')
 */

import type { HistoryEntry, State } from '$lib/types';
import type { Persisted } from '$lib/util/persist.svelte';

const OVERRIDE_KEY = 'hubStoreUrl';
const KIND = 'mermaid';
// Thumbnails ride over a shared hotspot and are a nicety, not the payload. A diagram
// whose SVG is larger than this saves fine, just without a preview.
const MAX_THUMB = 256 * 1024;

let entries = $state.raw<HistoryEntry[]>([]);
let available = $state(false);
let hydrated = false;

const base = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(OVERRIDE_KEY) ?? window.location.origin;
};

interface HubSave {
  id: string;
  name: string;
  kind: string;
  created: number;
  state: State;
}

/**
 * Ticks are cumulative powered-on seconds, not a date -- the hub has no clock. The
 * browser does, so an age in ticks is converted to a local timestamp on arrival and the
 * existing date rendering keeps working untouched.
 */
const toEntry = (save: HubSave, now: number): HistoryEntry => ({
  id: save.id,
  name: save.name,
  state: save.state,
  time: Date.now() - Math.max(0, now - save.created) * 1000,
  type: 'hub'
});

const captureThumb = (): string | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }
  // The same node the editor's own PNG/SVG export uses.
  const svg = document.querySelector('#container svg');
  if (!svg) {
    return undefined;
  }
  try {
    const markup = new XMLSerializer().serializeToString(svg);
    if (markup.length > MAX_THUMB) {
      return undefined;
    }
    // Rendered by the browser and uploaded as-is: the hub must never rasterize
    // anything, since on a Pi Zero that stalls every other guest on the SSID.
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  } catch {
    return undefined;
  }
};

const request = async (path: string, init?: RequestInit): Promise<Response | undefined> => {
  try {
    const response = await fetch(`${base()}${path}`, init);
    return response.ok ? response : undefined;
  } catch {
    // An unreachable hub is the expected state off-network, not an error worth raising.
    return undefined;
  }
};

const create = async (entry: HistoryEntry): Promise<void> => {
  await request('/api/saves', {
    method: 'POST',
    body: JSON.stringify({
      id: entry.id,
      kind: KIND,
      name: entry.name ?? 'untitled',
      state: entry.state,
      thumb: captureThumb()
    })
  });
};

const rename = async (entry: HistoryEntry): Promise<void> => {
  await request(`/api/saves/${entry.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: entry.name })
  });
};

const remove = async (id: string): Promise<void> => {
  await request(`/api/saves/${id}`, { method: 'DELETE' });
};

// The panel replaces the array wholesale; work out what actually changed.
const writeThrough = (next: HistoryEntry[]): void => {
  const before = new Map(entries.map((entry) => [entry.id, entry]));
  const nextIDs = new Set(next.map((entry) => entry.id));

  for (const entry of next) {
    const previous = before.get(entry.id);
    if (!previous) {
      void create(entry);
    } else if (previous.name !== entry.name) {
      void rename(entry);
    }
  }
  for (const entry of entries) {
    if (!nextIDs.has(entry.id)) {
      void remove(entry.id);
    }
  }
};

/** Load the hub's saves. Idempotent; safe to call on every panel mount. */
export const hydrateHub = async (): Promise<void> => {
  if (hydrated) {
    return;
  }
  hydrated = true;
  // `full=1` inlines the documents. Mermaid sources are small, and one request beats
  // one-per-entry over a hotspot shared with everyone else in the room.
  const response = await request('/api/saves?full=1');
  if (!response) {
    return;
  }
  try {
    const body = (await response.json()) as { now: number; saves: HubSave[] };
    entries = body.saves
      .filter((save) => save.kind === KIND)
      .map((save) => toEntry(save, body.now));
    available = true;
  } catch {
    available = false;
  }
};

/** Structurally a `Persisted`, so `slotFor()` can return it like any other slot. */
export const hubSlot: Persisted<HistoryEntry[]> = {
  get value() {
    return entries;
  },
  set value(next: HistoryEntry[]) {
    writeThrough(next);
    entries = next;
  }
};

export const hubAvailable = (): boolean => available;

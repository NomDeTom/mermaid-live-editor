import type { HistoryEntry } from '$lib/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The slot keeps module-level state (hydrated-once, the entry mirror), so each test
// imports a fresh copy rather than trying to reset it.
const freshModule = async () => {
  vi.resetModules();
  return import('./hubSlot.svelte');
};

const entry = (id: string, name: string): HistoryEntry => ({
  id,
  name,
  state: { code: 'graph TD; A-->B', mermaid: '{}' } as HistoryEntry['state'],
  time: Date.now(),
  type: 'hub'
});

const jsonResponse = (body: unknown) =>
  ({ json: () => Promise.resolve(body), ok: true }) as Response;

describe('hubSlot', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unavailable and empty when no hub answers', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { hubAvailable, hubSlot, hydrateHub } = await freshModule();

    await hydrateHub();

    expect(hubAvailable()).toBe(false);
    expect(hubSlot.value).toEqual([]);
  });

  it('hydrates saves of its own kind and converts ticks to local time', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        now: 5000,
        saves: [
          { created: 4400, id: 'a', kind: 'mermaid', name: 'one', state: { code: 'graph' } },
          { created: 4900, id: 'b', kind: 'excalidraw', name: 'other', state: {} }
        ]
      })
    );
    const { hubAvailable, hubSlot, hydrateHub } = await freshModule();

    await hydrateHub();

    expect(hubAvailable()).toBe(true);
    expect(hubSlot.value).toHaveLength(1);
    expect(hubSlot.value[0].id).toBe('a');
    // 600 ticks before the server's "now" should land ~600s ago on the browser clock.
    const ageSeconds = (Date.now() - hubSlot.value[0].time) / 1000;
    expect(ageSeconds).toBeGreaterThan(590);
    expect(ageSeconds).toBeLessThan(610);
  });

  it('hydrates only once', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ now: 1, saves: [] }));
    const { hydrateHub } = await freshModule();

    await hydrateHub();
    await hydrateHub();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('POSTs entries the panel adds', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ now: 1, saves: [] }));
    const { hubSlot, hydrateHub } = await freshModule();
    await hydrateHub();
    fetchMock.mockClear();

    hubSlot.value = [entry('new-1', 'first')];

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/saves');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ id: 'new-1', kind: 'mermaid', name: 'first' });
  });

  it('PATCHes a rename rather than re-creating the entry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        now: 10,
        saves: [{ created: 5, id: 'a', kind: 'mermaid', name: 'before', state: {} }]
      })
    );
    const { hubSlot, hydrateHub } = await freshModule();
    await hydrateHub();
    fetchMock.mockClear();

    hubSlot.value = [{ ...hubSlot.value[0], name: 'after' }];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/saves/a');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'after' });
  });

  it('DELETEs entries the panel drops', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        now: 10,
        saves: [{ created: 5, id: 'gone', kind: 'mermaid', name: 'x', state: {} }]
      })
    );
    const { hubSlot, hydrateHub } = await freshModule();
    await hydrateHub();
    fetchMock.mockClear();

    hubSlot.value = [];

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/saves/gone');
    expect(init.method).toBe('DELETE');
  });

  it('honours the dev override for the hub origin', async () => {
    localStorage.setItem('hubStoreUrl', 'http://127.0.0.1:8090');
    fetchMock.mockResolvedValue(jsonResponse({ now: 1, saves: [] }));
    const { hydrateHub } = await freshModule();

    await hydrateHub();

    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8090/api/saves?full=1');
  });
});

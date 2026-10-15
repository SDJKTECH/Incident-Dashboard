import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_FILE_ENDPOINT, syncDbFile } from '../../src/lib/dbFileSync';

describe('syncDbFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PUTs the bytes to the dev endpoint and resolves true on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncDbFile(new Uint8Array([1, 2, 3]))).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DB_FILE_ENDPOINT);
    expect(init.method).toBe('PUT');
  });

  it('resolves false when the server responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(syncDbFile(new Uint8Array([1]))).resolves.toBe(false);
  });

  it('never throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(syncDbFile(new Uint8Array([1]))).resolves.toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  ClipSessionClient,
  loadSession,
  patchSession
} from '../../app/utils/clipSessionClient';

describe('clipSessionClient', () => {
  it('loadSession encodes path segments and extracts session from GET /api/clip-session', async () => {
    const fakeSession = {
      folder_name: '[Folder] Name',
      clip_id: '0_15_With Spaces',
      transcript: [{ start: 0, duration: 1, text: 'Hello' }],
      style_settings: { font: 'Montserrat' },
      timeline: [],
      history: { undo_stack: [], redo_stack: [] },
      cover_config: { enabled: false },
      crop_map: [{ time: 0, x: 960 }],
      asset_url: '/assets/clips/f/c/video.mp4',
      thumbnail_url: '/assets/clips/f/c/thumbnail.jpg',
      cover_url: null
    };
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 'ok',
      session: fakeSession
    });

    const client = new ClipSessionClient('http://localhost:8000', mockFetcher);
    const result = await client.loadSession(
      '[Folder] Name',
      '0_15_With Spaces'
    );

    expect(mockFetcher).toHaveBeenCalledWith(
      'http://localhost:8000/api/clip-session/%5BFolder%5D%20Name/0_15_With%20Spaces',
      undefined
    );
    expect(result).toEqual(fakeSession);
  });

  it('patchSession sends canonical partial payload without _compact to PUT /api/clip-session', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      status: 'ok',
      folder_name: 'f1',
      clip_id: 'c1'
    });

    const client = new ClipSessionClient('http://localhost:8000', mockFetcher);
    const ack = await client.patchSession('f1', 'c1', {
      transcript: [{ start: 0, duration: 1, text: 'Updated' }]
    });

    expect(mockFetcher).toHaveBeenCalledWith(
      'http://localhost:8000/api/clip-session/f1/c1',
      {
        method: 'PUT',
        body: {
          transcript: [{ start: 0, duration: 1, text: 'Updated' }]
        }
      }
    );
    expect(ack).toEqual({ status: 'ok', folder_name: 'f1', clip_id: 'c1' });
  });

  it('module-level loadSession and patchSession delegate via injectable fetcher', async () => {
    const mockFetcher = vi
      .fn()
      .mockResolvedValueOnce({ status: 'ok', session: { clip_id: 'c1' } })
      .mockResolvedValueOnce({
        status: 'ok',
        folder_name: 'f1',
        clip_id: 'c1'
      });

    const loaded = await loadSession('f1', 'c1', {
      apiBase: 'http://localhost:8123',
      fetcher: mockFetcher
    });
    expect(loaded.clip_id).toBe('c1');

    const patched = await patchSession(
      'f1',
      'c1',
      { style_settings: { fontSize: 64 } },
      { apiBase: 'http://localhost:8123', fetcher: mockFetcher }
    );
    expect(patched.status).toBe('ok');
  });
});

// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClipperExport } from '../../app/composables/useClipperExport';

// Mock useTimelineState
vi.mock('../../app/composables/useTimelineState', () => ({
  useTimelineState: () => ({
    timelineTracks: { value: [{ id: 'video', name: 'Main Video', items: [] }] },
    timelineUndoStack: { value: [] },
    timelineRedoStack: { value: [] }
  })
}));

describe('useClipperExport Composable', () => {
  let mockDeps: any;
  let capturedSessionBody: any = null;
  let capturedRenderBody: any = null;
  let fetchCalls: Array<{ url: string; opts: any }> = [];

  beforeEach(() => {
    capturedSessionBody = null;
    capturedRenderBody = null;
    fetchCalls = [];

    mockDeps = {
      saveClipSession: vi.fn().mockResolvedValue(undefined),
      saveTranscript: vi.fn().mockResolvedValue(undefined),
      saveStyleSettings: vi.fn().mockResolvedValue(undefined),
      saveTimelineTracks: vi.fn().mockResolvedValue(undefined),
      saveThumbnailConfig: vi.fn().mockResolvedValue(undefined)
    };

    const jobId = useState<string | null>('jobId');
    const jobError = useState<string>('jobError');
    const renderStatus = useState<string>('renderStatus');
    const videoLayout = useState<string>('videoLayout');
    const folderName = useState<string | null>('folderName');
    const clipId = useState<string | null>('clipId');
    const fullTranscript = useState<any[]>('fullTranscript');

    jobId.value = 'test-job-id';
    jobError.value = '';
    renderStatus.value = 'idle';
    videoLayout.value = 'landscape';
    folderName.value = 'test-folder';
    clipId.value = 'test-clip';
    fullTranscript.value = [{ start: 0, duration: 2.5, text: 'Hello world' }];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts: any) => {
        fetchCalls.push({ url, opts });

        if (url.includes('/api/clip-session/')) {
          if (opts?.body) {
            try {
              capturedSessionBody = JSON.parse(opts.body);
            } catch {}
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
          });
        }

        if (url.includes('/api/render-stream')) {
          if (opts?.body) {
            try {
              capturedRenderBody = JSON.parse(opts.body);
            } catch {}
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => {
                let done = false;
                return {
                  read: () => {
                    if (done)
                      return Promise.resolve({ done: true, value: undefined });
                    done = true;
                    const sse =
                      'data: {"stage":"done","percent":100,"outputUrl":"/static/output/clip.mp4"}\n\n';
                    return Promise.resolve({
                      done: false,
                      value: new TextEncoder().encode(sse)
                    });
                  }
                };
              }
            }
          });
        }

        return Promise.resolve({ ok: true, status: 200 });
      })
    );
  });

  it('saves clip session in one unified PUT /api/clip-session request before triggering /api/render-stream', async () => {
    // Call without mockDeps to verify built-in unified persistence
    const { renderClip, renderStatus, outputUrl } = useClipperExport();

    await renderClip(0, 'My Test Output');

    // 1. Verify single atomic session persistence call occurred first
    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0].url).toContain(
      '/api/clip-session/test-folder/test-clip'
    );
    expect(fetchCalls[0].opts.method).toBe('PUT');

    expect(capturedSessionBody).not.toBeNull();
    expect(capturedSessionBody.transcript).toEqual([
      { start: 0, duration: 2.5, text: 'Hello world' }
    ]);
    expect(capturedSessionBody.style_settings).toBeDefined();
    expect(capturedSessionBody.timeline).toBeDefined();
    expect(capturedSessionBody.cover_config).toBeDefined();

    // 2. Verify render stream call followed
    expect(fetchCalls[1].url).toContain('/api/render-stream');
    expect(fetchCalls[1].opts.method).toBe('POST');
    expect(capturedRenderBody).not.toBeNull();
    expect(capturedRenderBody.job_id).toBe('test-job-id');
    expect(capturedRenderBody.output_name).toBe('My Test Output');
    expect(capturedRenderBody.video_layout).toBe('landscape');

    expect(renderStatus.value).toBe('done');
    expect(outputUrl.value).toBe(`${resolveApiBase()}/static/output/clip.mp4`);
  });

  it('gracefully halts render initiation if pre-render session save fails', async () => {
    // Mock fetch to simulate failure on PUT /api/clip-session
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts: any) => {
        fetchCalls.push({ url, opts });
        if (url.includes('/api/clip-session/')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      })
    );

    const { renderClip, renderStatus } = useClipperExport();
    await renderClip(0, 'Failed Output');

    // Session save was attempted
    expect(fetchCalls.some(c => c.url.includes('/api/clip-session/'))).toBe(
      true
    );

    // Render stream was NOT called (graceful halt)
    expect(fetchCalls.some(c => c.url.includes('/api/render-stream'))).toBe(
      false
    );

    expect(renderStatus.value).toBe('error');
    const jobError = useState<string>('jobError');
    expect(jobError.value).toContain('Failed to save clip session: 500');
  });

  it('delegates to deps.saveClipSession when custom handler is provided in deps', async () => {
    const { renderClip } = useClipperExport(mockDeps);
    await renderClip(0, 'Custom Save');

    expect(mockDeps.saveClipSession).toHaveBeenCalled();
    // Render stream should still execute after custom saveClipSession resolves
    expect(fetchCalls.some(c => c.url.includes('/api/render-stream'))).toBe(
      true
    );
  });

  it('falls back to discrete save deps when folderName or clipId is absent', async () => {
    const folderName = useState<string | null>('folderName');
    folderName.value = null;

    const legacyDeps = {
      saveTranscript: vi.fn().mockResolvedValue(undefined),
      saveStyleSettings: vi.fn().mockResolvedValue(undefined),
      saveTimelineTracks: vi.fn().mockResolvedValue(undefined),
      saveThumbnailConfig: vi.fn().mockResolvedValue(undefined)
    };

    const { renderClip } = useClipperExport(legacyDeps);
    await renderClip(0, 'Legacy Fallback');

    expect(legacyDeps.saveTranscript).toHaveBeenCalledWith(true);
    expect(legacyDeps.saveStyleSettings).toHaveBeenCalled();
    expect(legacyDeps.saveTimelineTracks).toHaveBeenCalled();
    expect(legacyDeps.saveThumbnailConfig).toHaveBeenCalled();
    expect(fetchCalls.some(c => c.url.includes('/api/render-stream'))).toBe(
      true
    );
  });

  it('sets error status when jobId is missing rather than failing silently', async () => {
    const jobId = useState<string | null>('jobId');
    jobId.value = null;

    const { renderClip, renderStatus } = useClipperExport(mockDeps);
    await renderClip(0, 'Test Output');

    expect(renderStatus.value).toBe('error');
    const jobError = useState<string>('jobError');
    expect(jobError.value).toContain('job ID');
  });
});

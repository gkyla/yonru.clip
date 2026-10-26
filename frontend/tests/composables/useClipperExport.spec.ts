// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClipperExport } from '../../app/composables/useClipperExport';
import type { RenderSpec } from '../../app/types/render';

describe('useClipperExport — Deep Render Pipeline', () => {
  let capturedRenderBody: any = null;
  let fetchCalls: Array<{ url: string; opts: any }> = [];

  const validTestSpec: RenderSpec = {
    jobId: 'test-job-123',
    hookIndex: 0,
    outputName: 'Test Viral Clip',
    fps: 30,
    volume: 0.8,
    videoLayout: 'vertical',
    cropMode: 'face_tracking',
    cropPercentX: 50,
    timelineTracks: [
      { id: 'video', name: 'Main Video', type: 'video', items: [] }
    ],
    transcript: [{ start: 0, duration: 2.5, text: 'Amazing hook' }],
    cover: {
      enabled: true,
      duration: 1.5,
      xOffset: 50,
      textOverlays: [
        {
          id: 't1',
          text: 'Viral Hook',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          x: 50,
          y: 50
        }
      ]
    },
    safety: {
      audioBleepEnabled: true,
      audioBleepSource: 'mute',
      bleepMode: 'full',
      safetySensitivity: 'strict',
      censoredSegments: [{ start: 1.0, end: 1.5, word: 'badword' }]
    }
  };

  beforeEach(() => {
    capturedRenderBody = null;
    fetchCalls = [];

    const renderStatus = useState<string>('renderStatus');
    const jobError = useState<string>('jobError');
    renderStatus.value = 'idle';
    jobError.value = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts: any) => {
        fetchCalls.push({ url, opts });

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
                let step = 0;
                return {
                  read: () => {
                    step++;
                    if (step === 1) {
                      const sse =
                        'data: {"stage":"starting","percent":0}\n\n' +
                        'data: {"stage":"rendering","percent":50,"frame":150,"totalFrames":300,"etaSeconds":10}\n\n';
                      return Promise.resolve({
                        done: false,
                        value: new TextEncoder().encode(sse)
                      });
                    }
                    if (step === 2) {
                      const sse =
                        'data: {"stage":"done","percent":100,"outputUrl":"/static/output/test.mp4"}\n\n';
                      return Promise.resolve({
                        done: false,
                        value: new TextEncoder().encode(sse)
                      });
                    }
                    return Promise.resolve({ done: true, value: undefined });
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

  it('exports clip via pure RenderSpec seam without reading ambient global state', async () => {
    const {
      exportClip,
      renderStatus,
      renderProgress,
      outputUrl,
      renderFrame,
      renderTotalFrames
    } = useClipperExport();

    await exportClip(validTestSpec);

    // 1. Verify single POST /api/render-stream call
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toContain('/api/render-stream');
    expect(fetchCalls[0].opts.method).toBe('POST');

    // 2. Verify payload formatted strictly from RenderSpec
    expect(capturedRenderBody).not.toBeNull();
    expect(capturedRenderBody.job_id).toBe('test-job-123');
    expect(capturedRenderBody.output_name).toBe('Test Viral Clip');
    expect(capturedRenderBody.fps).toBe(30);
    expect(capturedRenderBody.volume).toBe(0.8);
    expect(capturedRenderBody.face_tracking).toBe(true);
    expect(capturedRenderBody.transcript).toEqual([
      { start: 0, duration: 2.5, text: 'Amazing hook' }
    ]);
    expect(capturedRenderBody.cover_enabled).toBe(true);
    expect(capturedRenderBody.audio_bleep_enabled).toBe(true);
    expect(capturedRenderBody.safety_sensitivity).toBe('conservative');

    // 3. Verify final state
    expect(renderStatus.value).toBe('done');
    expect(renderProgress.value).toBe(100);
    expect(outputUrl.value).toBe(`${resolveApiBase()}/static/output/test.mp4`);
    expect(renderFrame.value).toBe(300);
    expect(renderTotalFrames.value).toBe(300);
  });

  it('sets error status when jobId is missing in RenderSpec', async () => {
    const { exportClip, renderStatus } = useClipperExport();
    const invalidSpec = { ...validTestSpec, jobId: '' };

    await exportClip(invalidSpec);

    expect(renderStatus.value).toBe('error');
    const jobError = useState<string>('jobError');
    expect(jobError.value).toContain('job ID');
    expect(fetchCalls.length).toBe(0);
  });

  it('handles HTTP error responses from /api/render-stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
    );

    const { exportClip, renderStatus } = useClipperExport();
    await exportClip(validTestSpec);

    expect(renderStatus.value).toBe('error');
    const jobError = useState<string>('jobError');
    expect(jobError.value).toContain('Render failed: 500');
  });

  it('handles backend SSE error stage events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
                  'data: {"stage":"error","message":"Out of memory during encoding"}\n\n';
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(sse)
                });
              }
            };
          }
        }
      })
    );

    const { exportClip, renderStatus } = useClipperExport();
    await exportClip(validTestSpec);

    expect(renderStatus.value).toBe('error');
    const jobError = useState<string>('jobError');
    expect(jobError.value).toContain('Out of memory');
  });

  it('supports cancelling active render via cancelRender()', async () => {
    let abortSignalCaptured: AbortSignal | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: any) => {
        abortSignalCaptured = opts.signal;
        return new Promise((_, reject) => {
          if (opts.signal?.aborted) {
            const err: any = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          opts.signal?.addEventListener('abort', () => {
            const err: any = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
          });
        });
      })
    );

    const { exportClip, cancelRender, renderStatus } = useClipperExport();
    const renderPromise = exportClip(validTestSpec);

    expect(renderStatus.value).toBe('rendering');
    cancelRender();

    await renderPromise;

    expect(abortSignalCaptured?.aborted).toBe(true);
    expect(renderStatus.value).toBe('cancelled');
  });

  it('openRenderFolder calls /api/open-folder and displays success toast', async () => {
    const fetchStub = vi.fn().mockResolvedValue({ status: 'ok' });
    vi.stubGlobal('$fetch', fetchStub);

    const { openRenderFolder } = useClipperExport();
    const result = await openRenderFolder('/static/output/clip.mp4');

    expect(result).toBe(true);
    expect(fetchStub).toHaveBeenCalledWith(
      '/api/open-folder',
      expect.objectContaining({
        method: 'POST',
        body: { output_url: '/static/output/clip.mp4' }
      })
    );
  });

  it('openRenderFolder handles backend error gracefully and displays error toast', async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValue(new Error('Headless server error'));
    vi.stubGlobal('$fetch', fetchStub);

    const { openRenderFolder } = useClipperExport();
    const result = await openRenderFolder('/static/output/clip.mp4');

    expect(result).toBe(false);
  });

  it('computes isRenderPreviewActive accurately based on outputUrl state', () => {
    const { outputUrl, isRenderPreviewActive } = useClipperExport();
    outputUrl.value = null;
    expect(isRenderPreviewActive.value).toBe(false);

    outputUrl.value = '/static/output/finished_clip.mp4';
    expect(isRenderPreviewActive.value).toBe(true);

    outputUrl.value = null;
    expect(isRenderPreviewActive.value).toBe(false);
  });
});

// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useClipperCover } from '../../app/composables/useClipperCover';
import { useClipperJob } from '../../app/composables/useClipperJob';
import { useState } from '#imports';

describe('useClipperCover Composable', () => {
  beforeEach(() => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/cover/screenshot')) {
          return Promise.resolve({
            status: 'ok',
            timestamp: 12.5,
            cover_url: '/assets/clips/folderA/clipA/cover.jpg'
          });
        }
        if (url.includes('/api/cover/config')) {
          return Promise.resolve({ status: 'ok' });
        }
        return Promise.resolve({});
      })
    );
  });

  it('reproduces Bug 1: toggleCover does not get stuck in isCapturingCover when capturing frame', async () => {
    const cover = useClipperCover();
    const jobId = useState<string | null>('jobId');
    jobId.value = 'test-job-123';

    cover.coverEnabled.value = false;
    cover.coverUrl.value = null;
    cover.isCapturingCover.value = false;

    // Trigger toggle
    await cover.toggleCover();

    // After toggle completes:
    // 1. isCapturingCover MUST be false (not stuck at true)
    expect(cover.isCapturingCover.value).toBe(false);
    // 2. coverEnabled must be true
    expect(cover.coverEnabled.value).toBe(true);
    // 3. coverUrl should be captured
    expect(cover.coverUrl.value).toContain('cover.jpg');
  });

  it('reproduces Bug 2: loading a clip with cover config populates useClipperCover state seamlessly', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/load-ready-clip')) {
          return Promise.resolve({
            job_id: 'test-job-ready',
            status: 'ready',
            clip: { duration: 120, start: 0, end: 120, theme: 'Clip Theme' },
            hooks: [],
            fps: 30,
            history: null,
            cover_url: '/assets/clips/folderA/2253_2377_clip/cover.jpg'
          });
        }
        if (url.includes('/api/cover/config/')) {
          return Promise.resolve({
            config: {
              enabled: true,
              duration: 1.5,
              screenshotTime: 40.1,
              textOverlays: [
                {
                  id: 'overlay-1',
                  text: 'KEBANYAKAN DUDUK BIKIN VARISES?',
                  x: 200,
                  y: 1200,
                  fontSize: 65,
                  fontFamily: 'Lilita One',
                  fontWeight: 900,
                  color: '#ffea00'
                }
              ],
              xOffset: 45
            },
            cover_url: '/assets/clips/folderA/2253_2377_clip/cover.jpg'
          });
        }
        return Promise.resolve({});
      })
    );

    const job = useClipperJob();
    const cover = useClipperCover();

    await job.loadReadyClipIntoEditor('folderA', '2253_2377_clip');
    await nextTick();

    // The cover composable must reflect the loaded cover slide
    expect(cover.coverEnabled.value).toBe(true);
    expect(cover.coverUrl.value).toContain(
      '/assets/clips/folderA/2253_2377_clip/cover.jpg'
    );
    expect(cover.coverDuration.value).toBe(1.5);
    expect(cover.coverTextOverlays.value.length).toBe(1);
    expect(cover.coverTextOverlays.value[0].text).toBe(
      'KEBANYAKAN DUDUK BIKIN VARISES?'
    );
  });
});

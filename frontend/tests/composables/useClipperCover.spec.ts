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
        return Promise.resolve({});
      })
    );
  });

  it('reproduces Bug 1: toggleCover does not get stuck in isCapturingCover and invokes onSaveCoverConfig callback', async () => {
    const onSaveCoverConfig = vi.fn().mockResolvedValue(undefined);
    const cover = useClipperCover({ onSaveCoverConfig });
    const jobId = useState<string | null>('jobId');
    jobId.value = 'test-job-123';

    cover.coverEnabled.value = false;
    cover.coverUrl.value = null;
    cover.isCapturingCover.value = false;

    await cover.toggleCover();

    expect(cover.isCapturingCover.value).toBe(false);
    expect(cover.coverEnabled.value).toBe(true);
    expect(cover.coverUrl.value).toContain('cover.jpg');
    expect(onSaveCoverConfig).toHaveBeenCalledTimes(1);
  });

  it('reproduces Bug 2: loading a clip with cover config in session populates useClipperCover state seamlessly', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/load-ready-clip')) {
          return Promise.resolve({
            job_id: 'test-job-ready',
            status: 'ready',
            clip: { duration: 120, start: 0, end: 120, theme: 'Clip Theme' },
            hooks: [],
            saved_hooks: [],
            fps: 30,
            session: {
              folder_name: 'folderA',
              clip_id: '2253_2377_clip',
              transcript: [],
              style_settings: {},
              timeline: [],
              history: { undo_stack: [], redo_stack: [] },
              cover_config: {
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
              crop_map: [],
              cover_url: '/assets/clips/folderA/2253_2377_clip/cover.jpg'
            }
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

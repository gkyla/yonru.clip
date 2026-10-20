// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import {
  useClipEditorSession,
  sanitizeTranscript
} from '../../app/composables/useClipEditorSession';
import { resolveApiBase } from '../../app/utils/apiBase';
import type {
  TranscriptSegment,
  Hook,
  CachedVideo
} from '../../app/types/clipper';

describe('useClipEditorSession Composable', () => {
  const API_BASE = resolveApiBase();

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 'ok' }));
  });

  describe('initialization and active clip identifiers', () => {
    it('initializes default session state and active clip identifiers', () => {
      const session = useClipEditorSession();
      expect(session.folderName).toBeDefined();
      expect(session.clipId).toBeDefined();
      expect(session.fullTranscript).toBeDefined();
      expect(session.hooks).toBeDefined();
      expect(session.activeHook).toBeDefined();
      expect(session.cropMode).toBeDefined();
      expect(session.cropMap).toBeDefined();
      expect(session.videoFps).toBeDefined();
      expect(session.volume).toBeDefined();
      expect(session.subtitlesEnabled).toBeDefined();
      expect(session.autoAdaptiveSubtitles).toBeDefined();
    });
  });

  describe('sanitizeTranscript', () => {
    it('normalizes string start and duration to numbers', () => {
      const input: any = [
        { start: '12.34', duration: '5.6', text: 'Hello' },
        { start: 0, duration: 2, text: 'World' }
      ];
      const cleaned = sanitizeTranscript(input);
      expect(cleaned).toEqual([
        { start: 12.34, duration: 5.6, text: 'Hello' },
        { start: 0, duration: 2, text: 'World' }
      ]);
    });

    it('handles missing or non-numeric start and duration gracefully', () => {
      const input: any = [
        { start: undefined, duration: null, text: 'Missing timing' },
        { start: 'invalid', duration: NaN, text: 'Invalid timing' }
      ];
      const cleaned = sanitizeTranscript(input);
      expect(cleaned).toEqual([
        { start: 0, duration: 0, text: 'Missing timing' },
        { start: 0, duration: 0, text: 'Invalid timing' }
      ]);
    });

    it('strips non-serializable circular references from segments and words', () => {
      const circularSeg: any = {
        start: 1,
        duration: 3,
        text: 'Circular text',
        words: [{ text: 'Circular', start: 1, duration: 1 }]
      };
      // Attach circular self-reference and circular word reference
      circularSeg.self = circularSeg;
      circularSeg.words[0].parent = circularSeg;
      circularSeg.domNode = { nodeType: 1 };

      // Normal JSON.stringify would fail with TypeError: Converting circular structure to JSON
      expect(() => JSON.stringify(circularSeg)).toThrow();

      const cleaned = sanitizeTranscript([circularSeg]);

      // Sanitized transcript has no circular references and serializes cleanly
      expect(() => JSON.stringify(cleaned)).not.toThrow();
      expect(cleaned[0].text).toBe('Circular text');
      expect((cleaned[0] as any).self).toBeUndefined();
      expect((cleaned[0] as any).domNode).toBeUndefined();
      expect((cleaned[0].words![0] as any).parent).toBeUndefined();
    });
  });

  describe('loadReadyClipIntoEditor', () => {
    it('loads ready clip into editor and resolves parent video & hook theme into lastClip', async () => {
      const mockJob = {
        loadReadyClipIntoEditor: vi.fn().mockResolvedValue(undefined),
        jobId: ref('job-123'),
        jobError: ref(null)
      };
      const mockLibrary = {
        cachedVideos: ref<CachedVideo[]>([
          {
            video_id: 'vid-xyz',
            title: 'Parent Video Title',
            duration: 120,
            folder_name: 'test-folder'
          }
        ]),
        setLastClip: vi.fn()
      };

      const session = useClipEditorSession({
        job: mockJob as any,
        library: mockLibrary as any
      });

      session.activeHook.value = {
        theme: 'Resolved Hook Theme',
        thumbnail_url: 'https://example.com/thumb.jpg',
        start: 10,
        end: 25
      };

      await session.loadReadyClipIntoEditor('test-folder', 'clip-abc');

      expect(mockJob.loadReadyClipIntoEditor).toHaveBeenCalledWith(
        'test-folder',
        'clip-abc'
      );
      expect(mockLibrary.setLastClip).toHaveBeenCalledWith(
        'test-folder',
        'clip-abc',
        'Resolved Hook Theme',
        'https://example.com/thumb.jpg',
        'Resolved Hook Theme',
        'Parent Video Title'
      );
    });
  });

  describe('saveTranscript', () => {
    it('returns early when folderName is missing', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('$fetch', mockFetch);

      const session = useClipEditorSession();
      session.folderName.value = null;
      session.fullTranscript.value = [{ start: 0, duration: 1, text: 'Hi' }];

      await session.saveTranscript();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sanitizes and sends transcript to PUT /api/clip-session with toast on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockNotifier = { showToast: vi.fn() };

      const session = useClipEditorSession({ notifier: mockNotifier as any });
      session.folderName.value = 'my-folder';
      session.clipId.value = 'my-clip';
      session.fullTranscript.value = [
        { start: '1.5' as any, duration: '3.0' as any, text: 'Sanitized edit' }
      ];

      await session.saveTranscript(false);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/my-folder/my-clip`,
        expect.objectContaining({
          method: 'PUT',
          body: {
            transcript: [{ start: 1.5, duration: 3.0, text: 'Sanitized edit' }]
          }
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Edits saved successfully!',
        'success'
      );
    });

    it('suppresses toast when isSilent is true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockNotifier = { showToast: vi.fn() };

      const session = useClipEditorSession({ notifier: mockNotifier as any });
      session.folderName.value = 'my-folder';
      session.clipId.value = 'my-clip';
      session.fullTranscript.value = [
        { start: 0, duration: 1, text: 'Silent' }
      ];

      await session.saveTranscript(true);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockNotifier.showToast).not.toHaveBeenCalled();
    });

    it('shows error toast when fetch fails and isSilent is false', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('$fetch', mockFetch);
      const mockNotifier = { showToast: vi.fn() };

      const session = useClipEditorSession({ notifier: mockNotifier as any });
      session.folderName.value = 'my-folder';
      session.clipId.value = 'my-clip';
      session.fullTranscript.value = [{ start: 0, duration: 1, text: 'Fail' }];

      await session.saveTranscript(false);

      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Failed to save edits',
        'error'
      );
    });
  });

  describe('saveClipSession', () => {
    it('returns early when folderName or clipId is null', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('$fetch', mockFetch);

      const session = useClipEditorSession();
      session.folderName.value = null;
      session.clipId.value = 'clip1';
      await session.saveClipSession();
      expect(mockFetch).not.toHaveBeenCalled();

      session.folderName.value = 'folder1';
      session.clipId.value = null;
      await session.saveClipSession();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('serializes full session payload with timeline, style, history, and cropMap', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue({ status: 'ok', session: {} });
      vi.stubGlobal('$fetch', mockFetch);
      const mockNotifier = { showToast: vi.fn() };
      const mockTimeline = {
        timelineTracks: ref([
          { id: 'text', name: 'Text', type: 'text', items: [] }
        ]),
        timelineUndoStack: ref([{ action: 'move' }]),
        timelineRedoStack: ref([])
      };
      const mockSubtitleStyle = {
        getStyleSnapshot: vi
          .fn()
          .mockReturnValue({ font: 'Inter', fontSize: 40 })
      };
      const mockThumbnail = {
        coverEnabled: ref(true),
        coverDuration: ref(1.5),
        coverScreenshotTime: ref(2.0),
        coverTextOverlays: ref([{ id: 't1', text: 'Cover Title' }]),
        coverXOffset: ref(50)
      };

      const session = useClipEditorSession({
        notifier: mockNotifier as any,
        timeline: mockTimeline as any,
        subtitleStyle: mockSubtitleStyle as any,
        thumbnailState: mockThumbnail as any
      });

      session.folderName.value = 'folderX';
      session.clipId.value = 'clipY';
      session.cropMap.value = [{ time: 0, x: 50, y: 50 }];
      session.fullTranscript.value = [
        { start: 0, duration: 5, text: 'Session transcript' }
      ];

      await session.saveClipSession(undefined, false);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/folderX/clipY`,
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({
            transcript: [{ start: 0, duration: 5, text: 'Session transcript' }],
            style_settings: { font: 'Inter', fontSize: 40 },
            timeline: [{ id: 'text', name: 'Text', type: 'text', items: [] }],
            cover_config: {
              enabled: true,
              duration: 1.5,
              screenshotTime: 2.0,
              textOverlays: [{ id: 't1', text: 'Cover Title' }],
              xOffset: 50
            },
            history: {
              undo_stack: [{ action: 'move' }],
              redo_stack: []
            },
            crop_map: [{ time: 0, x: 50, y: 50 }]
          })
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Edits saved successfully!',
        'success'
      );
    });

    it('merges customPayload into request body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);

      const session = useClipEditorSession();
      session.folderName.value = 'folderCustom';
      session.clipId.value = 'clipCustom';

      await session.saveClipSession({ customField: 'customValue' }, true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/clip-session/folderCustom/clipCustom'),
        expect.objectContaining({
          body: expect.objectContaining({
            customField: 'customValue'
          })
        })
      );
    });
  });

  describe('updateHooks, style settings, and presets', () => {
    it('updates hook names via PUT /api/hooks', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockNotifier = { showToast: vi.fn() };

      const session = useClipEditorSession({ notifier: mockNotifier as any });
      session.folderName.value = 'folderHooks';
      session.hooks.value = [{ theme: 'Updated Hook Name', start: 0, end: 10 }];

      await session.updateHooks();

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/hooks`,
        expect.objectContaining({
          method: 'PUT',
          body: {
            folder_name: 'folderHooks',
            hooks: [{ theme: 'Updated Hook Name', start: 0, end: 10 }]
          }
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Hook names updated',
        'success'
      );
    });

    it('saves style settings and default style settings to backend', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockSubtitleStyle = {
        getStyleSnapshot: vi.fn().mockReturnValue({ fontSize: 48 })
      };

      const session = useClipEditorSession({
        subtitleStyle: mockSubtitleStyle as any
      });
      session.folderName.value = 'f1';
      session.clipId.value = 'c1';

      await session.saveStyleSettings();
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/f1/c1`,
        expect.objectContaining({
          method: 'PUT',
          body: {
            style_settings: { fontSize: 48 }
          }
        })
      );

      await session.saveDefaultStyleSettings();
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/default-style-settings`,
        expect.objectContaining({
          method: 'PUT',
          body: { settings: { fontSize: 48 } }
        })
      );
    });

    it('toggles subtitles and persists change via saveStyleSettings', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);

      const session = useClipEditorSession();
      session.folderName.value = 'f1';
      session.clipId.value = 'c1';
      session.subtitlesEnabled.value = true;

      await session.toggleSubtitles();
      expect(session.subtitlesEnabled.value).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/f1/c1`,
        expect.anything()
      );
    });

    it('applies preset via subtitleStyle and triggers saveStyleSettings', () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockSubtitleStyle = {
        applyPreset: vi.fn(),
        getStyleSnapshot: vi.fn().mockReturnValue({})
      };

      const session = useClipEditorSession({
        subtitleStyle: mockSubtitleStyle as any
      });
      session.folderName.value = 'f1';
      session.clipId.value = 'c1';

      session.applyPreset('bold-podcast');
      expect(mockSubtitleStyle.applyPreset).toHaveBeenCalledWith(
        'bold-podcast'
      );
    });
  });

  describe('buildRenderSpec and renderClip', () => {
    it('assembles complete RenderSpec payload with safety, timeline, and subtitle data', () => {
      const mockTimeline = {
        timelineTracks: ref([
          { id: 'video', name: 'Video', type: 'video', items: [] }
        ])
      };
      const mockSubtitleStyle = {
        videoLayout: ref('landscape'),
        cropMode: ref('face_tracking'),
        cropPercentX: ref(45),
        splitZoomTop: ref(1.2),
        splitZoomBottom: ref(1.1),
        splitOffsetXTop: ref(5),
        splitOffsetYTop: ref(10),
        splitOffsetXBottom: ref(0),
        splitOffsetYBottom: ref(0),
        toRenderPayload: vi.fn().mockReturnValue({ font: 'Montserrat' })
      };
      const mockAuditor = {
        audioBleepEnabled: ref(true),
        audioBleepSource: ref('mute'),
        customBleepFile: ref(null),
        contentAudit: ref({ flaggedSegments: [{ start: 5, end: 7 }] }),
        bleepPaddingOffset: ref(150),
        bleepMode: ref('full'),
        safetySensitivity: ref('medium'),
        maskingStyle: ref('asterisks')
      };
      const mockJob = {
        jobId: ref('render-job-42'),
        jobError: ref(null)
      };

      const session = useClipEditorSession({
        timeline: mockTimeline as any,
        subtitleStyle: mockSubtitleStyle as any,
        auditor: mockAuditor as any,
        job: mockJob as any
      });

      session.videoFps.value = 60;
      session.volume.value = 0.8;
      session.fullTranscript.value = [
        { start: 0, duration: 4, text: 'Spec transcript' }
      ];

      const spec = session.buildRenderSpec(2, 'My Final Clip');

      expect(spec).toEqual(
        expect.objectContaining({
          jobId: 'render-job-42',
          hookIndex: 2,
          outputName: 'My Final Clip',
          fps: 60,
          volume: 0.8,
          videoLayout: 'landscape',
          cropMode: 'face_tracking',
          cropPercentX: 45,
          splitZoomTop: 1.2,
          splitZoomBottom: 1.1,
          splitOffsetXTop: 5,
          splitOffsetYTop: 10,
          splitOffsetXBottom: 0,
          splitOffsetYBottom: 0,
          subtitlePayload: { font: 'Montserrat' },
          timelineTracks: [
            { id: 'video', name: 'Video', type: 'video', items: [] }
          ],
          transcript: [{ start: 0, duration: 4, text: 'Spec transcript' }],
          safety: expect.objectContaining({
            audioBleepEnabled: true,
            censoredSegments: [{ start: 5, end: 7 }]
          })
        })
      );
    });

    it('sets error when jobId is missing during renderClip', async () => {
      const mockJob = { jobId: ref(null), jobError: ref(null) };
      const mockExport = { renderStatus: ref('idle'), exportClip: vi.fn() };

      const session = useClipEditorSession({
        job: mockJob as any,
        exportState: mockExport as any
      });

      await session.renderClip();

      expect(mockExport.renderStatus.value).toBe('error');
      expect(mockJob.jobError.value).toContain('No active job ID');
      expect(mockExport.exportClip).not.toHaveBeenCalled();
    });

    it('saves session before invoking exportClip during renderClip', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockJob = { jobId: ref('job-render-test'), jobError: ref(null) };
      const mockExport = {
        renderStatus: ref('idle'),
        exportClip: vi.fn().mockResolvedValue(undefined)
      };

      const session = useClipEditorSession({
        job: mockJob as any,
        exportState: mockExport as any
      });
      session.folderName.value = 'renderFolder';
      session.clipId.value = 'renderClip';

      await session.renderClip(0, 'Export Clip');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/clip-session/renderFolder/renderClip'),
        expect.objectContaining({ method: 'PUT' })
      );
      expect(mockExport.exportClip).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-render-test',
          outputName: 'Export Clip'
        })
      );
    });
  });

  describe('undo and redo integration with silent transcript save', () => {
    it('calls timeline undo and silent saveTranscript', () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockTimeline = { undo: vi.fn(), redo: vi.fn() };

      const session = useClipEditorSession({ timeline: mockTimeline as any });
      session.folderName.value = 'fUndo';
      session.clipId.value = 'cUndo';
      session.fullTranscript.value = [
        { start: 0, duration: 1, text: 'Undo me' }
      ];

      session.undo();

      expect(mockTimeline.undo).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/fUndo/cUndo`,
        expect.anything()
      );
    });

    it('calls timeline redo and silent saveTranscript', () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
      vi.stubGlobal('$fetch', mockFetch);
      const mockTimeline = { undo: vi.fn(), redo: vi.fn() };

      const session = useClipEditorSession({ timeline: mockTimeline as any });
      session.folderName.value = 'fRedo';
      session.clipId.value = 'cRedo';
      session.fullTranscript.value = [
        { start: 0, duration: 1, text: 'Redo me' }
      ];

      session.redo();

      expect(mockTimeline.redo).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/clip-session/fRedo/cRedo`,
        expect.anything()
      );
    });
  });

  describe('resetSession', () => {
    it('resets all clip-editor-specific state refs', () => {
      const session = useClipEditorSession();
      session.folderName.value = 'activeFolder';
      session.clipId.value = 'activeClip';
      session.hooks.value = [{ theme: 'Hook 1', start: 0, end: 5 }];
      session.activeHook.value = { theme: 'Active Hook', start: 0, end: 5 };
      session.fullTranscript.value = [{ start: 0, duration: 5, text: 'Hello' }];
      session.cropMap.value = [{ time: 1, x: 20, y: 30 }];

      session.resetSession();

      expect(session.folderName.value).toBeNull();
      expect(session.clipId.value).toBeNull();
      expect(session.hooks.value).toEqual([]);
      expect(session.activeHook.value).toBeNull();
      expect(session.fullTranscript.value).toEqual([]);
      expect(session.cropMap.value).toEqual([]);
    });
  });
});

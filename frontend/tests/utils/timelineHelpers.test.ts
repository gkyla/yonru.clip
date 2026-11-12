import { describe, it, expect } from 'vitest';
import {
  calculateTimelineDuration,
  calculateVideoTime,
  splitTimelineItem,
  deleteTimelineItemWithRipple,
  calculateSnapTime,
  calculateDragBounds,
  calculateRulerTicks,
  resolveCoverOffsetSec,
  toGlobalTimelineStart,
  fromGlobalTimelineStart,
  isTimelineItemActiveAtTime,
  isAudioTrack,
  getItemLeftPx,
  SUPPORTED_AUDIO_EXTENSIONS,
  AUDIO_INPUT_ACCEPT,
  isValidAudioFile,
  resolveAudioFileDuration,
  normalizeTimelineTracks,
  findVideoTrack,
  isTextTrack,
  isVideoTrack,
  createDefaultTimelineTracks,
  addTimelineTrack,
  deleteTimelineTrack,
  canDeleteTimelineTrack,
  hasTrackIntervalOverlap,
  insertItemWithAutoRoute,
  moveTimelineItemToTrack
} from '../../app/utils/timelineHelpers';

describe('Timeline Helpers TDD', () => {
  describe('Duration & VideoTime Calculations', () => {
    it('calculates duration correctly when there are no track items (empty timeline)', () => {
      expect(calculateTimelineDuration([], false, 3.0, 120)).toBe(120);
      expect(calculateTimelineDuration([], true, 3.0, 120)).toBe(123);
      expect(calculateTimelineDuration([], false, 3.0, 0)).toBe(60);
    });

    it('calculates duration correctly based on tracks with items', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 },
            { id: 'v2', start: 10, duration: 25 }
          ]
        },
        {
          id: 'text' as const,
          name: 'Text Track',
          type: 'text' as const,
          items: [{ id: 't1', start: 5, duration: 40 }]
        }
      ];
      expect(calculateTimelineDuration(tracks, false, 5.0, 120)).toBe(45);
      expect(calculateTimelineDuration(tracks, true, 5.0, 120)).toBe(50);
    });

    it('calculates duration correctly with global span audio items (audio never inflates clip duration)', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [{ id: 'v1', start: 0, duration: 20 }]
        },
        {
          id: 'audio' as const,
          name: 'Audio Track',
          type: 'audio' as const,
          items: [{ id: 'a1', start: 0, duration: 30 }]
        }
      ];
      // Video is 20s + 3s cover = 23s. Audio is 30s global. Total timeline duration MUST remain 23s.
      expect(calculateTimelineDuration(tracks, true, 3.0, 20)).toBe(23);
      // Audio is 15s global, Video is 20s + 3s = 23s. Total should still be 23s.
      tracks[1]!.items[0]!.duration = 15;
      expect(calculateTimelineDuration(tracks, true, 3.0, 20)).toBe(23);
    });

    it('maintains video duration when audio track item is split / cut', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [{ id: 'v1', start: 0, duration: 20 }]
        },
        {
          id: 'audio' as const,
          name: 'Audio Track',
          type: 'audio' as const,
          items: [{ id: 'a1', start: 0, duration: 60 }]
        }
      ];

      // Before cut: timeline duration is bounded by video (20s)
      expect(calculateTimelineDuration(tracks, false, 0, 20)).toBe(20);

      // User cuts audio at 20s
      const split = splitTimelineItem(tracks[1]!.items[0]!, 20);
      expect(split).not.toBeNull();
      tracks[1]!.items[0]!.duration = split!.firstItem.duration; // 20s
      tracks[1]!.items.push(split!.secondItem); // 20s..60s

      // After cut: timeline duration must still be 20s, NOT inflated to 60s
      expect(calculateTimelineDuration(tracks, false, 0, 20)).toBe(20);
    });

    it('excludes hidden text tracks from calculated timeline duration', () => {
      const tracks = [
        {
          id: 'text-2',
          name: 'Text 2',
          type: 'text' as const,
          hidden: true,
          items: [{ id: 't-hidden', start: 0, duration: 90 }]
        },
        {
          id: 'video',
          name: 'Main Video',
          type: 'video' as const,
          items: [{ id: 'v1', start: 0, duration: 20 }]
        },
        {
          id: 'audio',
          name: 'Audio 1',
          type: 'audio' as const,
          items: []
        }
      ];

      expect(calculateTimelineDuration(tracks, false, 0, 20)).toBe(20);
      tracks[0]!.hidden = false;
      expect(calculateTimelineDuration(tracks, false, 0, 20)).toBe(90);
    });

    it('calculates videoTime correctly inside active segment and across boundaries', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10, mediaStart: 15 },
            { id: 'v2', start: 10, duration: 25, mediaStart: 50 }
          ]
        }
      ];
      expect(calculateVideoTime(5.0, false, 0, tracks)).toBe(20.0);
      expect(calculateVideoTime(15.0, false, 0, tracks)).toBe(55.0);
      expect(calculateVideoTime(18.0, true, 3.0, tracks)).toBe(55.0);
    });
  });

  describe('Item Splitting', () => {
    it('returns null if cutTime is out of bounds', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0, mediaStart: 0 };
      expect(splitTimelineItem(item, 5.0)).toBeNull();
      expect(splitTimelineItem(item, 15.0)).toBeNull();
      expect(splitTimelineItem(item, 2.0)).toBeNull();
    });

    it('splits item and computes correct durations and mediaStarts', () => {
      const item = { id: 'v1', start: 10.0, duration: 20.0, mediaStart: 5.0 };
      const res = splitTimelineItem(item, 15.0, () => 'new_id_2');
      expect(res).not.toBeNull();
      expect(res?.firstItem).toEqual({
        id: 'v1',
        start: 10.0,
        duration: 5.0,
        mediaStart: 5.0
      });
      expect(res?.secondItem).toEqual({
        id: 'new_id_2',
        start: 15.0,
        duration: 15.0,
        mediaStart: 10.0
      });
    });
  });

  describe('Ripple Delete', () => {
    it('deletes item from non-video track without ripple shifting other tracks', () => {
      const tracks = [
        {
          id: 'text' as const,
          name: 'Text Track',
          type: 'text' as const,
          items: [
            { id: 't1', start: 5, duration: 5 },
            { id: 't2', start: 15, duration: 5 }
          ]
        },
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [{ id: 'v1', start: 0, duration: 30 }]
        }
      ];
      const res = deleteTimelineItemWithRipple(
        tracks,
        [],
        { id: 't1', start: 5, duration: 5 },
        'text',
        10.0,
        false,
        0
      );
      expect(res.updatedTracks[0]?.items.length).toBe(1);
      expect(res.updatedTracks[0]?.items[0]?.id).toBe('t2');
      expect(res.updatedTracks[0]?.items[0]?.start).toBe(15); // Not shifted
      expect(res.updatedCurrentTime).toBe(10.0);
    });

    it('performs ripple delete on video track, shifting subsequent items and subtitles', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 },
            { id: 'v2', start: 10, duration: 10 },
            { id: 'v3', start: 20, duration: 10 }
          ]
        }
      ];
      const transcript = [
        { id: 's1', start: 2, duration: 4, text: 'hello world' },
        { id: 's2', start: 12, duration: 6, text: 'middle section to delete' },
        { id: 's3', start: 22, duration: 4, text: 'ending section' }
      ];

      const res = deleteTimelineItemWithRipple(
        tracks,
        transcript,
        { id: 'v2', start: 10, duration: 10 },
        'video',
        25.0,
        false,
        0
      );

      // v3 shifted left by 10s: from 20s to 10s
      expect(res.updatedTracks[0]?.items.length).toBe(2);
      expect(res.updatedTracks[0]?.items[1]?.id).toBe('v3');
      expect(res.updatedTracks[0]?.items[1]?.start).toBe(10);

      // Playhead shifted from 25s to 15s
      expect(res.updatedCurrentTime).toBe(15.0);

      // Subtitles: s1 unchanged, s2 in deleted window removed, s3 shifted left by 10s (from 22 to 12)
      expect(res.updatedTranscript.length).toBe(2);
      expect(res.updatedTranscript[0]?.id).toBe('s1');
      expect(res.updatedTranscript[1]?.id).toBe('s3');
      expect(res.updatedTranscript[1]?.start).toBe(12);
    });
  });

  describe('Snapping Logic', () => {
    it('returns original value when snapping is disabled', () => {
      expect(calculateSnapTime(10.123, false, 100, 5, [], false, 0)).toBe(
        10.123
      );
    });

    it('snaps to nearest clip edge if within tolerance', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 } // Edge at 10.0
          ]
        }
      ];
      // Tolerance at 100px/s is 5px / 100 = 0.05s
      expect(calculateSnapTime(9.98, true, 100, 0, tracks, false, 0)).toBe(
        10.0
      );
      expect(calculateSnapTime(10.02, true, 100, 0, tracks, false, 0)).toBe(
        10.0
      );
    });

    it('snaps audio items to 0.0s, coverDuration, and currentTime within tolerance', () => {
      const tracks = [
        {
          id: 'audio' as const,
          name: 'Audio Track',
          type: 'audio' as const,
          items: [{ id: 'a1', start: 0, duration: 5 }]
        }
      ];
      // Tolerance at 100px/s is 5px / 100 = 0.05s
      // 1. Magnetic snap to 0.0s
      expect(
        calculateSnapTime(
          0.03,
          true,
          100,
          10.0,
          tracks,
          true,
          3.0,
          undefined,
          true
        )
      ).toBe(0.0);

      // 2. Magnetic snap to coverDuration (2.3s)
      expect(
        calculateSnapTime(
          2.31,
          true,
          100,
          6.7,
          tracks,
          true,
          2.3,
          undefined,
          true
        )
      ).toBe(2.3);

      // 3. Magnetic snap to currentTime (6.7s)
      expect(
        calculateSnapTime(
          6.69,
          true,
          100,
          6.7,
          tracks,
          true,
          2.3,
          undefined,
          true
        )
      ).toBe(6.7);

      // 4. Fluid unconstrained movement outside tolerance
      expect(
        calculateSnapTime(
          1.57,
          true,
          100,
          6.7,
          tracks,
          true,
          2.3,
          undefined,
          true
        )
      ).toBe(1.57);
    });
  });

  describe('Drag Bounds', () => {
    it('calculates move bounds with snap', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0 };
      const res = calculateDragBounds('move', 5.0, 2.05, item, v =>
        Math.round(v)
      );
      expect(res.newStart).toBe(7.0);
      expect(res.newDuration).toBe(10.0);
    });

    it('calculates resize end bounds with minimum duration clamp', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0 };
      const res = calculateDragBounds('end', 10.0, -15.0, item, v => v);
      expect(res.newDuration).toBe(0.1);
    });
  });

  describe('Ruler Ticks Generation', () => {
    it('generates ticks and major labels based on zoom level', () => {
      const ticks = calculateRulerTicks(1000, 100);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]?.pos).toBe(0);
      const majorTicks = ticks.filter(t => t.major && t.label);
      expect(majorTicks.length).toBeGreaterThan(0);
    });
  });

  describe('Cover Slide Global Timeline Coordinate Sync', () => {
    it('maps relative item start to/from global ruler timestamps and evaluates half-open active windows', () => {
      expect(resolveCoverOffsetSec(false, 1.5)).toBe(0);
      expect(resolveCoverOffsetSec(true, 1.5)).toBe(1.5);

      expect(toGlobalTimelineStart(0, true, 1.5)).toBe(1.5);
      expect(toGlobalTimelineStart(5, true, 1.5)).toBe(6.5);
      expect(toGlobalTimelineStart(5, false, 1.5)).toBe(5);

      expect(fromGlobalTimelineStart(1.5, true, 1.5)).toBe(0);
      expect(fromGlobalTimelineStart(6.5, true, 1.5)).toBe(5);
      expect(fromGlobalTimelineStart(0.4, true, 1.5)).toBe(0);

      const layer1 = { start: 0, duration: 5 };
      const layer2 = { start: 5, duration: 5 };

      // Hidden during Cover Slide intro window [0, 1.5s)
      expect(isTimelineItemActiveAtTime(layer1, 0.5, true, 1.5)).toBe(false);
      // Layer 1 active across [1.5s, 6.5s) — including past 5.0s on the ruler!
      expect(isTimelineItemActiveAtTime(layer1, 1.5, true, 1.5)).toBe(true);
      expect(isTimelineItemActiveAtTime(layer1, 5.5, true, 1.5)).toBe(true);
      // Clean handoff at 6.5s with no overlap between adjacent 5s layers
      expect(isTimelineItemActiveAtTime(layer1, 6.5, true, 1.5)).toBe(false);
      expect(isTimelineItemActiveAtTime(layer2, 6.5, true, 1.5)).toBe(true);
      expect(isTimelineItemActiveAtTime(layer2, 11.4, true, 1.5)).toBe(true);
      expect(isTimelineItemActiveAtTime(layer2, 11.5, true, 1.5)).toBe(false);
    });

    it('calculates item left px honoring global span audio track semantics', () => {
      expect(isAudioTrack('audio')).toBe(true);
      expect(isAudioTrack({ id: 'audio', type: 'audio' })).toBe(true);
      expect(isAudioTrack({ id: 'custom-audio', type: 'audio' })).toBe(true);
      expect(isAudioTrack('text')).toBe(false);
      expect(isAudioTrack({ id: 'text', type: 'text' })).toBe(false);

      // Non-audio items get shifted by thumbOffsetPx when cover is active
      expect(getItemLeftPx('text', 0, 100, true, 150)).toBe(150);
      expect(
        getItemLeftPx({ id: 'text', type: 'text' }, 2.5, 100, true, 150)
      ).toBe(400);
      // Non-audio items not shifted when cover is inactive
      expect(getItemLeftPx('text', 0, 100, false, 150)).toBe(0);

      // Audio items ALWAYS start at startSec * pxPerSec without thumbOffsetPx
      expect(getItemLeftPx('audio', 0, 100, true, 150)).toBe(0);
      expect(
        getItemLeftPx({ id: 'audio', type: 'audio' }, 0, 100, true, 150)
      ).toBe(0);
      expect(
        getItemLeftPx({ id: 'audio', type: 'audio' }, 2.5, 100, true, 150)
      ).toBe(250);
      expect(getItemLeftPx('audio', 1.0, 100, false, 150)).toBe(100);
    });
  });

  describe('Audio File Whitelist and Validation', () => {
    it('defines supported audio extensions and file input accept attribute excluding mp4', () => {
      expect(SUPPORTED_AUDIO_EXTENSIONS).toEqual([
        '.mp3',
        '.wav',
        '.ogg',
        '.aac',
        '.m4a',
        '.flac'
      ]);
      expect(AUDIO_INPUT_ACCEPT).toContain('.mp3');
      expect(AUDIO_INPUT_ACCEPT).toContain('.wav');
      expect(AUDIO_INPUT_ACCEPT).toContain('.ogg');
      expect(AUDIO_INPUT_ACCEPT).toContain('.aac');
      expect(AUDIO_INPUT_ACCEPT).toContain('.m4a');
      expect(AUDIO_INPUT_ACCEPT).toContain('.flac');
      // Strictly must NOT accept mp4 or video MIME types
      expect(AUDIO_INPUT_ACCEPT).not.toContain('.mp4');
      expect(AUDIO_INPUT_ACCEPT).not.toContain('video/');
    });

    it('validates audio files correctly and rejects mp4/video formats', () => {
      // Valid audio files
      expect(isValidAudioFile({ name: 'intro.mp3', type: 'audio/mpeg' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'sfx.wav', type: 'audio/wav' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'song.m4a', type: 'audio/x-m4a' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'music.ogg', type: 'audio/ogg' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'track.flac', type: 'audio/flac' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'whoosh.aac', type: 'audio/aac' })).toBe(
        true
      );
      expect(isValidAudioFile({ name: 'UPPERCASE.MP3' })).toBe(true);
      expect(isValidAudioFile({ name: 'custom.wav', type: '' })).toBe(true);

      // Strictly rejected files (MP4, video, other non-audio files)
      expect(isValidAudioFile({ name: 'video.mp4', type: 'video/mp4' })).toBe(
        false
      );
      expect(isValidAudioFile({ name: 'audio.mp4', type: 'audio/mp4' })).toBe(
        false
      );
      expect(isValidAudioFile({ name: 'recording.mp4' })).toBe(false);
      expect(
        isValidAudioFile({ name: 'movie.mov', type: 'video/quicktime' })
      ).toBe(false);
      expect(isValidAudioFile({ name: 'clip.webm', type: 'video/webm' })).toBe(
        false
      );
      expect(isValidAudioFile({ name: 'image.png', type: 'image/png' })).toBe(
        false
      );
      expect(
        isValidAudioFile({ name: 'doc.pdf', type: 'application/pdf' })
      ).toBe(false);
      expect(isValidAudioFile(null as any)).toBe(false);
      expect(isValidAudioFile(undefined as any)).toBe(false);
      expect(isValidAudioFile({ name: '' })).toBe(false);
    });

    it('resolves audio duration safely with fallback', async () => {
      // When audio metadata is not available / mock environment, falls back to 5.0s
      const fallbackDur = await resolveAudioFileDuration('invalid-data-uri');
      expect(fallbackDur).toBe(5.0);
    });
  });

  describe('Multi-Track Normalization and Type Lookups (ADR 0031)', () => {
    it('normalizes legacy [video, audio, text, subtitle] order into NLE [text, video, audio] preserving IDs and minimum tracks', () => {
      const legacyTracks = [
        {
          id: 'video',
          name: 'Main Video',
          type: 'video',
          items: [{ id: 'v1', start: 0, duration: 10 }]
        },
        {
          id: 'audio',
          name: 'Audio layers',
          type: 'audio',
          items: [{ id: 'a1', start: 0, duration: 5 }]
        },
        {
          id: 'text',
          name: 'Text layers',
          type: 'text',
          items: [{ id: 't1', start: 1, duration: 3 }]
        },
        { id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] }
      ];

      const normalized = normalizeTimelineTracks(legacyTracks as any);

      expect(normalized.map(t => t.id)).toEqual(['text', 'video', 'audio']);
      expect(normalized.map(t => t.name)).toEqual([
        'Text 1',
        'Main Video',
        'Audio 1'
      ]);
      expect(normalized[0]?.items[0]?.id).toBe('t1');
      expect(findVideoTrack(normalized)?.id).toBe('video');
      expect(isAudioTrack('audio-2')).toBe(true);
      expect(isAudioTrack({ id: 'audio-2', type: 'audio' })).toBe(true);
      expect(isTextTrack({ id: 'text-2', type: 'text' })).toBe(true);
      expect(isVideoTrack({ id: 'video', type: 'video' })).toBe(true);

      // Partial track array fills missing track types
      const videoOnly = normalizeTimelineTracks([
        { id: 'video', name: 'Main Video', type: 'video', items: [] }
      ]);
      expect(videoOnly.map(t => t.id)).toEqual(['text', 'video', 'audio']);
    });

    it('prepends new Text Tracks above, appends Audio Tracks below, and enforces minimum 1 track per type on delete', () => {
      let tracks = createDefaultTimelineTracks();
      expect(canDeleteTimelineTrack(tracks, 'text')).toBe(false);
      expect(canDeleteTimelineTrack(tracks, 'video')).toBe(false);
      expect(canDeleteTimelineTrack(tracks, 'audio')).toBe(false);

      const addedT2 = addTimelineTrack(tracks, 'text');
      tracks = addedT2.tracks;
      const addedT3 = addTimelineTrack(tracks, 'text');
      tracks = addedT3.tracks;
      const addedA2 = addTimelineTrack(tracks, 'audio');
      tracks = addedA2.tracks;

      expect(tracks.map(t => t.name)).toEqual([
        'Text 3',
        'Text 2',
        'Text 1',
        'Main Video',
        'Audio 1',
        'Audio 2'
      ]);
      expect(addedT2.newTrack.id).toBe('text-2');
      expect(addedT3.newTrack.id).toBe('text-3');
      expect(addedA2.newTrack.id).toBe('audio-2');

      // Delete middle text track (Text 2) -> succeeds
      expect(canDeleteTimelineTrack(tracks, 'text-2')).toBe(true);
      const afterDelT2 = deleteTimelineTrack(tracks, 'text-2');
      expect(afterDelT2.deleted).toBe(true);
      tracks = afterDelT2.tracks;
      expect(tracks.map(t => t.name)).toEqual([
        'Text 3',
        'Text 1',
        'Main Video',
        'Audio 1',
        'Audio 2'
      ]);

      // Adding another text track avoids duplicating 'Text 3'
      const addedT4 = addTimelineTrack(tracks, 'text');
      tracks = addedT4.tracks;
      expect(addedT4.newTrack.name).toBe('Text 4');
      expect(addedT4.newTrack.id).toBe('text-4');

      // Cannot delete last remaining audio track
      const afterDelA2 = deleteTimelineTrack(tracks, 'audio-2');
      expect(afterDelA2.deleted).toBe(true);
      const blockedDelA1 = deleteTimelineTrack(afterDelA2.tracks, 'audio');
      expect(blockedDelA1.deleted).toBe(false);
      expect(blockedDelA1.tracks.some(t => t.id === 'audio')).toBe(true);

      // Cannot delete video track
      const blockedDelVideo = deleteTimelineTrack(afterDelA2.tracks, 'video');
      expect(blockedDelVideo.deleted).toBe(false);
    });

    it('auto-routes overlapping items to free compatible tracks or auto-creates a track, respects Split forceTrack, and validates cross-track moves', () => {
      let tracks = createDefaultTimelineTracks();

      // 1. Boundary touching items do NOT overlap
      expect(
        hasTrackIntervalOverlap([{ id: 't1', start: 0, duration: 5 }], 5, 5)
      ).toBe(false);
      expect(
        hasTrackIntervalOverlap([{ id: 't1', start: 0, duration: 5 }], 4.5, 5)
      ).toBe(true);
      expect(
        hasTrackIntervalOverlap(
          [{ id: 't1', start: 0, duration: 5 }],
          2,
          3,
          't1'
        )
      ).toBe(false);

      // 2. First text item lands on Text 1 ('text')
      const r1 = insertItemWithAutoRoute(tracks, 'text', {
        id: 't1',
        start: 0,
        duration: 5,
        content: 'One'
      });
      tracks = r1.tracks;
      expect(r1.targetTrackId).toBe('text');
      expect(tracks.find(t => t.id === 'text')?.items).toHaveLength(1);

      // 3. Overlapping text item auto-creates Text 2 ('text-2') prepended above Text 1
      const r2 = insertItemWithAutoRoute(tracks, 'text', {
        id: 't2',
        start: 1,
        duration: 4,
        content: 'Two'
      });
      tracks = r2.tracks;
      expect(r2.targetTrackId).toBe('text-2');
      expect(r2.createdTrack?.id).toBe('text-2');
      expect(tracks[0]?.id).toBe('text-2');
      expect(tracks[0]?.items[0]?.id).toBe('t2');

      // 4. Active/preferred track 'text-2' overlaps at [2, 3], while Text 1 is free at [6, 3] -> routes to Text 1 without creating Text 3
      const r3 = insertItemWithAutoRoute(tracks, 'text-2', {
        id: 't3',
        start: 2,
        duration: 2,
        content: 'Three-overlap'
      });
      // [2, 2] overlaps BOTH text-2 [1..5] and text [0..5] -> creates text-3
      expect(r3.targetTrackId).toBe('text-3');
      // Now try [6, 3] targeting 'text-2' (actually free on text-2) vs busy 'text-3' with [0..10]
      const r3b = insertItemWithAutoRoute(r3.tracks, 'text-3', {
        id: 't3b',
        start: 1.5,
        duration: 2,
        content: 'Fallback'
      });
      // Overlaps text-3 [2..4], routes to free track? No, overlaps all -> wait, test free fallback at [3.5, 1.5] where text-3 [2..4] overlaps, text-2 [1..5] overlaps, but let's place an item on text at [6..9] and busy text-2 at [6..9]
      const r4 = insertItemWithAutoRoute(r3b.tracks, 'text-3', {
        id: 't4',
        start: 6,
        duration: 3,
        content: 'FreeOnText3'
      });
      expect(r4.targetTrackId).toBe('text-3');

      // Busy 'text-2' at [1..5], free 'text' at [6..9]: target 'text-2' at [2..3] is occupied, try [2..3] when 'text' is free at [7..9]
      const busyText2FreeTextTracks = insertItemWithAutoRoute(
        tracks,
        'text-2',
        { id: 't-free-fallback', start: 6, duration: 2, content: 'OnText2' }
      );
      // Now text-2 has [1..5] and [6..8]; targeting text-2 at [7..9] falls back to free 'text' without creating text-3!
      const fallbackToText1 = insertItemWithAutoRoute(
        busyText2FreeTextTracks.tracks,
        'text-2',
        {
          id: 't-routed-text1',
          start: 7,
          duration: 2,
          content: 'RoutedToText1'
        }
      );
      expect(fallbackToText1.targetTrackId).toBe('text');
      expect(fallbackToText1.createdTrack).toBeNull();

      // 5. Force same track (Split case) never spawns extra track
      const rSplit = insertItemWithAutoRoute(
        tracks,
        'text',
        { id: 't1-split', start: 5, duration: 1, content: 'Split' },
        { forceTrack: true }
      );
      tracks = rSplit.tracks;
      expect(rSplit.targetTrackId).toBe('text');
      expect(rSplit.createdTrack).toBeNull();

      // 6. Cross-track move: t2 from text-2 [1..5] -> text fails (overlaps t1 [0..5]), succeeds at [10..14]
      const blockedOverlapMove = moveTimelineItemToTrack(
        tracks,
        't2',
        'text-2',
        'text',
        1,
        4
      );
      expect(blockedOverlapMove.success).toBe(false);
      expect(blockedOverlapMove.reason).toBe('overlap');

      const blockedCrossTypeMove = moveTimelineItemToTrack(
        tracks,
        't2',
        'text-2',
        'audio',
        10,
        4
      );
      expect(blockedCrossTypeMove.success).toBe(false);
      expect(blockedCrossTypeMove.reason).toBe('type-mismatch');

      const validMove = moveTimelineItemToTrack(
        tracks,
        't2',
        'text-2',
        'text',
        10,
        4
      );
      expect(validMove.success).toBe(true);
      expect(
        validMove.tracks
          .find(t => t.id === 'text-2')
          ?.items.some(i => i.id === 't2')
      ).toBe(false);
      expect(
        validMove.tracks
          .find(t => t.id === 'text')
          ?.items.some(i => i.id === 't2' && i.start === 10)
      ).toBe(true);
    });
  });
});

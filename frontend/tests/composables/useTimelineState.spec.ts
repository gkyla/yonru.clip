// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from '#app';
import { useTimelineState } from '../../app/composables/useTimelineState';
import type { TimelineTrack } from '../../app/types/clipper';

vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 'ok' }));

describe('useTimelineState Multi-Track Behavior', () => {
  beforeEach(() => {
    const tracks = useState<TimelineTrack[]>('timelineTracks');
    tracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
    useState<any[]>('timelineUndoStack', () => []).value = [];
    useState<any[]>('timelineRedoStack', () => []).value = [];
    useState<any>('selectedTimelineItem', () => null).value = null;
    useState<Record<string, string>>('activeTrackIds', () => ({
      text: 'text',
      audio: 'audio'
    })).value = { text: 'text', audio: 'audio' };
    useState<boolean>('coverEnabled', () => false).value = false;
    useState<number>('coverDuration', () => 1.0).value = 1.0;
    useState<number>('videoDuration', () => 30).value = 30;
    useState<number>('currentTime', () => 0).value = 0;
  });

  it('adds, deletes, and undoes/redoes Text and Audio tracks while enforcing minimum 1 track per type', () => {
    const timeline = useTimelineState();

    expect(timeline.timelineTracks.value.map(t => t.id)).toEqual([
      'text',
      'video',
      'audio'
    ]);
    expect(timeline.canDeleteTrack('text')).toBe(false);
    expect(timeline.canDeleteTrack('video')).toBe(false);
    expect(timeline.canDeleteTrack('audio')).toBe(false);

    const text2 = timeline.addTrack('text');
    const audio2 = timeline.addTrack('audio');

    expect(text2.id).toBe('text-2');
    expect(audio2.id).toBe('audio-2');
    expect(timeline.timelineTracks.value.map(t => t.id)).toEqual([
      'text-2',
      'text',
      'video',
      'audio',
      'audio-2'
    ]);
    expect(timeline.canDeleteTrack('text')).toBe(true);
    expect(timeline.canDeleteTrack('text-2')).toBe(true);

    // Undo removing audio-2
    timeline.undo();
    expect(timeline.timelineTracks.value.map(t => t.id)).toEqual([
      'text-2',
      'text',
      'video',
      'audio'
    ]);

    // Redo restores audio-2
    timeline.redo();
    expect(timeline.timelineTracks.value.map(t => t.id)).toEqual([
      'text-2',
      'text',
      'video',
      'audio',
      'audio-2'
    ]);

    // Delete text-2 and block deleting last remaining 'text'
    expect(timeline.deleteTrack('text-2')).toBe(true);
    expect(timeline.deleteTrack('text')).toBe(false);
    expect(timeline.timelineTracks.value.map(t => t.id)).toEqual([
      'text',
      'video',
      'audio',
      'audio-2'
    ]);
  });

  it('routes new items to active/free/auto-created tracks, applies text defaults to any text track, supports mute/hide, move, forceTrack split, and rehydrates audio-2 media', () => {
    const timeline = useTimelineState();

    // 1. Add first text item -> lands on 'text' with text styling & content
    timeline.addTimelineItem('text', {
      id: 't1',
      start: 0,
      duration: 5,
      content: 'First'
    });
    // 2. Add overlapping text item -> auto-creates 'text-2' and inherits text properties
    timeline.addTimelineItem('text', {
      id: 't2',
      start: 1,
      duration: 4,
      content: 'Second'
    });

    const text2Track = timeline.timelineTracks.value.find(
      t => t.id === 'text-2'
    );
    expect(text2Track).toBeDefined();
    expect(text2Track?.items[0]?.id).toBe('t2');
    expect(text2Track?.items[0]?.type).toBe('text');
    expect(text2Track?.items[0]?.linkToGlobal).toBe(true);

    // 3. forceTrack keeps split item on same track without creating text-3
    timeline.addTimelineItem(
      'text',
      { id: 't1-half', start: 2, duration: 2, content: 'Forced' },
      { forceTrack: true }
    );
    expect(
      timeline.timelineTracks.value.filter(t => t.type === 'text')
    ).toHaveLength(2);
    expect(
      timeline.timelineTracks.value
        .find(t => t.id === 'text')
        ?.items.some(i => i.id === 't1-half')
    ).toBe(true);

    // 4. Mute / Visibility toggles apply only to matching track types & are undoable
    expect(timeline.toggleTrackMute('text')).toBe(false);
    expect(timeline.toggleTrackVisibility('audio')).toBe(false);
    expect(timeline.toggleTrackMute('audio')).toBe(true);
    expect(timeline.toggleTrackVisibility('text-2')).toBe(true);
    expect(
      timeline.timelineTracks.value.find(t => t.id === 'audio')?.muted
    ).toBe(true);
    expect(
      timeline.timelineTracks.value.find(t => t.id === 'text-2')?.hidden
    ).toBe(true);

    timeline.undo();
    expect(
      timeline.timelineTracks.value.find(t => t.id === 'text-2')?.hidden
    ).toBeFalsy();

    // 5. Move item vertically across same-type tracks
    expect(
      timeline.moveTimelineItemToTrack('t2', 'text-2', 'text', 12, 4)
    ).toBe(true);
    expect(
      timeline.timelineTracks.value
        .find(t => t.id === 'text')
        ?.items.some(i => i.id === 't2' && i.start === 12)
    ).toBe(true);

    // 6. Hydrate audio-2 Audio Library URL directly from loaded history
    const audio2 = timeline.addTrack('audio');
    timeline.addTimelineItem(audio2.id, {
      id: 'a2-item',
      name: 'sfx.mp3',
      start: 0,
      duration: 3,
      src: '/assets/audio_library/sfx.mp3'
    });
    timeline.loadHistoryFromResponse({
      undo_stack: [
        {
          tracks: [
            { id: 'text', name: 'Text 1', type: 'text', items: [] },
            { id: 'video', name: 'Main Video', type: 'video', items: [] },
            { id: 'audio', name: 'Audio 1', type: 'audio', items: [] },
            {
              id: 'audio-2',
              name: 'Audio 2',
              type: 'audio',
              items: [
                {
                  id: 'a2-item',
                  name: 'sfx.mp3',
                  start: 0,
                  duration: 3,
                  type: 'audio',
                  src: '/assets/audio_library/sfx.mp3'
                }
              ]
            }
          ],
          transcript: [],
          selectedId: null
        }
      ],
      redo_stack: []
    });
    const hydratedItem = timeline.timelineUndoStack.value[0]?.tracks.find(
      t => t.id === 'audio-2'
    )?.items[0];
    expect(hydratedItem?.src).toBe('/assets/audio_library/sfx.mp3');
  });

  it('preserves explicit duration when splitting video, text, or audio items and when adding video segments, while still clamping newly inserted long audio/text items', () => {
    const timeline = useTimelineState();

    // 1. Video split [0..20] at t=8 -> [0..8] + [8..20]
    timeline.timelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 20, mediaStart: 0 }]
      },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
    useState<number>('videoDuration').value = 20;

    timeline.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items[0]!.duration = 8;
    timeline.addTimelineItem(
      'video',
      { id: 'v2', start: 8, duration: 12, mediaStart: 8 },
      { forceTrack: true }
    );

    let videoItems = timeline.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(2);
    expect(videoItems[1]).toMatchObject({
      id: 'v2',
      start: 8,
      duration: 12,
      mediaStart: 8
    });

    // 2. Short video split tail < 0.5s preserves exact 0.2s duration
    videoItems[1]!.duration = 11.8;
    timeline.addTimelineItem(
      'video',
      { id: 'v3', start: 19.8, duration: 0.2, mediaStart: 19.8 },
      { forceTrack: true }
    );

    videoItems = timeline.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems[2]).toMatchObject({
      id: 'v3',
      start: 19.8,
      duration: 0.2,
      mediaStart: 19.8
    });

    // 3. Direct video segment append without forceTrack preserves explicit duration
    timeline.addTimelineItem('video', {
      id: 'v4',
      start: 20,
      duration: 5,
      mediaStart: 20
    });
    videoItems = timeline.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems[3]).toMatchObject({
      id: 'v4',
      start: 20,
      duration: 5,
      mediaStart: 20
    });

    // 4. Text split when text extends past video [0..10]
    timeline.timelineTracks.value = [
      {
        id: 'text',
        name: 'Text 1',
        type: 'text',
        items: [{ id: 't1', start: 0, duration: 25, content: 'Long text' }]
      },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 10 }]
      },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
    useState<number>('videoDuration').value = 10;

    timeline.timelineTracks.value.find(
      t => t.id === 'text'
    )!.items[0]!.duration = 22;
    timeline.addTimelineItem(
      'text',
      { id: 't2', start: 22, duration: 3, content: 'Tail' },
      { forceTrack: true }
    );
    const textItems = timeline.timelineTracks.value.find(
      t => t.id === 'text'
    )!.items;
    expect(textItems[1]?.duration).toBe(3);

    // 5. Audio split when audio extends past video [0..10]
    timeline.timelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 10 }]
      },
      {
        id: 'audio',
        name: 'Audio 1',
        type: 'audio',
        items: [{ id: 'a1', start: 0, duration: 40, name: 'Song.mp3' }]
      }
    ];
    timeline.timelineTracks.value.find(
      t => t.id === 'audio'
    )!.items[0]!.duration = 20;
    timeline.addTimelineItem(
      'audio',
      { id: 'a2', start: 20, duration: 20, name: 'Song.mp3' },
      { forceTrack: true }
    );
    const audioItems = timeline.timelineTracks.value.find(
      t => t.id === 'audio'
    )!.items;
    expect(audioItems[1]?.duration).toBe(20);

    // 6. Clamping guard: newly inserted long audio or default text WITHOUT forceTrack still clamps
    timeline.timelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 20 }]
      },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
    useState<number>('videoDuration').value = 20;
    useState<boolean>('coverEnabled').value = false;
    useState<number>('coverDuration').value = 0;

    timeline.addTimelineItem('audio', {
      id: 'a-long',
      name: 'bgm.mp3',
      start: 5,
      duration: 180
    });
    const clampedAudio = timeline.timelineTracks.value
      .find(t => t.id === 'audio')
      ?.items.find(i => i.id === 'a-long');
    expect(clampedAudio?.duration).toBe(15);

    timeline.addTimelineItem('text', {
      id: 't-default',
      start: 18,
      content: 'End'
    });
    const clampedText = timeline.timelineTracks.value
      .find(t => t.id === 'text')
      ?.items.find(i => i.id === 't-default');
    expect(clampedText?.duration).toBe(2);
  });
});

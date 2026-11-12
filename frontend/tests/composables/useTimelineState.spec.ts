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

    // 6. Rehydrate audio-2 inline data URL from currentTracks into loaded history
    const audio2 = timeline.addTrack('audio');
    timeline.addTimelineItem(audio2.id, {
      id: 'a2-item',
      name: 'sfx.mp3',
      start: 0,
      duration: 3,
      src: 'data:audio/mp3;base64,SUQz'
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
                  type: 'audio'
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
    const rehydratedItem = timeline.timelineUndoStack.value[0]?.tracks.find(
      t => t.id === 'audio-2'
    )?.items[0];
    expect(rehydratedItem?.src).toBe('data:audio/mp3;base64,SUQz');
  });
});

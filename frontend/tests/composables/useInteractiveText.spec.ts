// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useClipperState } from '../../app/composables/useClipperState';
import { useInteractiveText } from '../../app/composables/useInteractiveText';
import {
  useSnappingGuides,
  CANVAS_CENTER_X,
  CANVAS_CENTER_Y
} from '../../app/composables/useSnappingGuides';

describe('useInteractiveText Composable - Text Drag Snapping', () => {
  let textState: ReturnType<typeof useInteractiveText>;
  let snapping: ReturnType<typeof useSnappingGuides>;

  beforeEach(() => {
    snapping = useSnappingGuides();
    snapping.isSnappingEnabled.value = true;
    snapping.clearGuides();

    const transformerRef = ref(null);
    textState = useInteractiveText(transformerRef);
  });

  it('snaps text object center to canvas center X and Y during onTextDragMove (matching Cover Slide)', () => {
    let currentPos = { x: 385, y: 905 };
    const mockNode = {
      x: () => currentPos.x,
      y: () => currentPos.y,
      width: () => 300,
      height: () => 100,
      position: (pos: { x: number; y: number }) => {
        currentPos = pos;
      }
    };

    const mockEvent = {
      target: mockNode,
      evt: { altKey: false, metaKey: false }
    };

    textState.onTextDragMove(mockEvent, null);

    // Object center X (385 + 150 = 535) is within 20px of 540 -> snaps to 540 - 150 = 390
    // Object center Y (905 + 50 = 955) is within 20px of 960 -> snaps to 960 - 50 = 910
    expect(currentPos.x).toBe(CANVAS_CENTER_X - 150);
    expect(currentPos.y).toBe(CANVAS_CENTER_Y - 50);

    expect(snapping.activeGuides.value.vertical).toEqual({
      position: CANVAS_CENTER_X,
      type: 'center'
    });
    expect(snapping.activeGuides.value.horizontal).toEqual({
      position: CANVAS_CENTER_Y,
      type: 'center'
    });
  });

  it('saves snapped coordinates to timeline item on onTextDragEnd and clears guides', () => {
    let currentPos = { x: 390, y: 910 };
    const mockNode = {
      x: () => currentPos.x,
      y: () => currentPos.y,
      width: () => 300,
      height: () => 100,
      position: (pos: { x: number; y: number }) => {
        currentPos = pos;
      }
    };

    const item: any = { x: 0, y: 0 };
    textState.onTextDragEnd({ target: mockNode }, item);

    expect(item.x).toBe(390);
    expect(item.y).toBe(910);
    expect(snapping.activeGuides.value).toEqual({});
  });

  it('bypasses snapping when Alt key is pressed during onTextDragMove', () => {
    let currentPos = { x: 385, y: 905 };
    const mockNode = {
      x: () => currentPos.x,
      y: () => currentPos.y,
      width: () => 300,
      height: () => 100,
      position: (pos: { x: number; y: number }) => {
        currentPos = pos;
      }
    };

    const mockEvent = {
      target: mockNode,
      evt: { altKey: true, metaKey: false }
    };

    textState.onTextDragMove(mockEvent, null);

    // Should not snap
    expect(currentPos.x).toBe(385);
    expect(currentPos.y).toBe(905);
    expect(snapping.activeGuides.value).toEqual({});
  });
});

describe('useInteractiveText & addTimelineItem Cover Slide Synchronization', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.coverEnabled.value = true;
    state.coverDuration.value = 1.5;
    state.videoDuration.value = 12;
    state.currentTime.value = 0;
    state.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', name: 'Main Video', start: 0, duration: 12 }]
      },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
      { id: 'text', name: 'Text layers', type: 'text', items: [] }
    ];
  });

  it('places newly added text items aligned with the Playhead relative to Cover Slide offset and synchronizes active preview items', () => {
    const state = useClipperState();

    // 1. Playhead at 1.5s (right after 1.5s Cover Slide): adding 5s Text Layer 1
    state.currentTime.value = 1.5;
    state.addTimelineItem('text', {
      id: 't1',
      content: 'Layer 1',
      duration: 5
    });

    // 2. Playhead at 6.5s (right at end of Layer 1 on ruler): adding 5s Text Layer 2
    state.currentTime.value = 6.5;
    state.addTimelineItem('text', {
      id: 't2',
      content: 'Layer 2',
      duration: 5
    });

    const textTrack = state.timelineTracks.value.find(t => t.id === 'text')!;
    expect(textTrack.items[0]!.start).toBe(0);
    expect(textTrack.items[0]!.duration).toBe(5);
    expect(textTrack.items[1]!.start).toBe(5);
    expect(textTrack.items[1]!.duration).toBe(5);

    const { activeTextItems, isTimelineTextActiveAndSelected } =
      useInteractiveText(ref(null));

    // During Cover Slide [0, 1.5s): no timeline text overlay is active
    state.currentTime.value = 0.8;
    expect(activeTextItems.value.map(i => i.id)).toEqual([]);

    // Scrubbing past 5.0s on ruler (e.g. 5.5s, inside Layer 1's 1.5s..6.5s block): Layer 1 stays active!
    state.selectedTimelineItem.value = textTrack.items[0]!;
    state.currentTime.value = 5.5;
    expect(activeTextItems.value.map(i => i.id)).toEqual(['t1']);
    expect(isTimelineTextActiveAndSelected.value).toBe(true);

    // At 6.5s on ruler: clean handoff from Layer 2 with zero overlap
    state.currentTime.value = 6.5;
    expect(activeTextItems.value.map(i => i.id)).toEqual(['t2']);
    expect(isTimelineTextActiveAndSelected.value).toBe(false);
  });

  it('auto-anchors newly added audio items to 0.0s when playhead is in cover slide, and to currentTime in main video', () => {
    const state = useClipperState();
    state.coverEnabled.value = true;
    state.coverDuration.value = 2.0;
    state.videoDuration.value = 20;

    // 1. Playhead inside Cover Slide window (0.8s < 2.0s) -> auto-anchors to 0.0s
    state.currentTime.value = 0.8;
    state.addTimelineItem('audio', {
      id: 'a1',
      name: 'intro-swoosh.mp3',
      duration: 3
    });

    const audioTrack = state.timelineTracks.value.find(t => t.id === 'audio')!;
    expect(audioTrack.items[0]!.start).toBe(0.0);
    expect(audioTrack.items[0]!.duration).toBe(3);
    expect(audioTrack.items[0]!.content).toBeUndefined();

    // 2. Playhead inside main video (5.5s >= 2.0s) -> anchors to currentTime (5.5s)
    state.currentTime.value = 5.5;
    state.addTimelineItem('audio', {
      id: 'a2',
      name: 'bgm.mp3',
      duration: 10
    });

    expect(audioTrack.items[1]!.start).toBe(5.5);
    expect(audioTrack.items[1]!.duration).toBe(10);

    // 3. Explicit start parameter is preserved
    state.addTimelineItem('audio', {
      id: 'a3',
      name: 'fx.mp3',
      start: 1.2,
      duration: 2
    });
    expect(audioTrack.items[2]!.start).toBe(1.2);
  });
});

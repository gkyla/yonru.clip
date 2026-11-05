// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
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

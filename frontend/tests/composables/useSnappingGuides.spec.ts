// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSnappingGuides,
  CANVAS_CENTER_X,
  CANVAS_CENTER_Y,
  PLATFORM_SAFE_BOUNDS
} from '../../app/composables/useSnappingGuides';

describe('useSnappingGuides Composable', () => {
  let guides: ReturnType<typeof useSnappingGuides>;

  beforeEach(() => {
    guides = useSnappingGuides();
    guides.isSnappingEnabled.value = true;
    guides.clearGuides();
  });

  it('snaps text center X to canvas center (540) when within threshold (20px)', () => {
    const result = guides.calculateSnap({
      x: 545,
      y: 800,
      width: 200,
      height: 60,
      isCentered: true,
      platform: 'none'
    });

    expect(result.snappedX).toBe(CANVAS_CENTER_X);
    expect(result.snappedY).toBe(800);
    expect(result.activeGuides.vertical).toEqual({
      position: CANVAS_CENTER_X,
      type: 'center'
    });
    expect(result.activeGuides.horizontal).toBeUndefined();
  });

  it('snaps text center Y to canvas center (960) independently of X', () => {
    const result = guides.calculateSnap({
      x: 300,
      y: 955,
      width: 200,
      height: 60,
      isCentered: true,
      platform: 'none'
    });

    expect(result.snappedX).toBe(300);
    expect(result.snappedY).toBe(CANVAS_CENTER_Y);
    expect(result.activeGuides.vertical).toBeUndefined();
    expect(result.activeGuides.horizontal).toEqual({
      position: CANVAS_CENTER_Y,
      type: 'center'
    });
  });

  it('snaps both X and Y simultaneously when both are near center', () => {
    const result = guides.calculateSnap({
      x: 535,
      y: 968,
      width: 200,
      height: 60,
      isCentered: true,
      platform: 'none'
    });

    expect(result.snappedX).toBe(CANVAS_CENTER_X);
    expect(result.snappedY).toBe(CANVAS_CENTER_Y);
    expect(result.activeGuides.vertical?.type).toBe('center');
    expect(result.activeGuides.horizontal?.type).toBe('center');
  });

  it('snaps outer bottom edge to TikTok safe zone bottom boundary (1470px)', () => {
    // If text height = 100, isCentered = true, bottom edge = y + 50.
    // If y = 1415, bottom edge = 1465 (distance to 1470 is 5px <= 20).
    // Snapped center y should be 1470 - 50 = 1420.
    const result = guides.calculateSnap({
      x: 300,
      y: 1415,
      width: 300,
      height: 100,
      isCentered: true,
      platform: 'tiktok'
    });

    expect(result.snappedY).toBe(1420);
    expect(result.activeGuides.horizontal).toEqual({
      position: PLATFORM_SAFE_BOUNDS.tiktok.bottom,
      type: 'safe'
    });
  });

  it('snaps outer top edge to TikTok safe zone top boundary (210px)', () => {
    // Text height = 80, isCentered = true, top edge = y - 40.
    // If y = 245, top edge = 205 (distance to 210 is 5px <= 20).
    // Snapped center y should be 210 + 40 = 250.
    const result = guides.calculateSnap({
      x: 300,
      y: 245,
      width: 200,
      height: 80,
      isCentered: true,
      platform: 'tiktok'
    });

    expect(result.snappedY).toBe(250);
    expect(result.activeGuides.horizontal).toEqual({
      position: PLATFORM_SAFE_BOUNDS.tiktok.top,
      type: 'safe'
    });
  });

  it('bypasses snapping completely when isAltPressed is true', () => {
    const result = guides.calculateSnap({
      x: 545,
      y: 965,
      width: 200,
      height: 60,
      isCentered: true,
      isAltPressed: true
    });

    expect(result.snappedX).toBe(545);
    expect(result.snappedY).toBe(965);
    expect(result.activeGuides).toEqual({});
  });

  it('bypasses snapping completely when isSnappingEnabled is false', () => {
    guides.isSnappingEnabled.value = false;

    const result = guides.calculateSnap({
      x: 545,
      y: 965,
      width: 200,
      height: 60,
      isCentered: true
    });

    expect(result.snappedX).toBe(545);
    expect(result.snappedY).toBe(965);
    expect(result.activeGuides).toEqual({});
  });

  it('handles non-centered anchor correctly (e.g. top-left anchor)', () => {
    // If anchor is top-left, x=435, width=200, center X = 435 + 100 = 535 (distance to 540 is 5px <= 20).
    // Snapped x should be 540 - 100 = 440.
    const result = guides.calculateSnap({
      x: 435,
      y: 500,
      width: 200,
      height: 60,
      isCentered: false
    });

    expect(result.snappedX).toBe(440);
    expect(result.activeGuides.vertical).toEqual({
      position: CANVAS_CENTER_X,
      type: 'center'
    });
  });

  it('toggles isSnappingEnabled and clears active guides', () => {
    expect(guides.isSnappingEnabled.value).toBe(true);
    guides.toggleSnapping();
    expect(guides.isSnappingEnabled.value).toBe(false);

    guides.activeGuides.value = {
      vertical: { position: 540, type: 'center' }
    };
    guides.clearGuides();
    expect(guides.activeGuides.value).toEqual({});
  });
});

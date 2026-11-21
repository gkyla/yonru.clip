// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useState } from '#app';
import TimelineEditor from '../../app/components/TimelineEditor.vue';
import { useClipperState } from '../../app/composables/useClipperState';

vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 'ok' }));

describe('TimelineEditor Main Video Split Integration', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    const state = useClipperState();
    state.timelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [
          { id: 'v1', name: 'Clip 1', start: 0, duration: 20, mediaStart: 0 }
        ]
      },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
    state.videoDuration.value = 20;
    state.currentTime.value = 0;
    state.isPlaying.value = false;
    state.selectedTimelineItem.value = null;
    state.coverEnabled.value = false;
    state.coverDuration.value = 1.5;
    state.outputUrl.value = null;
    state.renderStatus.value = 'idle';
    state.isOverlayVisible.value = false;
    useState<any[]>('timelineUndoStack', () => []).value = [];
    useState<any[]>('timelineRedoStack', () => []).value = [];
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  const mountTimeline = () => {
    wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true
        }
      }
    });
    return wrapper;
  };

  it('preserves right-side duration and mediaStart when splitting Main Video with Cover disabled', async () => {
    const state = useClipperState();
    const videoItem = state.timelineTracks.value.find(t => t.type === 'video')!
      .items[0]!;
    state.selectedTimelineItem.value = videoItem;
    state.currentTime.value = 8;

    const tl = mountTimeline();
    await nextTick();

    await tl.find('button[title*="Split"]').trigger('click');
    await nextTick();

    const videoItems = state.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(2);
    expect(videoItems[0]).toMatchObject({
      start: 0,
      duration: 8,
      mediaStart: 0
    });
    expect(videoItems[1]).toMatchObject({
      start: 8,
      duration: 12,
      mediaStart: 8
    });
    expect(state.selectedTimelineItem.value).toMatchObject({
      id: videoItems[1]!.id,
      duration: 12
    });
  });

  it('preserves right-side duration and mediaStart when splitting Main Video with Cover enabled', async () => {
    const state = useClipperState();
    state.coverEnabled.value = true;
    state.coverDuration.value = 3;
    await nextTick();

    const videoItem = state.timelineTracks.value.find(t => t.type === 'video')!
      .items[0]!;
    state.selectedTimelineItem.value = videoItem;
    state.currentTime.value = 8; // 5s relative to Main Video after 3s cover

    const tl = mountTimeline();
    await nextTick();

    await tl.find('button[title*="Split"]').trigger('click');
    await nextTick();

    const videoItems = state.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(2);
    expect(videoItems[0]).toMatchObject({
      start: 0,
      duration: 5,
      mediaStart: 0
    });
    expect(videoItems[1]).toMatchObject({
      start: 5,
      duration: 15,
      mediaStart: 5
    });
  });

  it('preserves contiguous durations across consecutive Main Video splits', async () => {
    const state = useClipperState();
    const videoItem = state.timelineTracks.value.find(t => t.type === 'video')!
      .items[0]!;
    state.selectedTimelineItem.value = videoItem;
    state.currentTime.value = 8;

    const tl = mountTimeline();
    await nextTick();

    const splitBtn = tl.find('button[title*="Split"]');
    await splitBtn.trigger('click');
    await nextTick();

    // Right segment [8..20] is now selected; split it again at 14s -> [8..14] and [14..20]
    state.currentTime.value = 14;
    await nextTick();
    await splitBtn.trigger('click');
    await nextTick();

    const videoItems = state.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(3);
    expect(videoItems.map(i => i.duration)).toEqual([8, 6, 6]);
    expect(videoItems.map(i => i.start)).toEqual([0, 8, 14]);
    expect(videoItems.map(i => i.mediaStart)).toEqual([0, 8, 14]);
  });

  it('restores original 20s segment on Undo and [8s, 12s] split segments on Redo', async () => {
    const state = useClipperState();
    const videoItem = state.timelineTracks.value.find(t => t.type === 'video')!
      .items[0]!;
    state.selectedTimelineItem.value = videoItem;
    state.currentTime.value = 8;

    const tl = mountTimeline();
    await nextTick();

    await tl.find('button[title*="Split"]').trigger('click');
    await nextTick();

    expect(
      state.timelineTracks.value.find(t => t.type === 'video')!.items
    ).toHaveLength(2);

    state.undo();
    await nextTick();
    let videoItems = state.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(1);
    expect(videoItems[0]).toMatchObject({ start: 0, duration: 20 });

    state.redo();
    await nextTick();
    videoItems = state.timelineTracks.value.find(
      t => t.type === 'video'
    )!.items;
    expect(videoItems).toHaveLength(2);
    expect(videoItems[0]).toMatchObject({ start: 0, duration: 8 });
    expect(videoItems[1]).toMatchObject({ start: 8, duration: 12 });
  });
});

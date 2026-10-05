// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ReelsSafeZoneOverlay from '../../app/components/preview/ReelsSafeZoneOverlay.vue';
import { useClipperState } from '../../app/composables/useClipperState';

describe('ReelsSafeZoneOverlay Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.activeHook.value = null;
    state.videoTitle.value = '';
  });

  it('mounts successfully with root pointer-events-none and default opacity', () => {
    const wrapper = mount(ReelsSafeZoneOverlay, {
      props: {
        opacity: 75
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.classes()).toContain('pointer-events-none');
    expect(wrapper.attributes('style')).toContain('opacity: 0.75');
  });

  it('renders authentic 1:1 vector status bar and Reels top header', () => {
    const wrapper = mount(ReelsSafeZoneOverlay);

    // Status bar metrics & elements (85px height & px-11 padding unified with TikTok)
    const statusBar = wrapper.find('.status-bar-container');
    expect(statusBar.exists()).toBe(true);
    expect(statusBar.classes()).toContain('h-[85px]');
    expect(statusBar.classes()).toContain('px-11');
    expect(wrapper.text()).toContain('9:41');
    expect(wrapper.find('.status-icons').exists()).toBe(true);

    // Reels Top Header & elements
    expect(wrapper.find('.reels-header-container').exists()).toBe(true);
    expect(wrapper.text()).toContain('Reels');
    expect(wrapper.find('.reels-chevron-icon').exists()).toBe(true);
    expect(wrapper.find('.friends-tab').exists()).toBe(true);
    expect(wrapper.text()).toContain('Friends');
  });

  it('dynamically renders active hook theme and video title', () => {
    const state = useClipperState();
    state.activeHook.value = {
      theme: 'Tips Konten Viral Reels',
      start: 5,
      end: 35
    };
    state.videoTitle.value = 'Rahasia Algoritma Instagram';

    const wrapper = mount(ReelsSafeZoneOverlay);

    expect(wrapper.text()).toContain('Tips Konten Viral Reels');
    expect(wrapper.text()).toContain('Rahasia Algoritma Instagram');
    expect(wrapper.text()).toContain('yonru.clip');
  });

  it('prefers custom prop overrides over state defaults', () => {
    const wrapper = mount(ReelsSafeZoneOverlay, {
      props: {
        username: 'creator.pro',
        caption: 'Strategi reels 2026 yang wajib kamu tahu! #tips',
        soundTitle: 'Original audio - creator.pro'
      }
    });

    expect(wrapper.text()).toContain('creator.pro');
    expect(wrapper.text()).toContain(
      'Strategi reels 2026 yang wajib kamu tahu! #tips'
    );
    expect(wrapper.text()).toContain('Original audio - creator.pro');
  });

  it('renders right interaction column with Heart, Comment, Share, More options, and audio album square', () => {
    const wrapper = mount(ReelsSafeZoneOverlay);

    // Verify interaction stack counters
    expect(wrapper.text()).toContain('211RB');
    expect(wrapper.text()).toContain('92');
    expect(wrapper.text()).toContain('143RB');

    // Verify SVGs: Like, Comment, Repost, Share, Bookmark, More
    const actionSvgs = wrapper.findAll('.action-item svg');
    expect(actionSvgs.length).toBeGreaterThanOrEqual(5);

    // Verify Audio Album Artwork Square
    const audioSquare = wrapper.find('.reels-audio-square');
    expect(audioSquare.exists()).toBe(true);
  });

  it('renders bottom metadata with creator avatar, username, follow button, caption, and audio ticker', () => {
    const wrapper = mount(ReelsSafeZoneOverlay);

    const avatar = wrapper.find('img[alt="creator avatar"]');
    expect(avatar.exists()).toBe(true);
    expect(avatar.attributes('src')).toBe('/favicon.svg');

    const followBtn = wrapper.find('.reels-follow-btn');
    expect(followBtn.exists()).toBe(true);
    expect(followBtn.text()).toContain('Follow');

    const audioTicker = wrapper.find('.sound-container');
    expect(audioTicker.exists()).toBe(true);
  });

  it('does not render bottom navigation bar to keep video preview clean and unobscured', () => {
    const wrapper = mount(ReelsSafeZoneOverlay);

    const bottomBar = wrapper.find('.bottom-nav-bar-container');
    expect(bottomBar.exists()).toBe(false);
  });

  it('dynamically computes and renders playback scrubber progress line', () => {
    // 1. With explicit progress prop
    const wrapperProp = mount(ReelsSafeZoneOverlay, {
      props: { progress: 65 }
    });
    const bar = wrapperProp.find('.reels-progress-bar div');
    expect(bar.exists()).toBe(true);
    expect(bar.attributes('style')).toContain('width: 65%');

    // 2. Bound dynamically to state.currentTime and state.timelineTracks
    const state = useClipperState();
    state.currentTime.value = 15;
    state.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [
          {
            id: 'v1',
            start: 0,
            duration: 60,
            type: 'video',
            label: 'Video',
            trackId: 'video'
          }
        ]
      }
    ]; // 15 / 60 = 25%

    const wrapperState = mount(ReelsSafeZoneOverlay);
    const stateBar = wrapperState.find('.reels-progress-bar div');
    expect(stateBar.attributes('style')).toContain('width: 25%');
  });
});

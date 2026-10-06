// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import YouTubeShortsSafeZoneOverlay from '../../app/components/preview/YouTubeShortsSafeZoneOverlay.vue';
import { useClipperState } from '../../app/composables/useClipperState';

describe('YouTubeShortsSafeZoneOverlay Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.activeHook.value = null;
    state.videoTitle.value = '';
  });

  it('mounts successfully with root pointer-events-none and default opacity', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay, {
      props: {
        opacity: 85
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.classes()).toContain('pointer-events-none');
    expect(wrapper.attributes('style')).toContain('opacity: 0.85');
  });

  it('renders authentic 1:1 vector status bar and YouTube Shorts top navigation header', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    // Status bar metrics & elements (85px height unified across platforms)
    const statusBar = wrapper.find('.status-bar-container');
    expect(statusBar.exists()).toBe(true);
    expect(statusBar.classes()).toContain('h-[85px]');
    expect(statusBar.classes()).toContain('px-11');
    expect(wrapper.text()).toContain('9:41');
    expect(wrapper.find('.status-icons').exists()).toBe(true);

    // Top Navigation header & controls (115px height, total 200px)
    const headerNav = wrapper.find('.shorts-nav-bar-container');
    expect(headerNav.exists()).toBe(true);
    expect(headerNav.classes()).toContain('h-[115px]');
    expect(wrapper.find('.shorts-camera-button').exists()).toBe(true);
    expect(wrapper.find('.shorts-search-button').exists()).toBe(true);
    expect(wrapper.find('.shorts-more-button').exists()).toBe(true);
  });

  it('dynamically renders active hook theme and video title in channel metadata', () => {
    const state = useClipperState();
    state.activeHook.value = {
      theme: 'Trik Psikologi Bicara Depan Umum',
      start: 15,
      end: 50
    };
    state.videoTitle.value = 'Public Speaking Masterclass';

    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    expect(wrapper.text()).toContain('Trik Psikologi Bicara Depan Umum');
    expect(wrapper.text()).toContain(
      'Original audio - Public Speaking Masterclass'
    );
    expect(wrapper.find('.channel-handle').text()).toBe('@yonru.clip');
    expect(wrapper.find('.subscribe-button').text()).toBe('Subscribe');
  });

  it('prefers custom prop overrides over state defaults', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay, {
      props: {
        username: '@creatorspace',
        caption: '5 Tips Menguasai Algoritma YouTube Shorts 🚀',
        soundTitle: 'Audio Asli - Creator Space',
        subscribeText: 'Langganan',
        likes: '250 rb',
        dislikesText: 'Tidak suka',
        comments: '3.890',
        shareText: 'Bagikan',
        remixText: 'Remix',
        progress: 60
      }
    });

    expect(wrapper.find('.channel-handle').text()).toBe('@creatorspace');
    expect(wrapper.text()).toContain(
      '5 Tips Menguasai Algoritma YouTube Shorts 🚀'
    );
    expect(wrapper.text()).toContain('Audio Asli - Creator Space');
    expect(wrapper.find('.subscribe-button').text()).toBe('Langganan');
    expect(wrapper.text()).toContain('250 rb');
    expect(wrapper.text()).toContain('Tidak suka');
    expect(wrapper.text()).toContain('3.890');
    expect(wrapper.text()).toContain('Bagikan');

    const progressBarFill = wrapper.find('.shorts-progress-bar div');
    expect(progressBarFill.attributes('style')).toContain('width: 60%');
  });

  it('renders iconic right action rail stack with 6 interaction items', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    // Verify 5 Action buttons (Thumbs Up, Dislike, Comment, Share, Remix)
    const actionItems = wrapper.findAll('.overlay-sidebar .action-item');
    expect(actionItems.length).toBe(5);

    expect(wrapper.text()).toContain('120 rb');
    expect(wrapper.text()).toContain('Dislike');
    expect(wrapper.text()).toContain('1.428');
    expect(wrapper.text()).toContain('Share');
    expect(wrapper.text()).toContain('Remix');

    // Verify Audio Cover Box exists
    const audioCoverBox = wrapper.find('.audio-cover-box');
    expect(audioCoverBox.exists()).toBe(true);
    expect(audioCoverBox.find('img').exists()).toBe(true);
  });

  it('renders signature red progress scrubber bar at bottom canvas edge', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay, {
      props: {
        progress: 50
      }
    });

    const progressBar = wrapper.find('.shorts-progress-bar');
    expect(progressBar.exists()).toBe(true);

    const progressBarFill = progressBar.find('div');
    expect(progressBarFill.classes()).toContain('bg-[#CC0000]');
    expect(progressBarFill.attributes('style')).toContain('width: 50%');
  });

  it('renders channel avatar with Yonru brand mark fallback', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    const avatarImg = wrapper.find('img[alt="channel avatar"]');
    expect(avatarImg.exists()).toBe(true);
    expect(avatarImg.attributes('src')).toBe('/favicon.svg');
  });
});

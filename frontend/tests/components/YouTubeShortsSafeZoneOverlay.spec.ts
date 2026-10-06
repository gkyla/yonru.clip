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

  it('renders authentic 1:1 vector status bar, Shorts brand title, and category chips carousel', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    // Status bar metrics & elements
    const statusBar = wrapper.find('.status-bar-container');
    expect(statusBar.exists()).toBe(true);
    expect(statusBar.classes()).toContain('h-[85px]');
    expect(statusBar.classes()).toContain('px-11');
    expect(wrapper.text()).toContain('9:41');
    expect(wrapper.find('.status-icons').exists()).toBe(true);

    // Top Navigation header & controls ("Shorts" title, speaker, search, 3-dots)
    const headerNav = wrapper.find('.shorts-nav-bar-container');
    expect(headerNav.exists()).toBe(true);
    expect(wrapper.text()).toContain('Shorts');
    expect(wrapper.find('.shorts-speaker-button').exists()).toBe(true);
    expect(wrapper.find('.shorts-search-button').exists()).toBe(true);
    expect(wrapper.find('.shorts-more-button').exists()).toBe(true);

    // Category Carousel Chips (Option A)
    const chipsCarousel = wrapper.find('.shorts-chips-carousel');
    expect(chipsCarousel.exists()).toBe(true);
    expect(chipsCarousel.find('.chip-item').classes()).toContain('h-[76px]');
    expect(wrapper.text()).toContain('Subscription');
    expect(wrapper.text()).toContain('Live');
    expect(wrapper.text()).toContain('Lens');
  });

  it('dynamically renders active hook theme and video title in channel metadata with modern white subscribe pill', () => {
    const state = useClipperState();
    state.activeHook.value = {
      theme: 'Trik Psikologi Bicara Depan Umum',
      start: 15,
      end: 50
    };
    state.videoTitle.value = 'Public Speaking Masterclass';

    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    expect(wrapper.text()).toContain('Trik Psikologi Bicara Depan Umum');
    expect(wrapper.text()).toContain('Surface • Public Speaking Masterclass');
    expect(wrapper.find('.channel-handle').text()).toBe('@yonru.clip');

    // Modern White Subscribe Pill Button
    const subscribeBtn = wrapper.find('.subscribe-button');
    expect(subscribeBtn.exists()).toBe(true);
    expect(subscribeBtn.classes()).toContain('bg-white');
    expect(subscribeBtn.classes()).toContain('text-black');
    expect(subscribeBtn.classes()).toContain('h-[72px]');
    expect(subscribeBtn.text()).toBe('Subscribe');
  });

  it('prefers custom prop overrides over state defaults', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay, {
      props: {
        username: '@creatorspace',
        caption: '5 Tips Menguasai Algoritma YouTube Shorts 🚀',
        soundTitle: 'Audio Asli - Creator Space',
        subscribeText: 'Langganan',
        likes: '95 rb',
        comments: '4.120',
        saveText: 'Saved',
        shareText: 'Bagi',
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
    expect(wrapper.text()).toContain('95 rb');
    expect(wrapper.text()).toContain('4.120');
    expect(wrapper.text()).toContain('Saved');
    expect(wrapper.text()).toContain('Bagi');

    const progressBarFill = wrapper.find('.shorts-progress-bar div');
    expect(progressBarFill.attributes('style')).toContain('width: 60%');
  });

  it('renders modern 1:1 right action rail stack with 6 interaction items matching mobile screenshot', () => {
    const wrapper = mount(YouTubeShortsSafeZoneOverlay);

    // Verify 5 Action buttons (Heart, Comment, Simpan, Bagikan, Remix)
    const heartAction = wrapper.find('.heart-action');
    expect(heartAction.exists()).toBe(true);
    expect(wrapper.text()).toContain('84 rb');

    const commentAction = wrapper.find('.comment-action');
    expect(commentAction.exists()).toBe(true);
    expect(wrapper.text()).toContain('3.621');

    const saveAction = wrapper.find('.save-action');
    expect(saveAction.exists()).toBe(true);
    expect(wrapper.text()).toContain('Simpan');

    const shareAction = wrapper.find('.share-action');
    expect(shareAction.exists()).toBe(true);
    expect(wrapper.text()).toContain('Bagikan');

    const remixAction = wrapper.find('.remix-action');
    expect(remixAction.exists()).toBe(true);
    expect(wrapper.text()).toContain('Remix');

    // Verify Audio Cover Box exists and is calibrated with rounded squircle
    const audioCoverBox = wrapper.find('.audio-cover-box');
    expect(audioCoverBox.exists()).toBe(true);
    expect(audioCoverBox.classes()).toContain('rounded-[22px]');
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

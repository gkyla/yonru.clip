// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TikTokSafeZoneOverlay from '../../app/components/preview/TikTokSafeZoneOverlay.vue';
import { useClipperState } from '../../app/composables/useClipperState';

describe('TikTokSafeZoneOverlay Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.activeHook.value = null;
    state.videoTitle.value = '';
  });

  it('mounts successfully with root pointer-events-none and default opacity', () => {
    const wrapper = mount(TikTokSafeZoneOverlay, {
      props: {
        opacity: 80
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.classes()).toContain('pointer-events-none');
    expect(wrapper.attributes('style')).toContain('opacity: 0.8');
  });

  it('renders authentic 1:1 vector status bar and top navigation header', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    // Status bar metrics & elements (85px height)
    const statusBar = wrapper.find('.status-bar-container');
    expect(statusBar.exists()).toBe(true);
    expect(statusBar.classes()).toContain('h-[85px]');
    expect(statusBar.classes()).toContain('px-11');
    expect(wrapper.text()).toContain('9:41');
    expect(wrapper.find('.status-icons').exists()).toBe(true);

    // Top Navigation header & elements (115px height)
    const headerNav = wrapper.find('.home-nav-bar-container');
    expect(headerNav.exists()).toBe(true);
    expect(headerNav.classes()).toContain('h-[115px]');
    expect(wrapper.find('.live-button').exists()).toBe(true);
    expect(wrapper.text()).toContain('LIVE');
    expect(wrapper.text()).toContain('Following');
    expect(wrapper.text()).toContain('For You');
    expect(wrapper.find('.active-indicator').exists()).toBe(true);
    expect(wrapper.find('.search-button').exists()).toBe(true);
  });

  it('dynamically renders active hook theme and video title without @ symbol in display name', () => {
    const state = useClipperState();
    state.activeHook.value = {
      theme: 'Rahasia Otak Tetap Sehat',
      start: 10,
      end: 45
    };
    state.videoTitle.value = 'Podcast Dokter Spesialis';

    const wrapper = mount(TikTokSafeZoneOverlay);

    expect(wrapper.text()).toContain('Rahasia Otak Tetap Sehat');
    expect(wrapper.text()).toContain(
      'Original sound - Podcast Dokter Spesialis'
    );
    // Display name must NOT have @ prefix per Vivo V29 screenshot & TikTok mobile layout
    expect(wrapper.find('.username').text()).toBe('yonru.clip');
  });

  it('prefers custom prop overrides over state defaults', () => {
    const wrapper = mount(TikTokSafeZoneOverlay, {
      props: {
        username: 'JKT Diem Please',
        caption: 'AKHIRNYA, TROFINYA DIANGKAT JUGA! 🇮🇩 🏆',
        soundTitle: 'suara asli - JKT Diem Please',
        followingText: 'Mengikuti',
        forYouText: 'Saran',
        progress: 75
      }
    });

    expect(wrapper.find('.username').text()).toBe('JKT Diem Please');
    expect(wrapper.text()).toContain('AKHIRNYA, TROFINYA DIANGKAT JUGA! 🇮🇩 🏆');
    expect(wrapper.text()).toContain('suara asli - JKT Diem Please');
    expect(wrapper.text()).toContain('Mengikuti');
    expect(wrapper.text()).toContain('Saran');

    const progressBarFill = wrapper.find('.tiktok-progress-bar div');
    expect(progressBarFill.attributes('style')).toContain('width: 75%');
  });

  it('renders right interaction column with calibrated 118px avatar and 104px spinning vinyl disc', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    const avatarContainer = wrapper.find('.avatar-container');
    expect(avatarContainer.exists()).toBe(true);
    expect(avatarContainer.classes()).toContain('w-[118px]');
    expect(avatarContainer.classes()).toContain('h-[118px]');

    const followBtn = wrapper.find('img[alt="follow button"]');
    expect(followBtn.exists()).toBe(true);
    expect(followBtn.classes()).toContain('w-[46px]');

    const vinyl = wrapper.find('.spinning-vinyl');
    expect(vinyl.exists()).toBe(true);
    expect(vinyl.classes()).toContain('w-[104px]');
    expect(vinyl.classes()).toContain('h-[104px]');
  });

  it('renders authentic vector icons for 4-item action stack calibrated 1:1 to Vivo V29', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    // Verify Action Stack Metrics
    expect(wrapper.text()).toContain('37,9 rb');
    expect(wrapper.text()).toContain('330');
    expect(wrapper.text()).toContain('1.216');
    expect(wrapper.text()).toContain('3.041');

    // Verify 4 SVG Action Icons exist (Heart, Comment with 3 dots, Bookmark, Share)
    const actionSvgs = wrapper.findAll('.action-item svg');
    expect(actionSvgs.length).toBe(4);

    // Verify Music Note SVG exists
    const musicIcon = wrapper.find('.music-icon svg');
    expect(musicIcon.exists()).toBe(true);
  });

  it('enforces symmetrical side margins and does not render app bottom navigation bar', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    const metadataContainer = wrapper.find('.sidebar-metadata-container');
    expect(metadataContainer.exists()).toBe(true);
    expect(metadataContainer.classes()).toContain('px-11');
    expect(metadataContainer.classes()).toContain('pb-14');

    const bottomBar = wrapper.find('.bottom-nav-bar-container');
    expect(bottomBar.exists()).toBe(false);

    const progressBar = wrapper.find('.tiktok-progress-bar');
    expect(progressBar.exists()).toBe(true);
  });
});

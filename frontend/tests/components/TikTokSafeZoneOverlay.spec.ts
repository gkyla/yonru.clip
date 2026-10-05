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

    // Status bar metrics & elements
    expect(wrapper.find('.status-bar-container').exists()).toBe(true);
    expect(wrapper.text()).toContain('9:41');
    expect(wrapper.find('.dynamic-island').exists()).toBe(false);
    expect(wrapper.find('.status-icons').exists()).toBe(true);

    // Top Navigation header & elements
    expect(wrapper.find('.home-nav-bar-container').exists()).toBe(true);
    expect(wrapper.find('.live-button').exists()).toBe(true);
    expect(wrapper.text()).toContain('LIVE');
    expect(wrapper.text()).toContain('Following');
    expect(wrapper.text()).toContain('For You');
    expect(wrapper.find('.active-indicator').exists()).toBe(true);
    expect(wrapper.find('.search-button').exists()).toBe(true);
  });

  it('dynamically renders active hook theme and video title', () => {
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
    expect(wrapper.text()).toContain('@yonru.clip');
  });

  it('prefers custom prop overrides over state defaults', () => {
    const wrapper = mount(TikTokSafeZoneOverlay, {
      props: {
        username: 'centraln1sm.clip',
        caption: 'Demam tinggi bisa merusak sel otak? #mitos',
        soundTitle: 'Original sound - centraln1sm.clip'
      }
    });

    expect(wrapper.text()).toContain('@centraln1sm.clip');
    expect(wrapper.text()).toContain(
      'Demam tinggi bisa merusak sel otak? #mitos'
    );
    expect(wrapper.text()).toContain('Original sound - centraln1sm.clip');
  });

  it('renders right interaction column with avatar, follow button, and spinning vinyl disc', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    const avatar = wrapper.find('img[alt="creator avatar"]');
    expect(avatar.exists()).toBe(true);

    const followBtn = wrapper.find('img[alt="follow button"]');
    expect(followBtn.exists()).toBe(true);

    const vinyl = wrapper.find('.spinning-vinyl');
    expect(vinyl.exists()).toBe(true);
  });

  it('renders authentic vector icons for 4-item action stack calibrated 1:1 to interaction.png', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    // Verify Action Stack Metrics
    expect(wrapper.text()).toContain('1.3M');
    expect(wrapper.text()).toContain('10.7M');
    expect(wrapper.text()).toContain('125.4K');
    expect(wrapper.text()).toContain('30.9K');

    // Verify 4 SVG Action Icons exist (Heart, Comment, Bookmark, Share)
    const actionSvgs = wrapper.findAll('.action-item svg');
    expect(actionSvgs.length).toBe(4);

    // Verify Music Note SVG exists
    const musicIcon = wrapper.find('.music-icon svg');
    expect(musicIcon.exists()).toBe(true);
  });

  it('does not render bottom navigation bar to keep video preview clean and unobscured', () => {
    const wrapper = mount(TikTokSafeZoneOverlay);

    const bottomBar = wrapper.find('.bottom-nav-bar-container');
    expect(bottomBar.exists()).toBe(false);
  });
});

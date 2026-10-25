import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SidebarNavList from '~/components/sidebar/SidebarNavList.vue';
import SidebarWorkspaceCard from '~/components/sidebar/SidebarWorkspaceCard.vue';
import SidebarUtilityFooter from '~/components/sidebar/SidebarUtilityFooter.vue';

const globalStubs = {
  stubs: {
    Icon: true,
    NuxtIcon: true
  }
};

describe('Sidebar Sub-Modules Isolated Unit Tests', () => {
  describe('SidebarNavList Component', () => {
    it('renders all four main navigation buttons in expanded mode', () => {
      const wrapper = mount(SidebarNavList, {
        props: {
          isCollapsed: false,
          activeView: 'home',
          isAnyPrerequisiteMissing: false
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Main Navigation');
      expect(wrapper.text()).toContain('Home');
      expect(wrapper.text()).toContain('Prompts');
      expect(wrapper.text()).toContain('Documentation');
      expect(wrapper.text()).toContain('Settings');
    });

    it('emits navigate event with correct item ID when clicked', async () => {
      const wrapper = mount(SidebarNavList, {
        props: {
          isCollapsed: false,
          activeView: 'home',
          isAnyPrerequisiteMissing: false
        },
        global: globalStubs
      });

      const buttons = wrapper.findAll('button');
      const promptsButton = buttons.find(b => b.text().includes('Prompts'));
      expect(promptsButton).toBeDefined();

      await promptsButton!.trigger('click');
      expect(wrapper.emitted('navigate')).toBeTruthy();
      expect(wrapper.emitted('navigate')![0]).toEqual(['prompts']);
    });

    it('positions sliding active pill indicator accurately for settings view', () => {
      const wrapper = mount(SidebarNavList, {
        props: {
          isCollapsed: false,
          activeView: 'settings',
          isAnyPrerequisiteMissing: false
        },
        global: globalStubs
      });

      const pill = wrapper.find(
        '.bg-accent-500.shadow-\\[0_0_8px_rgba\\(255\\,215\\,0\\,0\\.6\\)\\]'
      );
      expect(pill.exists()).toBe(true);
      // Index 3: 3 * 48 + 10 = 154px
      expect(pill.attributes('style')).toContain('top: 154px');
    });

    it('shows prerequisite warning dot on settings button when prerequisite is missing', () => {
      const wrapper = mount(SidebarNavList, {
        props: {
          isCollapsed: false,
          activeView: 'home',
          isAnyPrerequisiteMissing: true
        },
        global: globalStubs
      });

      const pulseDot = wrapper.find('.bg-amber-500.animate-pulse-amber');
      expect(pulseDot.exists()).toBe(true);
    });

    it('renders flyout tooltips in collapsed mode', () => {
      const wrapper = mount(SidebarNavList, {
        props: {
          isCollapsed: true,
          activeView: 'home',
          isAnyPrerequisiteMissing: false
        },
        global: globalStubs
      });

      const tooltips = wrapper.findAll('.absolute.left-full');
      expect(tooltips.length).toBe(4);
      expect(tooltips[0].text()).toBe('Home');
      expect(tooltips[1].text()).toBe('Prompts');
      expect(tooltips[2].text()).toBe('Documentation');
      expect(tooltips[3].text()).toBe('Settings');
    });
  });

  describe('SidebarWorkspaceCard Component', () => {
    it('renders Active Job processing state when isProcessing is true', () => {
      const wrapper = mount(SidebarWorkspaceCard, {
        props: {
          isCollapsed: false,
          isProcessing: true,
          processingTitle: 'Processing Sample Video',
          processingStatus: 'Transcribing speech',
          isCurrentClipActive: false
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Active Job');
      expect(wrapper.text()).toContain('Processing Sample Video');
      expect(wrapper.text()).toContain('Transcribing speech');
    });

    it('renders Last Accessed Clip state with theme and video title, and emits continue-editing on click', async () => {
      const clip = { clip_id: '0_45', theme: 'Breakthrough Discovery' };
      const video = { title: 'Cosmic Documentary' };

      const wrapper = mount(SidebarWorkspaceCard, {
        props: {
          isCollapsed: false,
          isProcessing: false,
          lastClip: clip,
          lastVideo: video,
          lastClipThumbnail: 'http://localhost:8000/assets/clips/thumb.jpg',
          isCurrentClipActive: false
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('CONTINUE EDITING');
      expect(wrapper.text()).toContain('Breakthrough Discovery');
      expect(wrapper.text()).toContain('Cosmic Documentary');

      const img = wrapper.find('img[alt="Clip Thumbnail"]');
      expect(img.exists()).toBe(true);
      expect(img.attributes('src')).toBe(
        'http://localhost:8000/assets/clips/thumb.jpg'
      );

      const btn = wrapper.find('button');
      await btn.trigger('click');
      expect(wrapper.emitted('continue-editing')).toBeTruthy();

      await img.trigger('error');
      expect(wrapper.emitted('thumbnail-error')).toBeTruthy();
    });

    it('disables continue editing button and displays ON EDITING when clip is currently active in editor', () => {
      const clip = { clip_id: '0_45', theme: 'Breakthrough Discovery' };
      const video = { title: 'Cosmic Documentary' };

      const wrapper = mount(SidebarWorkspaceCard, {
        props: {
          isCollapsed: false,
          isProcessing: false,
          lastClip: clip,
          lastVideo: video,
          lastClipThumbnail: null,
          isCurrentClipActive: true
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('ON EDITING');
      const btn = wrapper.find('button[disabled]');
      expect(btn.exists()).toBe(true);
    });

    it('renders canonical empty state when no last clip is present', () => {
      const wrapper = mount(SidebarWorkspaceCard, {
        props: {
          isCollapsed: false,
          isProcessing: false,
          lastClip: null,
          lastVideo: null,
          isCurrentClipActive: false
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Last Accessed Clip');
      expect(wrapper.text()).toContain('No recent clip');
      expect(wrapper.text()).toContain('Open a clip to begin');
    });

    it('renders collapsed hover drawer with last clip info when isCollapsed is true', () => {
      const clip = { clip_id: '10_30', theme: 'Hover Clip Theme' };
      const video = { title: 'Hover Parent Video' };

      const wrapper = mount(SidebarWorkspaceCard, {
        props: {
          isCollapsed: true,
          isProcessing: false,
          lastClip: clip,
          lastVideo: video,
          lastClipThumbnail: null,
          isCurrentClipActive: false
        },
        global: globalStubs
      });

      const drawer = wrapper.find('.absolute.left-full');
      expect(drawer.exists()).toBe(true);
      expect(drawer.text()).toContain('LAST ACCESSED CLIP');
      expect(drawer.text()).toContain('Hover Clip Theme');
      expect(drawer.text()).toContain('Hover Parent Video');
    });
  });

  describe('SidebarUtilityFooter Component', () => {
    it('renders Saweria, Trakteer, and health status indicators in expanded mode', () => {
      const wrapper = mount(SidebarUtilityFooter, {
        props: {
          isCollapsed: false,
          statusColor: 'bg-emerald-500/80',
          statusLabel: 'IDLE'
        },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Support on');
      expect(wrapper.text()).toContain('@gitkyla');
      expect(wrapper.text()).toContain('Saweria');
      expect(wrapper.text()).toContain('Trakteer');
      expect(wrapper.text()).toContain('IDLE');
      expect(wrapper.text()).toContain('v0.1.0');

      const saweriaLink = wrapper.find('a[title*="Saweria"]');
      expect(saweriaLink.attributes('href')).toBe('https://saweria.co/gitkyla');

      const trakteerLink = wrapper.find('a[title*="Trakteer"]');
      expect(trakteerLink.attributes('href')).toBe(
        'https://trakteer.id/gitkyla'
      );
    });

    it('renders vertical icon stack with tooltips in collapsed mode', () => {
      const wrapper = mount(SidebarUtilityFooter, {
        props: {
          isCollapsed: true,
          statusColor: 'bg-accent-500 shadow-[0_0_8px_#ffd700]',
          statusLabel: 'READY'
        },
        global: globalStubs
      });

      expect(wrapper.find('a[title*="Saweria"]').exists()).toBe(true);
      expect(wrapper.find('a[title*="Trakteer"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Saweria (@gitkyla)');
      expect(wrapper.text()).toContain('Trakteer (@gitkyla)');
      expect(wrapper.text()).toContain('READY');
    });
  });
});

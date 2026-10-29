import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PresetStudioModal from '../../app/components/editor/PresetStudioModal.vue';
import { SUBTITLE_PRESETS } from '../../app/constants/subtitlePresets';

const globalMountOptions = {
  stubs: {
    Icon: true,
    NuxtIcon: true,
    Teleport: true
  }
};

describe('PresetStudioModal Component', () => {
  it('renders modal with all 16 presets by default when show is true', () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Preset Studio');
    expect(wrapper.text()).toContain('16 Styles');
    expect(wrapper.text()).toContain('Hormozi Bold');
    expect(wrapper.text()).toContain('MrBeast Impact');
    expect(wrapper.text()).toContain('Cyber Neon');
    expect(wrapper.text()).toContain('Active');
  });

  it('filters presets when a category tab is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    // Find Podcast category button
    const buttons = wrapper.findAll('button');
    const podcastBtn = buttons.find(b => b.text().includes('Podcast & Talk'));
    expect(podcastBtn).toBeDefined();

    await podcastBtn!.trigger('click');

    // Only podcast category presets should be displayed
    const podcastPresets = SUBTITLE_PRESETS.filter(
      p => p.category === 'podcast'
    );
    for (const p of podcastPresets) {
      expect(wrapper.text()).toContain(p.name);
    }

    // Creative preset should not be in the filtered list
    expect(wrapper.text()).not.toContain('Comic Story');
  });

  it('filters presets via search query', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    const searchInput = wrapper.find('input[type="text"]');
    await searchInput.setValue('Beast');

    expect(wrapper.text()).toContain('MrBeast Impact');
    expect(wrapper.text()).not.toContain('Hormozi Bold');
  });

  it('emits select and close when a preset card is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    const cards = wrapper.findAll('.grid button');
    expect(cards.length).toBe(16);

    // Click on 2nd card (Minimal Glass)
    await cards[1]!.trigger('click');

    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({
      id: 'clean-vlog'
    });
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close when the close button is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    const closeBtn = wrapper.find('button[aria-label="Close preset studio"]');
    await closeBtn.trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('renders PresetStudioViewport on every preset card with staggered wave delay', () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    const viewports = wrapper.findAll('.preset-studio-viewport');
    expect(viewports.length).toBe(16);

    // Verify staggered wave delay formula: (index * 0.1s % 1.2s)
    expect(viewports[0]?.attributes('data-stagger-delay')).toBe('0s');
    expect(viewports[1]?.attributes('data-stagger-delay')).toBe('0.1s');
    expect(viewports[2]?.attributes('data-stagger-delay')).toBe('0.2s');
    expect(viewports[5]?.attributes('data-stagger-delay')).toBe('0.5s');
    expect(viewports[11]?.attributes('data-stagger-delay')).toBe('1.1s');
    expect(viewports[12]?.attributes('data-stagger-delay')).toBe('0s');
    expect(viewports[13]?.attributes('data-stagger-delay')).toBe('0.1s');

    // Verify each viewport renders the standardized 3-word phrase
    expect(viewports[0]?.text()).toContain('THAT');
    expect(viewports[0]?.text()).toContain('WAS');
    expect(viewports[0]?.text()).toContain('CRAZY');
  });

  it('updates rendered viewports and re-indexes staggered delays when filtered by category or search', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast'
      },
      global: globalMountOptions
    });

    const searchInput = wrapper.find('input[type="text"]');
    await searchInput.setValue('Neon');

    const viewports = wrapper.findAll('.preset-studio-viewport');
    expect(viewports.length).toBeGreaterThan(0);
    // 1st filtered item gets index 0 wave delay
    expect(viewports[0]?.attributes('data-stagger-delay')).toBe('0s');
    expect(viewports[0]?.attributes('data-preset-id')).toBe('cyber-neon');
  });
});

// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import EditorActionRail from '../../app/components/editor/EditorActionRail.vue';
import { useClipperState } from '../../app/composables/useClipperState';
import { useSnappingGuides } from '../../app/composables/useSnappingGuides';

describe('EditorActionRail Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.activeHook.value = {
      id: 'test-hook-1',
      start: 10,
      end: 40,
      title: 'Test Hook',
      virality_score: 85,
      curation_reason: 'Viral hook test'
    } as any;
  });

  it('renders snapping magnet button and toggles snapping state when clicked', async () => {
    const snapping = useSnappingGuides();
    snapping.isSnappingEnabled.value = true;

    const wrapper = mount(EditorActionRail, {
      props: {
        isPanelOpen: false,
        editorTab: 'edit'
      },
      global: {
        stubs: {
          Icon: true,
          Teleport: true
        }
      }
    });

    const snapBtn = wrapper.find('[data-testid="snapping-toggle-btn"]');
    expect(snapBtn.exists()).toBe(true);

    // Initial state: true -> cyan active styling
    expect(snapping.isSnappingEnabled.value).toBe(true);
    expect(snapBtn.classes()).toContain('text-cyan-400');

    // Click to toggle
    await snapBtn.trigger('click');
    expect(snapping.isSnappingEnabled.value).toBe(false);
    expect(snapBtn.classes()).toContain('text-slate-500');

    // Click to toggle back
    await snapBtn.trigger('click');
    expect(snapping.isSnappingEnabled.value).toBe(true);
    expect(snapBtn.classes()).toContain('text-cyan-400');
  });

  it('displays tooltip with guide bypass explanation when hovered', async () => {
    const snapping = useSnappingGuides();
    snapping.isSnappingEnabled.value = true;

    const wrapper = mount(EditorActionRail, {
      props: {
        isPanelOpen: false,
        editorTab: 'edit'
      },
      global: {
        stubs: {
          Icon: true,
          Teleport: {
            template: '<div class="teleport-stub"><slot /></div>'
          }
        }
      }
    });

    const snapBtn = wrapper.find('[data-testid="snapping-toggle-btn"]');
    await snapBtn.trigger('mouseenter');

    expect(wrapper.text()).toContain(
      'Snapping Guides (ON - Hold Alt to bypass)'
    );

    // Toggle off while hovered
    snapping.isSnappingEnabled.value = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Snapping Guides (OFF)');
  });
});

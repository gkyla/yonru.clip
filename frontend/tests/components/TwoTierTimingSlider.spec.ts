// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TwoTierTimingSlider from '../../app/components/home/TwoTierTimingSlider.vue';

describe('TwoTierTimingSlider Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders macro source video overview and micro context tracks with correct time markers', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      props: {
        start: 10,
        end: 40,
        videoDuration: 300,
        currentTime: 20
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    expect(wrapper.text()).toContain('Full Video Overview');
    expect(wrapper.text()).toContain('00:00 / 05:00');
    expect(wrapper.text()).toContain('Adjust Hook Boundaries');
    expect(wrapper.text()).toContain('Zoomed Window');
    expect(wrapper.text()).toContain('Clip Duration: 00:30');
    expect(wrapper.find('#modal-hook-slider').exists()).toBe(true);
  });

  it('renders real-time playhead seek indication on both macro and micro tracks', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      props: {
        start: 10,
        end: 40,
        videoDuration: 300,
        currentTime: 25
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const macroPlayhead = wrapper.find('[data-test="macro-playhead"]');
    const microPlayhead = wrapper.find('[data-test="micro-playhead"]');

    expect(macroPlayhead.exists()).toBe(true);
    expect(microPlayhead.exists()).toBe(true);

    // 25s / 300s = 8.333% on macro track
    expect(macroPlayhead.attributes('style')).toContain('left: 8.33333');

    // On micro track with 30s padding (window: 0 to 70s -> duration 70s):
    // 25s / 70s = 35.714%
    expect(microPlayhead.attributes('style')).toContain('left: 35.7142');
  });

  it('prevents handle collision and enforces 1.0s minimum hook duration when dragging start handle', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      attachTo: document.body,
      props: {
        start: 10,
        end: 40,
        videoDuration: 100
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    // Set fixed micro window: 0 to 100s
    vm.microWindowStart = 0;
    vm.microWindowEnd = 100;

    const sliderEl = vm.modalHookSliderRef;
    expect(sliderEl).toBeTruthy();
    vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      bottom: 20,
      right: 100,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    vm.startDrag('start');

    // Attempt to drag start past end (end is 40, attempting to drag to 45s)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 45 }));

    // Should clamp to maxStart = end - 1.0 (39s) or emit clamped start <= 39
    const emittedStarts = wrapper.emitted('update:start') as
      number[][] | undefined;
    if (emittedStarts && emittedStarts.length > 0) {
      const lastEmitted = emittedStarts[emittedStarts.length - 1]?.[0];
      expect(lastEmitted).toBeLessThanOrEqual(39);
    }

    vm.stopDragging();
    wrapper.unmount();
  });

  it('prevents handle collision and enforces 1.0s minimum hook duration when dragging end handle', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      attachTo: document.body,
      props: {
        start: 10,
        end: 40,
        videoDuration: 100
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.microWindowStart = 0;
    vm.microWindowEnd = 100;

    const sliderEl = vm.modalHookSliderRef;
    vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      bottom: 20,
      right: 100,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    vm.startDrag('end');

    // Attempt to drag end before start (start is 10, attempting to drag to 5s)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5 }));

    // Should not emit value less than minEnd = start + 1.0 (11s)
    const emittedEnds = wrapper.emitted('update:end') as number[][] | undefined;
    if (emittedEnds && emittedEnds.length > 0) {
      const lastEmitted = emittedEnds[emittedEnds.length - 1]?.[0];
      expect(lastEmitted).toBeGreaterThanOrEqual(11);
    }

    vm.stopDragging();
    wrapper.unmount();
  });

  it('activates edge auto-scroll and emits seek when scrubbing near boundary', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      attachTo: document.body,
      props: {
        start: 10,
        end: 40,
        videoDuration: 100
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.microWindowStart = 0;
    vm.microWindowEnd = 70;

    const sliderEl = vm.modalHookSliderRef;
    vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      bottom: 20,
      right: 100,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    vm.startDrag('end');

    // Drag to right edge (clientX = 99)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99 }));
    expect(vm.edgeScrollDirection).toBe(1);

    // Simulate stepEdgeAutoScroll frame advancing by 100ms
    vm.stepEdgeAutoScroll(1000);
    vm.stepEdgeAutoScroll(1100);

    const emittedEnds = wrapper.emitted('update:end') as number[][] | undefined;
    expect(emittedEnds).toBeTruthy();
    expect(emittedEnds!.length).toBeGreaterThan(0);
    const lastEmittedEnd = emittedEnds![emittedEnds!.length - 1]?.[0];
    expect(lastEmittedEnd).toBeGreaterThan(40);

    // Move back to middle (clientX = 50)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
    expect(vm.edgeScrollDirection).toBe(0);

    vm.stopDragging();
    wrapper.unmount();
  });

  it('emits drag-end with initial and final timestamps for delta preview coordination', async () => {
    const wrapper = mount(TwoTierTimingSlider, {
      attachTo: document.body,
      props: {
        start: 10,
        end: 40,
        videoDuration: 100
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.startDrag('end', 10, 40);

    // Simulate drag end
    vm.stopDragging();

    const dragEndEmitted = wrapper.emitted('drag-end') as any[][] | undefined;
    expect(dragEndEmitted).toBeTruthy();
    expect(dragEndEmitted?.[0]?.[0]).toEqual({
      mode: 'end',
      initialStart: 10,
      initialEnd: 40,
      start: 10,
      end: 40
    });

    wrapper.unmount();
  });

  it('cleanly detaches event listeners on unmount even while dragging', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const wrapper = mount(TwoTierTimingSlider, {
      props: {
        start: 10,
        end: 40,
        videoDuration: 100
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.startDrag('start');

    wrapper.unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'touchmove',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'touchend',
      expect.any(Function)
    );
  });
});

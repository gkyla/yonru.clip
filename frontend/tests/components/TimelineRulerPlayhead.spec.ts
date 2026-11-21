// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import TimelineRuler, {
  type RulerScrubStartPayload
} from '../../app/components/editor/TimelineRuler.vue';
import TimelinePlayhead from '../../app/components/editor/TimelinePlayhead.vue';
import TimelineTimecode from '../../app/components/editor/TimelineTimecode.vue';

const mockCurrentTime = ref(0);
const mockTimelineDuration = ref(180);

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    currentTime: mockCurrentTime,
    timelineDuration: mockTimelineDuration,
    formatDuration: (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  })
}));

describe('TimelineRuler, TimelinePlayhead, and TimelineTimecode Leaf Components', () => {
  beforeEach(() => {
    mockCurrentTime.value = 0;
    mockTimelineDuration.value = 180;
  });

  describe('TimelineRuler windowing and rect caching', () => {
    it('renders bounded tick DOM nodes at high zoom (pxPerSec >= 200 on a 180s clip)', async () => {
      // Unwindowed 180s at 200px/sec (0.1s step) would render 1,801 tick nodes
      const wrapper = mount(TimelineRuler, {
        props: {
          totalW: 36000,
          pxPerSec: 200,
          containerW: 800,
          scrollLeft: 0
        }
      });

      const initialTicks = wrapper.findAll('[data-testid="ruler-tick"]');
      // Window is [0, 1600px] = [0s, 8s] => 81 ticks
      expect(initialTicks.length).toBeLessThanOrEqual(125);
      expect(initialTicks.length).toBe(81);

      // Small scroll inside 0.5 * containerW (300 < 400) does NOT shift window
      await wrapper.setProps({ scrollLeft: 300 });
      const stillInitialTicks = wrapper.findAll('[data-testid="ruler-tick"]');
      expect(stillInitialTicks).toHaveLength(81);
      expect(stillInitialTicks[0]?.attributes('style')).toContain('left: 0px');

      // Scroll past inner 0.5 * containerW buffer recenters window cleanly and stays bounded
      await wrapper.setProps({ scrollLeft: 2000 });
      const shiftedTicks = wrapper.findAll('[data-testid="ruler-tick"]');
      // Window [1200px, 3600px] = [6s, 18s] => 121 ticks
      expect(shiftedTicks.length).toBeLessThanOrEqual(125);
      expect(shiftedTicks[0]?.attributes('style')).toContain('left: 1200px');
    });

    it('caches .ruler-container rect on mousedown and avoids layout queries during scrub moves', async () => {
      let currentScroll = 100;
      const wrapper = mount(TimelineRuler, {
        props: {
          totalW: 10000,
          pxPerSec: 100,
          containerW: 800,
          getScrollLeft: () => currentScroll
        }
      });

      const rulerContainer = wrapper.find('.ruler-container');
      const rectSpy = vi
        .spyOn(rulerContainer.element, 'getBoundingClientRect')
        .mockReturnValue({
          left: 200,
          top: 0,
          width: 10000,
          height: 24,
          right: 10200,
          bottom: 24,
          x: 200,
          y: 0,
          toJSON: () => {}
        });

      await wrapper.find('.timeline-ruler').trigger('mousedown', {
        button: 0,
        clientX: 450
      });

      expect(rectSpy).toHaveBeenCalledTimes(1);
      const emitted = wrapper.emitted('scrub-start');
      expect(emitted).toHaveLength(1);
      const payload = emitted![0]![0] as RulerScrubStartPayload;

      // Initial click at clientX=450, cached rulerLeft=200 => 250px => 2.5s
      expect(payload.computeTimeFromClientX(450, 100)).toBeCloseTo(2.5);

      // Edge-scroll advances scrollLeft to 350 (+250px) while mouse stays at clientX=750
      // Zero additional getBoundingClientRect calls should occur
      currentScroll = 350;
      expect(payload.computeTimeFromClientX(750, 350)).toBeCloseTo(8.0);
      expect(rectSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('TimelinePlayhead GPU-composited positioning', () => {
    it('positions head and line variants using translate3d and preserves testids + scrub-start emit', async () => {
      mockCurrentTime.value = 5.25;

      const headWrapper = mount(TimelinePlayhead, {
        props: { variant: 'head', pxPerSec: 100 }
      });
      const head = headWrapper.find('[data-testid="timeline-playhead-head"]');
      expect(head.exists()).toBe(true);
      const headStyle = head.attributes('style') || '';
      expect(headStyle).toContain('left: 0px');
      expect(headStyle).toContain('transform: translate3d(525px, 0, 0)');

      const handle = head.find('[data-testid="timeline-playhead-handle"]');
      expect(handle.exists()).toBe(true);
      await handle.trigger('mousedown', { button: 0, clientX: 525 });
      expect(headWrapper.emitted('scrub-start')).toHaveLength(1);

      const lineWrapper = mount(TimelinePlayhead, {
        props: { variant: 'line', pxPerSec: 200 }
      });
      const line = lineWrapper.find('[data-testid="timeline-playhead"]');
      expect(line.exists()).toBe(true);
      const lineStyle = line.attributes('style') || '';
      expect(lineStyle).toContain('left: 0px');
      expect(lineStyle).toContain('transform: translate3d(1050px, 0, 0)');
    });
  });

  describe('TimelineTimecode 1 Hz quantization', () => {
    it('formats M:SS timecode and only updates when whole seconds change', async () => {
      mockCurrentTime.value = 5.1;
      mockTimelineDuration.value = 95;

      const wrapper = mount(TimelineTimecode);
      expect(wrapper.find('[data-testid="timeline-timecode"]').text()).toBe(
        '0:05/1:35'
      );

      // Fractional ticks within second 5 keep output unchanged
      mockCurrentTime.value = 5.85;
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('0:05');

      // Crossing to second 6 updates text
      mockCurrentTime.value = 6.02;
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('0:06');
    });
  });
});

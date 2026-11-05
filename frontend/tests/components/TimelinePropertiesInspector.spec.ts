import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelinePropertiesInspector from '../../app/components/editor/TimelinePropertiesInspector.vue';
import { ref, reactive } from 'vue';

const globalMountOptions = {
  stubs: {
    Icon: true,
    NuxtIcon: true,
    Teleport: true
  }
};

describe('TimelinePropertiesInspector Component', () => {
  it('does not render when item is null', () => {
    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: null
      },
      global: globalMountOptions
    });

    expect(wrapper.find('div.fixed').exists()).toBe(false);
  });

  it('renders properties panel when text item is provided', () => {
    const item = {
      id: 'text-1',
      content: 'Hello World',
      start: 1.5,
      duration: 3.0,
      font: 'Inter',
      fontSize: 80,
      color: '#FFFFFF'
    };

    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Properties');
    expect(wrapper.text()).toContain('Timing & Spacing');
    expect(wrapper.text()).toContain('Typography');
    expect(wrapper.text()).toContain('Colors & Borders');
    expect(wrapper.find('textarea').element.value).toBe('Hello World');
  });

  it('transforms text content to uppercase, lowercase, and title case', async () => {
    const item = {
      id: 'text-1',
      content: 'hello world',
      start: 0,
      duration: 2
    };

    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item
      },
      global: globalMountOptions
    });

    const buttons = wrapper.findAll('button');
    const upperBtn = buttons.find(b => b.text() === 'UPPER');
    const lowerBtn = buttons.find(b => b.text() === 'lower');
    const titleBtn = buttons.find(b => b.text() === 'Title');

    expect(upperBtn).toBeDefined();
    expect(lowerBtn).toBeDefined();
    expect(titleBtn).toBeDefined();

    await upperBtn!.trigger('click');
    expect(item.content).toBe('HELLO WORLD');

    await lowerBtn!.trigger('click');
    expect(item.content).toBe('hello world');

    await titleBtn!.trigger('click');
    expect(item.content).toBe('Hello World');
  });

  it('emits close event when close button is clicked', async () => {
    const item = {
      id: 'text-1',
      content: 'Test close',
      start: 0,
      duration: 2
    };

    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item
      },
      global: globalMountOptions
    });

    const closeBtn = wrapper.find(
      'button[aria-label="Close"], button:has(.ri-close-line), button:has(svg)'
    );
    // Find button with close icon
    const headerBtns = wrapper.findAll('div.border-b button');
    const closeIconBtn = headerBtns[headerBtns.length - 1];

    await closeIconBtn?.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('shows blank zone snap buttons only when videoLayout is landscape', async () => {
    const item = {
      id: 'text-1',
      content: 'Snap Test',
      start: 0,
      duration: 2,
      y: 500
    };

    const verticalWrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item,
        videoLayout: 'vertical'
      },
      global: globalMountOptions
    });

    expect(verticalWrapper.text()).not.toContain('Blank Zone Snap');

    const landscapeWrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item,
        videoLayout: 'landscape'
      },
      global: globalMountOptions
    });

    expect(landscapeWrapper.text()).toContain('Blank Zone Snap');
    const snapTopBtn = landscapeWrapper
      .findAll('button')
      .find(b => b.text().includes('Snap Top Zone'));
    expect(snapTopBtn).toBeDefined();
    await snapTopBtn!.trigger('click');
    expect(item.y).toBe(328);
  });

  it('handles toggle stroke and background toggles', async () => {
    const item = reactive({
      id: 'text-1',
      content: 'Stroke Test',
      start: 0,
      duration: 2,
      showStroke: false,
      showBackground: false
    });

    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item
      },
      global: globalMountOptions
    });

    const strokeSpan = wrapper
      .findAll('span')
      .find(s => s.text() === 'Show Stroke');
    expect(strokeSpan).toBeDefined();
    const strokeBtn =
      strokeSpan!.element.parentElement!.querySelector('button');
    expect(strokeBtn).toBeDefined();
    strokeBtn!.click();
    expect(item.showStroke).toBe(true);

    const bgSpan = wrapper
      .findAll('span')
      .find(s => s.text() === 'Show Background');
    expect(bgSpan).toBeDefined();
    const bgBtn = bgSpan!.element.parentElement!.querySelector('button');
    expect(bgBtn).toBeDefined();
    bgBtn!.click();
    expect(item.showBackground).toBe(true);
  });

  it('emits delete event when Delete Text button is clicked', async () => {
    const item = {
      id: 'text-1',
      content: 'Delete Me',
      start: 0,
      duration: 2
    };

    const wrapper = mount(TimelinePropertiesInspector, {
      props: {
        modelValue: item
      },
      global: globalMountOptions
    });

    const deleteBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Delete Text'));
    expect(deleteBtn).toBeDefined();
    await deleteBtn!.trigger('click');
    expect(wrapper.emitted('delete')).toBeTruthy();
  });

  describe('Text Track Cover-Slide Inspired Mode', () => {
    it('renders 4 mini tabs and modern header when trackId is text', () => {
      const item = {
        id: 'text-1',
        type: 'text',
        content: 'Cover Style Text',
        start: 1.0,
        duration: 3.5,
        color: '#fbbf24'
      };

      const wrapper = mount(TimelinePropertiesInspector, {
        props: {
          modelValue: item,
          trackId: 'text'
        },
        global: globalMountOptions
      });

      // Modern header shows text snippet
      expect(wrapper.text()).toContain('Text');
      expect(wrapper.text()).toContain('"Cover Style Text"');

      // Four segmented mini tabs
      expect(wrapper.text()).toContain('Text');
      expect(wrapper.text()).toContain('Style');
      expect(wrapper.text()).toContain('Box');
      expect(wrapper.text()).toContain('Layout');

      // Default active tab is 'text'
      expect(wrapper.text()).toContain('Capitalization');
      expect(wrapper.text()).toContain('Timeline Timing');
      expect(wrapper.find('textarea').element.value).toBe('Cover Style Text');
    });

    it('navigates across tabs and updates style, box, and layout', async () => {
      const item = reactive({
        id: 'text-1',
        type: 'text',
        content: 'Interactive Text',
        start: 2.0,
        duration: 4.0,
        font: 'Inter',
        fontSize: 90,
        showStroke: false,
        strokeWidth: 4,
        showBackground: false,
        backgroundColor: '#000000',
        align: 'center',
        x: 540,
        y: 960
      });

      const wrapper = mount(TimelinePropertiesInspector, {
        props: {
          modelValue: item,
          trackId: 'text',
          videoLayout: 'landscape'
        },
        global: globalMountOptions
      });

      // Tab navigation buttons
      const tabButtons = wrapper.findAll('div.flex.bg-white\\/5 button');
      expect(tabButtons.length).toBe(4);

      // Switch to Style tab (index 1)
      await tabButtons[1]?.trigger('click');
      expect(wrapper.text()).toContain('Font Family');
      expect(wrapper.text()).toContain('Text Color');
      expect(wrapper.text()).toContain('Enable Outline');
      expect(wrapper.text()).toContain('Enable Shadow');

      // Switch to Box tab (index 2)
      await tabButtons[2]?.trigger('click');
      expect(wrapper.text()).toContain('Enable Background Box');

      // Switch to Layout tab (index 3)
      await tabButtons[3]?.trigger('click');
      expect(wrapper.text()).toContain('Text Alignment');
      expect(wrapper.text()).toContain(
        'Drag overlay in video canvas to position'
      );
      expect(wrapper.text()).toContain('Blank Zone Snap');
    });

    it('handles capitalization and text transform in text tab', async () => {
      const item = reactive({
        id: 'text-1',
        type: 'text',
        content: 'quick brown fox',
        textTransform: 'none'
      });

      const wrapper = mount(TimelinePropertiesInspector, {
        props: {
          modelValue: item,
          trackId: 'text'
        },
        global: globalMountOptions
      });

      const buttons = wrapper.findAll('button');
      const uppercaseBtn = buttons.find(b => b.text() === 'AA');
      const capitalizeBtn = buttons.find(b => b.text() === 'Aa');

      expect(uppercaseBtn).toBeDefined();
      expect(capitalizeBtn).toBeDefined();

      await uppercaseBtn!.trigger('click');
      expect(item.textTransform).toBe('uppercase');
      expect(item.content).toBe('QUICK BROWN FOX');

      await capitalizeBtn!.trigger('click');
      expect(item.textTransform).toBe('capitalize');
      expect(item.content).toBe('Quick Brown Fox');
    });
  });
});

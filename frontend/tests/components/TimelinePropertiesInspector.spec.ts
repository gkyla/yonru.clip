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
});

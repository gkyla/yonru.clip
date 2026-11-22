// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PipelineErrorCard from '../../app/components/home/PipelineErrorCard.vue';
import type { PipelineErrorDetail } from '../../app/types/clipper';

describe('PipelineErrorCard Component', () => {
  const globalConfig = {
    stubs: {
      Icon: true,
      NuxtIcon: true,
      NuxtLink: {
        props: ['to'],
        template: '<a :href="to"><slot /></a>'
      }
    }
  };

  it('renders provider 503 high demand error clearly with external badge, settings link, retry, and raw details toggle', async () => {
    const detail: PipelineErrorDetail = {
      origin: 'provider',
      code: 'high_demand',
      title: 'Gemini is experiencing high demand',
      message:
        "Google's Gemini service is temporarily overloaded for Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite) (503). This is an issue on Gemini's side, not a bug in Yonru Clip.",
      hint: 'Wait a moment and retry, or switch to another Hook Discovery Model in Settings > AI Model.',
      model: 'gemini-3.5-flash-lite',
      raw_error:
        '503 UNAVAILABLE. This model is currently experiencing high demand.',
      retryable: true
    };

    const wrapper = mount(PipelineErrorCard, {
      props: {
        error: detail.message,
        errorDetail: detail,
        canRetry: true
      },
      global: globalConfig
    });

    expect(wrapper.attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('GEMINI SERVICE');
    expect(wrapper.text()).toContain('gemini-3.5-flash-lite');
    expect(wrapper.text()).toContain('Gemini is experiencing high demand');
    expect(wrapper.text()).toContain("Gemini's side");

    const settingsLink = wrapper.find('a[href="/settings?tab=api"]');
    expect(settingsLink.exists()).toBe(true);

    // Raw details collapsed by default
    expect(wrapper.find('#pipeline-error-raw-details').exists()).toBe(false);
    const detailsBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Technical details'));
    expect(detailsBtn).toBeDefined();
    await detailsBtn!.trigger('click');
    expect(wrapper.find('#pipeline-error-raw-details').text()).toContain(
      '503 UNAVAILABLE'
    );

    const retryBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Retry'));
    expect(retryBtn).toBeDefined();
    await retryBtn!.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);

    const dismissBtn = wrapper.find('button[aria-label="Dismiss error"]');
    expect(dismissBtn.classes()).toContain('min-h-[44px]');
    expect(dismissBtn.classes()).toContain('min-w-[44px]');
    await dismissBtn.trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('hides Retry when canRetry is false even if errorDetail.retryable is true', () => {
    const detail: PipelineErrorDetail = {
      origin: 'provider',
      code: 'high_demand',
      title: 'Gemini is experiencing high demand',
      message: 'Service busy.',
      hint: 'Retry when ready.',
      retryable: true
    };

    const wrapper = mount(PipelineErrorCard, {
      props: {
        error: detail.message,
        errorDetail: detail,
        canRetry: false
      },
      global: globalConfig
    });

    expect(
      wrapper.findAll('button').some(b => b.text().includes('Retry'))
    ).toBe(false);
  });

  it('hides Retry and highlights API KEY / CONFIG for missing_api_key', () => {
    const detail: PipelineErrorDetail = {
      origin: 'config',
      code: 'missing_api_key',
      title: 'Gemini API key not configured',
      message: 'No valid Gemini API key is configured in Settings.',
      hint: 'Open Settings > AI Model and add at least one valid Gemini API key.',
      model: 'gemini-3.5-flash-lite',
      raw_error: null,
      retryable: false
    };

    const wrapper = mount(PipelineErrorCard, {
      props: {
        error: detail.message,
        errorDetail: detail,
        canRetry: true
      },
      global: globalConfig
    });

    expect(wrapper.text()).toContain('API KEY / CONFIG');
    expect(wrapper.find('a[href="/settings?tab=api"]').exists()).toBe(true);
    expect(
      wrapper.findAll('button').some(b => b.text().includes('Retry'))
    ).toBe(false);
  });

  it('renders plain fallback string gracefully when errorDetail is absent', () => {
    const wrapper = mount(PipelineErrorCard, {
      props: {
        error:
          'No transcript found. Yonru requires videos with available closed-captions to guarantee accurate frame synchronization.',
        errorDetail: null
      },
      global: globalConfig
    });

    expect(wrapper.text()).toContain('PIPELINE');
    expect(wrapper.text()).toContain('No closed-captions transcript found');
    expect(
      wrapper.findAll('button').some(b => b.text().includes('Retry'))
    ).toBe(false);
  });
});

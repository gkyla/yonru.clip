import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import settings from '../../app/pages/settings.vue'

// Mock useClipperState using relative path from tests/pages/
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: { value: {} },
    settingsScrollTarget: { value: '' },
    whisperModel: { value: 'base' },
    whisperModels: [
      { id: 'tiny', name: 'Tiny', speed: 'Ultra Fast', acc: 'Basic', desc: 'Minimal accuracy, best for quick testing on weak hardware.' },
      { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Great balance for clear audio. Default choice.' },
      { id: 'small', name: 'Small', speed: 'Fast', acc: 'Better', desc: 'Significantly better for non-English or noisy audio.' },
      { id: 'medium', name: 'Medium', speed: 'Moderate', acc: 'Excellent', desc: 'High precision. Requires decent hardware (~5GB VRAM).' },
      { id: 'large-v3', name: 'Large-v3', speed: 'Slow', acc: 'State-of-the-Art', desc: 'Highest accuracy possible. Best for complex dialogue.' }
    ],
    language: { value: 'id' },
    font: { value: 'Montserrat' },
    fontSize: { value: 100 },
    faceTracking: { value: false },
    cropMode: { value: 'manual' },
    cropPercentX: { value: 50 },
    volume: { value: 0.5 },
    subtitleMode: { value: 'word' },
    useNativePlayer: { value: false },
    showIframeDebug: { value: false },
    subtitleOffset: { value: 50 },
    subtitleSyncOffset: { value: 150 },
    subtitlePosition: { value: 'center' },
    subtitleAnimation: { value: 'pop' },
    subtitleHighlightMode: { value: 'color' },
    geminiApiKey: { value: '' },
    youtubeCookies: { value: '' },
    blacklistWords: { value: [] },
    showToast: vi.fn(),
    checkSystemHealth: vi.fn(),
    saveSettings: vi.fn(),
  })
}))

describe('Settings Page', () => {
  it('renders successfully', () => {
    const wrapper = mount(settings, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          HomeSettings: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })
})

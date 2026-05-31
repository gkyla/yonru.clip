import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import settings from '../../app/pages/settings.vue'

// Mock useClipperState using relative path from tests/pages/
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: { value: {} },
    settingsScrollTarget: { value: '' },
    whisperModel: { value: 'base' },
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
    subtitleSyncOffset: { value: -500 },
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarSettings from '../../app/components/SidebarSettings.vue'
import { ref } from 'vue'

const activeSafeZone = ref('none')
const safeZoneOpacity = ref(50)
const safeZoneColor = ref('#000000')

const mockState = {
  jobStatus: ref('ready'),
  renderStatus: ref('ready'),
  subtitlePreset: ref('bold-podcast'),
  subtitleMode: ref('3_words'),
  subtitleAnimation: ref('pop'),
  subtitleHighlightMode: ref('color'),
  subtitleBackground: ref('none'),
  subtitlePosition: ref('bottom'),
  font: ref('Inter'),
  fontSize: ref(80),
  subtitleFontWeight: ref(700),
  subtitleStrokeWidth: ref(3),
  subtitleTextTransform: ref('uppercase'),
  subtitleWordSpacing: ref(0),
  subtitleTextColor: ref('#FFFFFF'),
  subtitleHighlightColor: ref('#FFD700'),
  subtitleStrokeColor: ref('#000000'),
  subtitleOffset: ref(50),
  subtitleSyncOffset: ref(0),
  subtitleBackgroundOpacity: ref(0.8),
  cropMode: ref('manual'),
  cropPercentX: ref(50),
  activeSafeZone,
  safeZoneOpacity,
  safeZoneColor,
  activeHook: ref({ theme: 'Test Hook' }),
  outputUrl: ref('http://localhost/out.mp4'),
  showToast: vi.fn(),
  saveDefaultStyleSettings: vi.fn(),
  renderClip: vi.fn(),
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
  FONT_OPTIONS: ['Inter', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue']
}))

describe('SidebarSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.jobStatus.value = 'ready'
    mockState.renderStatus.value = 'ready'
  })

  it('renders concise tab labels (Presets, Text, Layout) with Presets active by default', () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    expect(wrapper.text()).toContain('Presets')
    expect(wrapper.text()).toContain('Text')
    expect(wrapper.text()).toContain('Layout')

    // Presets and Sync Offset should be visible in Presets tab
    expect(wrapper.text()).toContain('Podcast')
    expect(wrapper.text()).toContain('Display Mode')
    expect(wrapper.text()).toContain('Sync Offset (Timing)')
  })

  it('switches tabs smoothly when clicked', async () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    const tabs = wrapper.findAll('button.tab-btn')
    expect(tabs.length).toBe(3)

    // Click Text tab
    await tabs[1]!.trigger('click')
    expect(wrapper.text()).toContain('Font Family')
    expect(wrapper.text()).toContain('Size')

    // Click Layout tab
    await tabs[2]!.trigger('click')
    expect(wrapper.text()).toContain('Safe Zone Overlay')
    expect(wrapper.text()).toContain('Y-Offset (Vertical)')
  })

  it('renders ultra-compact single-row sticky footer in all tabs', async () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    expect(wrapper.text()).toContain('Save Style')
    expect(wrapper.text()).toContain('RENDER CLIP')

    // Switch to Text tab
    const tabs = wrapper.findAll('button.tab-btn')
    await tabs[1]!.trigger('click')

    // Sticky action footer should still be present
    expect(wrapper.text()).toContain('Save Style')
    expect(wrapper.text()).toContain('RENDER CLIP')
  })
})

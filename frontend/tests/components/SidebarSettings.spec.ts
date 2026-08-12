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
  FONT_OPTIONS: ['Inter', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Outfit', 'Noto Sans']
}))

describe('SidebarSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.jobStatus.value = 'ready'
    mockState.renderStatus.value = 'ready'
    mockState.subtitleBackground.value = 'none'
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
    expect(wrapper.text()).toContain('Hormozi Bold')
    expect(wrapper.text()).toContain('Minimal Glass')
    expect(wrapper.text()).toContain('Urban Street')
    expect(wrapper.text()).toContain('Cinematic Docu')
    expect(wrapper.text()).toContain('Rhythm Karaoke')
    expect(wrapper.text()).toContain('Modern Vlog')
    expect(wrapper.text()).toContain('Display Mode')
    expect(wrapper.text()).toContain('Sync Offset (Timing)')
  })

  it('applies Hormozi Bold preset with Montserrat and 0px stroke correctly', async () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    const presetButtons = wrapper.findAll('.grid.grid-cols-2 button')
    expect(presetButtons.length).toBeGreaterThanOrEqual(6)

    // Click Hormozi Bold
    await presetButtons[0]!.trigger('click')
    expect(mockState.subtitlePreset.value).toBe('bold-podcast')
    expect(mockState.font.value).toBe('Montserrat')
    expect(mockState.subtitleStrokeWidth.value).toBe(0)
    expect(mockState.subtitleHighlightColor.value).toBe('#CFFF50')
    expect(mockState.subtitleTextTransform.value).toBe('uppercase')
  })

  it('applies Cinematic Docu preset with Noto Sans, underline capsule, and gradient background', async () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    const presetButtons = wrapper.findAll('.grid.grid-cols-2 button')
    // Click Cinematic Docu (4th preset)
    await presetButtons[3]!.trigger('click')
    expect(mockState.subtitlePreset.value).toBe('documentary')
    expect(mockState.font.value).toBe('Noto Sans')
    expect(mockState.subtitleHighlightMode.value).toBe('underline')
    expect(mockState.subtitleBackground.value).toBe('none')
    expect(mockState.subtitleStrokeWidth.value).toBe(2)
  })

  it('renders standard text background options (None, Dark Box, Blur Pill)', async () => {
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    expect(wrapper.text()).toContain('Text Background')
    expect(wrapper.text()).toContain('None')
    expect(wrapper.text()).toContain('Dark Box')
    expect(wrapper.text()).toContain('Blur Pill')
    expect(wrapper.text()).not.toContain('Gradient')
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

  it('disables Save Style and RENDER CLIP buttons when clip is not loaded (jobStatus != ready)', async () => {
    mockState.jobStatus.value = 'cutting'
    const wrapper = mount(SidebarSettings, {
      global: {
        stubs: { Icon: true, NuxtIcon: true, BlacklistSettings: true }
      }
    })

    const buttons = wrapper.findAll('button')
    const saveBtn = buttons.find(b => b.text().includes('Save Style'))
    const renderBtn = buttons.find(b => b.text().includes('RENDER CLIP'))

    expect(saveBtn?.attributes('disabled')).toBeDefined()
    expect(renderBtn?.attributes('disabled')).toBeDefined()
  })
})

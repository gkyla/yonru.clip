// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HooksListPanel from '../../app/components/editor/HooksListPanel.vue'
import { ref } from 'vue'

const mockHooks = [
  {
    start: 10,
    end: 45,
    theme: 'AI Startup Breakthrough',
    transcript_quote: 'We discovered a new workflow that saves hours every day.',
    virality_score: 95
  },
  {
    start: 60,
    end: 90,
    theme: 'Secret Marketing Framework',
    transcript_quote: 'The framework revolves around hook consistency.',
    virality_score: 80
  }
]

const mockSavedHooks = [
  {
    _id: 'saved-1',
    start: 10,
    end: 45,
    theme: 'AI Startup Breakthrough',
    transcript_quote: 'We discovered a new workflow that saves hours every day.',
    virality_score: 95
  }
]

const mockState = {
  hooks: ref(mockHooks),
  savedHooks: ref(mockSavedHooks),
  activeHook: ref(mockHooks[0]),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('HooksListPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.hooks.value = [...mockHooks]
    mockState.savedHooks.value = [...mockSavedHooks]
    mockState.activeHook.value = mockHooks[0]
  })

  it('renders panel header and segmented tabs with counts', () => {
    const wrapper = mount(HooksListPanel, {
      props: {
        panelTab: 'generated',
        isCurrentHookSaved: false,
        isOverlayVisible: false,
        isHookRendered: () => false,
        isActiveHook: (h) => h.start === mockHooks[0]!.start
      },
      global: {
        stubs: { Icon: true, NuxtIcon: true, ContentAuditPanel: true }
      }
    })

    expect(wrapper.text()).toContain('Hooks Panel')
    expect(wrapper.text()).toContain('Generated')
    expect(wrapper.text()).toContain('(2)')
    expect(wrapper.text()).toContain('Saved')
    expect(wrapper.text()).toContain('(1)')
  })

  it('emits update:panelTab when tab button is clicked', async () => {
    const wrapper = mount(HooksListPanel, {
      props: {
        panelTab: 'generated',
        isCurrentHookSaved: false,
        isOverlayVisible: false,
        isHookRendered: () => false,
        isActiveHook: () => false
      },
      global: {
        stubs: { Icon: true, NuxtIcon: true, ContentAuditPanel: true }
      }
    })

    const buttons = wrapper.findAll('button.tab-btn')
    expect(buttons.length).toBe(2)

    // Click 'Saved' tab
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('update:panelTab')?.[0]).toEqual(['saved'])
  })

  it('renders active hook card with accent styling and emits select-hook on inactive card click', async () => {
    const wrapper = mount(HooksListPanel, {
      props: {
        panelTab: 'generated',
        isCurrentHookSaved: false,
        isOverlayVisible: false,
        isHookRendered: () => false,
        isActiveHook: (h) => h.start === mockHooks[0]!.start
      },
      global: {
        stubs: { Icon: true, NuxtIcon: true, ContentAuditPanel: true }
      }
    })

    expect(wrapper.text()).toContain('HOOK 01')
    expect(wrapper.text()).toContain('AI Startup Breakthrough')
    expect(wrapper.text()).toContain('HOOK 02')
    expect(wrapper.text()).toContain('Secret Marketing Framework')

    // Find cards (buttons in list)
    const hookButtons = wrapper.findAll('button').filter(b => b.text().includes('HOOK 02'))
    expect(hookButtons.length).toBe(1)

    await hookButtons[0]!.trigger('click')
    expect(wrapper.emitted('select-hook')?.[0]).toEqual([mockHooks[1]])
  })

  it('emits save-current-hook when Save Current button is clicked', async () => {
    const wrapper = mount(HooksListPanel, {
      props: {
        panelTab: 'generated',
        isCurrentHookSaved: false,
        isOverlayVisible: false,
        isHookRendered: () => false,
        isActiveHook: () => true
      },
      global: {
        stubs: { Icon: true, NuxtIcon: true, ContentAuditPanel: true }
      }
    })

    const saveBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Save' || b.text().includes('Save'))
    expect(saveBtn?.exists()).toBe(true)

    await saveBtn?.trigger('click')
    expect(wrapper.emitted('save-current-hook')).toBeTruthy()
  })

  it('emits remove-current-saved-hook when Remove Saved button is clicked', async () => {
    const wrapper = mount(HooksListPanel, {
      props: {
        panelTab: 'generated',
        isCurrentHookSaved: true,
        isOverlayVisible: false,
        isHookRendered: () => false,
        isActiveHook: () => true
      },
      global: {
        stubs: { Icon: true, NuxtIcon: true, ContentAuditPanel: true }
      }
    })

    const removeBtn = wrapper.findAll('button').find(b => b.text().includes('Remove Saved'))
    expect(removeBtn?.exists()).toBe(true)

    await removeBtn?.trigger('click')
    expect(wrapper.emitted('remove-current-saved-hook')).toBeTruthy()
  })
})

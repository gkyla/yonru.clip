// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReanalyzeModal from '../../app/components/home/ReanalyzeModal.vue'
import { ref } from 'vue'

const mockState = {
  promptsList: ref([
    { id: 'prompt.json', name: 'Standard Viral Hook', suitableFor: ['Podcast', 'Talk Show'] },
    { id: 'funny.json', name: 'Comedy Punchlines', suitableFor: ['Standup', 'Vlog'] }
  ]),
  selectedPrompt: ref('prompt.json'),
  selectedPresetId: ref('auto'),
  extractionMode: ref('preset'),
  focusTopic: ref(''),
  minDuration: ref(30),
  maxDuration: ref(180),
  cachedVideos: ref([
    {
      video_id: 'vid-123',
      title: 'How to Build AI Agents',
      duration: 420,
      thumbnail_url: '/static/thumbnails/vid-123.jpg'
    }
  ])
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('HomeReanalyzeModal Component', () => {
  beforeEach(() => {
    mockState.selectedPresetId.value = 'auto'
    mockState.selectedPrompt.value = 'prompt.json'
    mockState.extractionMode.value = 'preset'
    mockState.focusTopic.value = ''
    mockState.minDuration.value = 30
    mockState.maxDuration.value = 180
  })

  it('is hidden initially and opens with target video context', async () => {
    const wrapper = mount(ReanalyzeModal, {
      global: {
        stubs: {
          Icon: true,
          NuxtLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    expect(wrapper.find('.fixed.inset-0').exists()).toBe(false)

    // Call open() with target video ID
    const vm = wrapper.vm as any
    vm.open('vid-123')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
    expect(wrapper.text()).toContain('Reanalyze Video Hooks')
    expect(wrapper.text()).toContain('How to Build AI Agents')
    expect(wrapper.text()).toContain('ID: vid-123')
  })

  it('opens unified dropdown, toggles tabs inside popover, and selects custom template', async () => {
    const wrapper = mount(ReanalyzeModal, {
      global: {
        stubs: {
          Icon: true,
          NuxtLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    const vm = wrapper.vm as any
    vm.open('vid-123')
    await wrapper.vm.$nextTick()

    // Default selection is Auto Detect Virality
    expect(wrapper.text()).toContain('Auto Detect Virality')

    // Open dropdown
    const dropdownTrigger = wrapper.find('button[class*="bg-surface-card"]')
    expect(dropdownTrigger.exists()).toBe(true)
    await dropdownTrigger.trigger('click')

    expect(vm.isDropdownOpen).toBe(true)
    expect(wrapper.text()).toContain('Smart Presets')
    expect(wrapper.text()).toContain('Custom Templates')

    // Switch to Custom Templates tab inside popover
    const customTabBtn = wrapper.findAll('button').find(b => b.text().includes('Custom Templates'))
    expect(customTabBtn).toBeDefined()
    await customTabBtn!.trigger('click')

    expect(vm.dropdownTab).toBe('custom')
    expect(wrapper.text()).toContain('Comedy Punchlines')

    // Select Comedy Punchlines
    const comedyBtn = wrapper.findAll('button').find(b => b.text().includes('Comedy Punchlines'))
    expect(comedyBtn).toBeDefined()
    await comedyBtn!.trigger('click')

    expect(vm.isDropdownOpen).toBe(false)
    expect(vm.extractionMode).toBe('custom')
    expect(vm.selectedPromptFile).toBe('funny.json')
  })

  it('updates duration preset and topic focus then submits', async () => {
    const wrapper = mount(ReanalyzeModal, {
      global: {
        stubs: {
          Icon: true,
          NuxtLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    const vm = wrapper.vm as any
    vm.open('vid-123')
    await wrapper.vm.$nextTick()

    // Click 60s - 90s duration preset
    const durationBtn = wrapper.findAll('button').find(b => b.text().includes('60s - 90s'))
    expect(durationBtn).toBeDefined()
    await durationBtn!.trigger('click')

    // Input topic focus
    const input = wrapper.find('input[placeholder*="mitos air es"]')
    expect(input.exists()).toBe(true)
    await input.setValue('autonomous AI workflows')

    // Click Start Reanalysis
    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Start Reanalysis'))
    expect(submitBtn).toBeDefined()
    await submitBtn!.trigger('click')

    expect(wrapper.emitted('reanalyze')).toBeDefined()
    const emittedPayload = wrapper.emitted('reanalyze')![0]
    expect(emittedPayload).toEqual([
      'vid-123',
      true,
      {
        extractionMode: 'preset',
        presetId: 'auto',
        promptFile: undefined,
        focusTopic: 'autonomous AI workflows',
        minDuration: 60,
        maxDuration: 90,
        autoHooks: true
      }
    ])
  })
})

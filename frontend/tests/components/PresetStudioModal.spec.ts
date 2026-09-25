import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PresetStudioModal from '../../app/components/editor/PresetStudioModal.vue'
import { SUBTITLE_PRESETS } from '../../app/constants/subtitlePresets'

const globalMountOptions = {
  stubs: {
    Icon: true,
    NuxtIcon: true,
    Teleport: true,
  }
}

describe('PresetStudioModal Component', () => {
  it('renders modal with all 16 presets by default when show is true', () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast',
      },
      global: globalMountOptions
    })

    expect(wrapper.text()).toContain('Preset Studio')
    expect(wrapper.text()).toContain('16 Styles')
    expect(wrapper.text()).toContain('Hormozi Bold')
    expect(wrapper.text()).toContain('MrBeast Impact')
    expect(wrapper.text()).toContain('Cyber Neon')
    expect(wrapper.text()).toContain('Active')
  })

  it('filters presets when a category tab is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast',
      },
      global: globalMountOptions
    })

    // Find Podcast category button
    const buttons = wrapper.findAll('button')
    const podcastBtn = buttons.find(b => b.text().includes('Podcast & Talk'))
    expect(podcastBtn).toBeDefined()

    await podcastBtn!.trigger('click')

    // Only podcast category presets should be displayed
    const podcastPresets = SUBTITLE_PRESETS.filter(p => p.category === 'podcast')
    for (const p of podcastPresets) {
      expect(wrapper.text()).toContain(p.name)
    }

    // Creative preset should not be in the filtered list
    expect(wrapper.text()).not.toContain('Comic Story')
  })

  it('filters presets via search query', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast',
      },
      global: globalMountOptions
    })

    const searchInput = wrapper.find('input[type="text"]')
    await searchInput.setValue('Beast')

    expect(wrapper.text()).toContain('MrBeast Impact')
    expect(wrapper.text()).not.toContain('Hormozi Bold')
  })

  it('emits select and close when a preset card is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast',
      },
      global: globalMountOptions
    })

    const cards = wrapper.findAll('.grid button')
    expect(cards.length).toBe(16)

    // Click on 2nd card (Minimal Glass)
    await cards[1]!.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ id: 'clean-vlog' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mount(PresetStudioModal, {
      props: {
        show: true,
        activePresetId: 'bold-podcast',
      },
      global: globalMountOptions
    })

    const closeBtn = wrapper.find('button[aria-label="Close preset studio"]')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

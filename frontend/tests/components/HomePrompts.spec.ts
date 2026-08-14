// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import HomePrompts from '../../app/components/HomePrompts.vue'

const mockPromptsList = ref<any[]>([
  { id: 'prompt.json::0', name: 'Podcast Hooks', suitableFor: ['podcast', 'comedy'], prompt: 'Podcast prompt {num_hooks}', numHooks: 5, autoHooks: false },
  { id: 'prompt.json::1', name: 'Education Explainer', suitableFor: ['education', 'science'], prompt: 'Explainer prompt {duration_constraint}', numHooks: 10, autoHooks: true }
])
const mockSelectedPrompt = ref('prompt.json::0')
const mockFetchPrompts = vi.fn().mockResolvedValue({})
const mockEditPrompt = vi.fn().mockResolvedValue(true)
const mockDeletePrompt = vi.fn().mockResolvedValue(true)
const mockShowToast = vi.fn()

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    promptsList: mockPromptsList,
    selectedPrompt: mockSelectedPrompt,
    fetchPrompts: mockFetchPrompts,
    editPrompt: mockEditPrompt,
    deletePrompt: mockDeletePrompt,
    showToast: mockShowToast
  })
}))

describe('HomePrompts Component', () => {
  beforeEach(() => {
    mockPromptsList.value = [
      { id: 'prompt.json::0', name: 'Podcast Hooks', suitableFor: ['podcast', 'comedy'], prompt: 'Podcast prompt {num_hooks}', numHooks: 5, autoHooks: false },
      { id: 'prompt.json::1', name: 'Education Explainer', suitableFor: ['education', 'science'], prompt: 'Explainer prompt {duration_constraint}', numHooks: 10, autoHooks: true }
    ]
    mockSelectedPrompt.value = 'prompt.json::0'
    mockFetchPrompts.mockClear()
    mockEditPrompt.mockClear()
    mockDeletePrompt.mockClear()
    mockShowToast.mockClear()
  })

  it('renders search input and available prompts list', () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Search input should be present
    const searchInput = wrapper.find('input[placeholder*="Search prompts"]')
    expect(searchInput.exists()).toBe(true)

    // Should contain prompt names in the list
    const text = wrapper.text()
    expect(text).toContain('Podcast Hooks')
    expect(text).toContain('Education Explainer')
  })

  it('filters prompts list by text search', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Initially, both prompts should be in the list
    expect(wrapper.text()).toContain('Podcast Hooks')
    expect(wrapper.text()).toContain('Education Explainer')

    // Search for 'Podcast'
    const searchInput = wrapper.find('input[placeholder*="Search prompts"]')
    await searchInput.setValue('Podcast')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Podcast Hooks')
    expect(wrapper.text()).not.toContain('Education Explainer')
  })

  it('switches editor detail pane on prompt card click and displays empty state when deselected', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click on 'Education Explainer' card to edit
    const explainerCard = wrapper.findAll('button').find(d => d.text().includes('Education Explainer'))
    expect(explainerCard).toBeDefined()
    await explainerCard!.trigger('click')
    await wrapper.vm.$nextTick()

    // Editor should load the prompt details
    expect((wrapper.vm as any).promptName).toBe('Education Explainer')
    expect((wrapper.vm as any).autoHooks).toBe(true)

    // Click "Cancel" to deselect
    const cancelBtn = wrapper.findAll('button').find(b => b.text().includes('Cancel'))
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Editor should show empty state or reset
    expect((wrapper.vm as any).editingId).toBeNull()
  })

  it('edits content text directly and saves with natural AI defaults', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          // Use real prompt editor slot/text-area or stub it
          PromptEditor: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          }
        }
      }
    })

    // Select a prompt to open editor
    const firstCard = wrapper.findAll('button').find(d => d.text().includes('Podcast Hooks'))
    await firstCard!.trigger('click')
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)

    // Set updated prompt text
    await textarea.setValue('Updated archetype criteria for podcast')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).promptText).toBe('Updated archetype criteria for podcast')

    // Click Update Prompt
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Update Prompt'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockEditPrompt).toHaveBeenCalledWith(
      'prompt.json::0',
      'Podcast Hooks',
      ['podcast', 'comedy'],
      'Updated archetype criteria for podcast',
      10,
      true
    )
  })

  it('displays delete confirmation modal and executes deletion on confirm', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click on 'Podcast Hooks' card to edit
    const firstCard = wrapper.findAll('button').find(d => d.text().includes('Podcast Hooks'))
    await firstCard!.trigger('click')
    await wrapper.vm.$nextTick()

    // Delete button should be visible in editing mode
    const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('Delete'))
    expect(deleteBtn).toBeDefined()
    expect(deleteBtn!.exists()).toBe(true)

    // Initially, showDeleteModal should be false
    expect((wrapper.vm as any).showDeleteModal).toBe(false)
    expect(wrapper.text()).not.toContain('Delete Prompt Template?')

    // Click Delete button
    await deleteBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Modal should be open
    expect((wrapper.vm as any).showDeleteModal).toBe(true)
    expect(wrapper.text()).toContain('Delete Prompt Template?')

    // Find and click 'Cancel' inside modal
    const cancelModalBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel' && b.attributes('class')?.includes('flex-1'))
    expect(cancelModalBtn).toBeDefined()
    await cancelModalBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Modal should be closed, no deletion executed
    expect((wrapper.vm as any).showDeleteModal).toBe(false)
    expect(mockDeletePrompt).not.toHaveBeenCalled()

    // Click Delete button again
    await deleteBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).showDeleteModal).toBe(true)

    // Find and click 'Confirm Delete' inside modal
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('Confirm Delete'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Deletion should be executed, editor reset, and modal closed
    expect(mockDeletePrompt).toHaveBeenCalledWith('prompt.json::0')
    expect((wrapper.vm as any).showDeleteModal).toBe(false)
    expect((wrapper.vm as any).editingId).toBeNull()
  })

  it('renders max-w-5xl container and simplified info callout banner', () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Root container must have max-w-5xl
    expect(wrapper.find('.max-w-5xl').exists()).toBe(true)

    // Info banner should contain clear non-technical guidance
    expect(wrapper.text()).toContain('Kustomisasi Gaya Prompt')
    expect(wrapper.text()).not.toContain('Scoped Archetype Directives')
    expect(wrapper.text()).not.toContain('100% Natural AI Detection')
  })

  it('limits visible tags to max 2 in list cards, displays +N badge, and provides custom tooltips', async () => {
    mockPromptsList.value = [
      { id: 'prompt.json::multi', name: 'Multi Tag Prompt', suitableFor: ['podcast', 'comedy', 'humor', 'talkshow'], prompt: 'Multi tag test', numHooks: 10, autoHooks: true }
    ]

    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Card should render first 2 tags and +2 count
    expect(wrapper.text()).toContain('podcast')
    expect(wrapper.text()).toContain('comedy')
    expect(wrapper.text()).toContain('+2')

    // Custom tooltips with hashtag prefixes should be present in the DOM
    expect(wrapper.text()).toContain('#podcast')
    expect(wrapper.text()).toContain('#comedy')
    expect(wrapper.text()).toContain('#humor, #talkshow')
  })
})

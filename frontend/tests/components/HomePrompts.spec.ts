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

    // Action bar shows Revert button when editing
    const revertBtn = wrapper.findAll('button').find(b => b.text().includes('Revert'))
    expect(revertBtn).toBeDefined()

    // Start New Prompt to test Cancel button
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create New'))
    expect(createBtn).toBeDefined()
    await createBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Click "Cancel" in new template form to deselect
    const cancelBtn = wrapper.findAll('button').find(b => b.text().includes('Cancel'))
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Editor should show empty state
    expect((wrapper.vm as any).editingId).toBeNull()
    expect((wrapper.vm as any).isCreatingNew).toBe(false)
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

  it('triggers Unsaved Changes modal when switching templates with unsaved modifications', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click on 'Podcast Hooks' to edit
    const podcastCard = wrapper.findAll('button').find(d => d.text().includes('Podcast Hooks'))
    await podcastCard!.trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).isDirty).toBe(false)
    expect((wrapper.vm as any).showUnsavedModal).toBe(false)

    // Modify promptName
    const nameInput = wrapper.find('input[placeholder*="Comedy Podcast Hooks"]')
    await nameInput.setValue('Modified Podcast Hooks')
    await wrapper.vm.$nextTick()

    // Should now be dirty
    expect((wrapper.vm as any).isDirty).toBe(true)

    // Try to click 'Education Explainer' card
    const explainerCard = wrapper.findAll('button').find(d => d.text().includes('Education Explainer'))
    await explainerCard!.trigger('click')
    await wrapper.vm.$nextTick()

    // Unsaved Changes modal should open instead of switching immediately
    expect((wrapper.vm as any).showUnsavedModal).toBe(true)
    expect(wrapper.text()).toContain('Unsaved Changes Detected')
    expect((wrapper.vm as any).editingId).toBe('prompt.json::0')

    // Test 'Keep Editing / Cancel'
    const cancelModalBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel' && (wrapper.vm as any).showUnsavedModal)
    await (wrapper.vm as any).keepEditing()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showUnsavedModal).toBe(false)
    expect((wrapper.vm as any).editingId).toBe('prompt.json::0')

    // Trigger switch again and Discard
    await explainerCard!.trigger('click')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).showUnsavedModal).toBe(true)

    // Click Discard
    await (wrapper.vm as any).confirmDiscardAndProceed()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showUnsavedModal).toBe(false)
    expect((wrapper.vm as any).editingId).toBe('prompt.json::1')
  })

  it('navigates to target route when discard is confirmed during route leave interception', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click on 'Podcast Hooks' to edit
    const podcastCard = wrapper.findAll('button').find(d => d.text().includes('Podcast Hooks'))
    await podcastCard!.trigger('click')
    await wrapper.vm.$nextTick()

    // Modify promptName to make it dirty
    const nameInput = wrapper.find('input[placeholder*="Comedy Podcast Hooks"]')
    await nameInput.setValue('Modified Podcast Hooks')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).isDirty).toBe(true)

    // Trigger route leave guard
    const mockNext = vi.fn()
    ;(wrapper.vm as any).handleRouteLeave({ fullPath: '/editor' }, {}, mockNext)
    expect(mockNext).toHaveBeenCalledWith(false)
    expect((wrapper.vm as any).showUnsavedModal).toBe(true)
    expect((wrapper.vm as any).pendingActionDescription).toBe('Navigate to /editor')

    // Confirm discard
    await (wrapper.vm as any).confirmDiscardAndProceed()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showUnsavedModal).toBe(false)
    expect((wrapper.vm as any).editingId).toBeNull()
    expect((wrapper.vm as any).isDirty).toBe(false)
  })

  it('reverts modified template draft back to saved baseline snapshot without closing editor', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click on 'Podcast Hooks' to edit
    const podcastCard = wrapper.findAll('button').find(d => d.text().includes('Podcast Hooks'))
    await podcastCard!.trigger('click')
    await wrapper.vm.$nextTick()

    // Find Revert button - should be disabled when clean
    const revertBtn = wrapper.findAll('button').find(b => b.text().includes('Revert'))
    expect(revertBtn).toBeDefined()
    expect(revertBtn!.attributes('disabled')).toBeDefined()

    // Modify promptName
    const nameInput = wrapper.find('input[placeholder*="Comedy Podcast Hooks"]')
    await nameInput.setValue('Modified Podcast Hooks')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).isDirty).toBe(true)
    expect(revertBtn!.attributes('disabled')).toBeUndefined()

    // Click Revert button -> opens showRevertModal
    await revertBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showRevertModal).toBe(true)
    expect(wrapper.text()).toContain('Revert Template Changes?')

    // Execute revert
    await (wrapper.vm as any).executeRevertPrompt()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showRevertModal).toBe(false)
    expect((nameInput.element as HTMLInputElement).value).toBe('Podcast Hooks')
    expect((wrapper.vm as any).isDirty).toBe(false)
    expect((wrapper.vm as any).editingId).toBe('prompt.json::0')
  })

  it('opens Discard New Template modal when canceling an unsaved new template draft', async () => {
    const wrapper = mount(HomePrompts, {
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true
        }
      }
    })

    // Click + Create New Template
    const createBtn = wrapper.findAll('button').find(b => b.text().includes('+ Create New Template'))
    await createBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).isCreatingNew).toBe(true)
    expect((wrapper.vm as any).isDirty).toBe(false)

    // Type name in new template
    const nameInput = wrapper.find('input[placeholder*="Comedy Podcast Hooks"]')
    await nameInput.setValue('Brand New Archetype')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).isDirty).toBe(true)

    // Click Cancel in action bar
    const cancelBtn = wrapper.findAll('button').find(b => b.text().includes('Cancel'))
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showDiscardNewModal).toBe(true)
    expect(wrapper.text()).toContain('Discard New Template Draft?')

    // Confirm discard
    await (wrapper.vm as any).confirmDiscardNew()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showDiscardNewModal).toBe(false)
    expect((wrapper.vm as any).isCreatingNew).toBe(false)
    expect((wrapper.vm as any).editingId).toBeNull()
  })
})

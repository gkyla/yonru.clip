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
const mockShowToast = vi.fn()

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    promptsList: mockPromptsList,
    selectedPrompt: mockSelectedPrompt,
    fetchPrompts: mockFetchPrompts,
    editPrompt: mockEditPrompt,
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

  it('inserts variable tags at textarea cursor position when clicked', async () => {
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

    // Set value and focus/cursor position
    const el = textarea.element as HTMLTextAreaElement
    el.value = 'Custom prompt '
    el.selectionStart = el.selectionEnd = 14
    await textarea.trigger('input')

    // Find and click {duration_constraint} badge button
    const varBtn = wrapper.findAll('button').find(b => b.text().includes('{duration_constraint}'))
    expect(varBtn).toBeDefined()
    await varBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Should insert variable
    expect((wrapper.vm as any).promptText).toBe('Custom prompt {duration_constraint}')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import prompts from '../../app/pages/prompts.vue'

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    promptsList: { value: [] },
    selectedPrompt: { value: '' },
    showToast: vi.fn(),
  })
}))

describe('Prompts Page', () => {
  it('renders successfully', () => {
    const wrapper = mount(prompts, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          HomePrompts: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })
})

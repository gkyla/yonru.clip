import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VerifySetup from '../../app/components/VerifySetup.vue'

describe('VerifySetup Component', () => {
  it('renders correctly and has active reactivity', async () => {
    const wrapper = mount(VerifySetup)
    
    // Assert title text
    const title = wrapper.find('[data-testid="title"]')
    expect(title.text()).toBe('Nuxt Testing Environment Ready')
    
    // Assert initial count
    const button = wrapper.find('[data-testid="btn-increment"]')
    expect(button.text()).toBe('Count: 0')
    
    // Trigger click and assert incremented value
    await button.trigger('click')
    expect(button.text()).toBe('Count: 1')
  })
})

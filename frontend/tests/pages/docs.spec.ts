import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import docs from '../../app/pages/docs.vue'

describe('Docs Page', () => {
  it('renders successfully', () => {
    const wrapper = mount(docs, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          HomeDocs: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })
})

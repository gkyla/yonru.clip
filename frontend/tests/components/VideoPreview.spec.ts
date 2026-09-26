// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPreview from '../../app/components/VideoPreview.vue'
import { useClipperState } from '../../app/composables/useClipperState'

describe('VideoPreview Component', () => {
  beforeEach(() => {
    const state = useClipperState()
    state.videoUrl.value = null
    state.outputUrl.value = null
    state.useNativePlayer.value = false
  })

  it('mounts successfully without TDZ ReferenceError on videoTime or isInThumbnailWindow', () => {
    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('mounts in-memory RemotionPlayer component inside ClientOnly instead of legacy iframe', async () => {
    const state = useClipperState()
    state.videoUrl.value = 'http://localhost:8000/sample.mp4'
    state.useNativePlayer.value = false

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div class="client-only-stub"><slot /></div>' },
          RemotionPlayer: {
            props: ['bridge'],
            template: '<div class="remotion-player-stub"></div>'
          },
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    })

    // Confirm legacy iframe is completely eliminated
    expect(wrapper.find('iframe').exists()).toBe(false)

    // Confirm RemotionPlayer is mounted
    const playerStub = wrapper.find('.remotion-player-stub')
    expect(playerStub.exists()).toBe(true)
  })

  it('renders ClientOnly fallback placeholder when client fallback is active', async () => {
    const state = useClipperState()
    state.videoUrl.value = 'http://localhost:8000/sample.mp4'
    state.useNativePlayer.value = false

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div class="client-only-fallback"><slot name="fallback" /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    })

    expect(wrapper.text()).toContain('Loading video player...')
  })
})

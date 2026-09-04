// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CachedVideoLibrary from '../../app/components/home/CachedVideoLibrary.vue'
import { ref } from 'vue'
import type { CachedVideo } from '../../app/types/clipper'

const mockState = {
  cachedVideosSearch: ref(''),
  cachedVideosSortBy: ref('date'),
  cachedVideosSortOrder: ref('desc'),
  cachedVideosHasMore: ref(false),
  isCachedMoreLoading: ref(false),
  cachedVideosFetchError: ref(false),
  cachedVideosPage: ref(1),
  hooks: ref([]),
  folderName: ref(''),
  fetchCached: vi.fn()
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('CachedVideoLibrary Component', () => {
  const sampleVideos: CachedVideo[] = [
    {
      video_id: 'vid-12345678',
      title: 'Mastering Antigravity AI Agents',
      duration: 300,
      folder_name: 'Mastering_Antigravity_AI_Agents_vid-12345678',
      channel: 'Deepmind Creator',
      added_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      mtime: 1725400000.0,
      thumbnail_url: '/thumbs/vid-12345678.jpg'
    },
    {
      video_id: 'vid-87654321',
      title: 'Legacy Video Without Channel',
      duration: 150,
      folder_name: 'Legacy_Video_vid-87654321',
      // No channel or added_at provided
      mtime: 1725000000.0
    }
  ]

  beforeEach(() => {
    mockState.cachedVideosSearch.value = ''
    mockState.cachedVideosSortBy.value = 'date'
    mockState.cachedVideosSortOrder.value = 'desc'
    mockState.cachedVideosHasMore.value = false
    mockState.isCachedMoreLoading.value = false
    mockState.cachedVideosFetchError.value = false
    mockState.cachedVideosPage.value = 1
    mockState.hooks.value = []
  })

  it('renders channel name, fallback, and relative added date in grid view', () => {
    const wrapper = mount(CachedVideoLibrary, {
      props: {
        cachedVideos: sampleVideos,
        isCachedLoading: false,
        isProcessing: false
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    const text = wrapper.text()
    // 1. Channel names
    expect(text).toContain('Deepmind Creator')
    expect(text).toContain('Unknown Channel')

    // 2. Titles and IDs
    expect(text).toContain('Mastering Antigravity AI Agents')
    expect(text).toContain('Legacy Video Without Channel')
    expect(text).toContain('ID: vid-12345678')
    expect(text).toContain('ID: vid-87654321')

    // 3. Relative time
    expect(text).toContain('2h ago')

    // 4. Hover tooltips on added date
    const dateElements = wrapper.findAll('[title*="Added on"]')
    expect(dateElements.length).toBeGreaterThanOrEqual(2)
  })

  it('renders channel and relative date correctly in list view', async () => {
    const wrapper = mount(CachedVideoLibrary, {
      props: {
        cachedVideos: sampleVideos,
        isCachedLoading: false,
        isProcessing: false
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    // Switch to list view
    const listButton = wrapper.findAll('button').find(b => b.html().includes('ri:list-check'))
    if (listButton) {
      await listButton.trigger('click')
    } else {
      (wrapper.vm as any).viewMode = 'list'
      await wrapper.vm.$nextTick()
    }

    const text = wrapper.text()
    expect(text).toContain('Deepmind Creator')
    expect(text).toContain('Unknown Channel')
    expect(text).toContain('2h ago')
    expect(text).toContain('ID: vid-12345678')
  })
})

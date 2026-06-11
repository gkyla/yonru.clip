// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import editor from '../../app/pages/editor.vue'

// Mock useRoute and useRouter from #imports
vi.mock('#imports', () => ({
  useRoute: () => ({
    query: {
      job_id: 'job-123',
      folder: 'test_folder',
      clip_id: '10_20_test'
    }
  }),
  useRouter: () => ({
    push: vi.fn()
  })
}))

// Mock useClipperState using relative path
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    cachedVideos: { value: [] },
    lastAccessedVideo: { value: null },
    lastAccessedClip: { value: null },
    videoTitle: { value: '' },
    jobStatus: { value: 'idle' },
    whisperModel: { value: 'base' },
    isNavigatingToEditor: { value: false },
    fetchCached: vi.fn(),
    fetchSavedHooks: vi.fn(),
    initPersistence: vi.fn(),
    stopPolling: vi.fn(),
    startPolling: vi.fn(),
    renderStatus: { value: 'idle' },
    jobId: { value: '' },
    folderName: { value: '' },
    clipId: { value: '' },
    savedHooks: { value: [] },
    hooks: { value: [] },
    activeHook: { value: null }
  })
}))

describe('Editor Page', () => {
  it('renders successfully', () => {
    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelinePanel: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          TranscriptEditor: true,
          AuditLogsPanel: true,
          RenderingOverlay: true,
          Icon: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('resets sidebarView to editor on keep-alive activation', async () => {
    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelinePanel: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          TranscriptEditor: true,
          AuditLogsPanel: true,
          RenderingOverlay: true,
          Icon: true
        }
      }
    })
    
    // Wait for hasBeenMounted to become true via nextTick
    await wrapper.vm.$nextTick()
    
    // Simulate navigating away to home page (which mutates sidebarView ref)
    const vm = wrapper.vm as any
    vm.sidebarView = 'home'
    
    // Trigger keep-alive activated hooks
    const instance = wrapper.vm.$.vnode.component as Record<string, unknown> | null
    if (instance && Array.isArray(instance.a)) {
      instance.a.forEach((hook: unknown) => {
        if (typeof hook === 'function') {
          hook()
        }
      })
    }
    
    await wrapper.vm.$nextTick()
    
    expect(vm.sidebarView).toBe('editor')
  })
})

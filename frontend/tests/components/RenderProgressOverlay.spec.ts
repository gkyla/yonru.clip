import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RenderProgressOverlay from '../../app/components/editor/RenderProgressOverlay.vue'
import { ref } from 'vue'

const mockState = {
  renderStatus: ref('idle'),
  renderProgress: ref(0),
  renderStage: ref(''),
  renderEta: ref(0),
  outputUrl: ref<string | null>(null),
  renderFrame: ref(0),
  renderTotalFrames: ref(0),
  renderStartTime: ref<number | null>(null),
  jobError: ref(''),
  selectedHookIndex: ref(0),
  renderClip: vi.fn(),
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
}))

describe('RenderProgressOverlay Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.renderStatus.value = 'idle'
    mockState.renderProgress.value = 0
    mockState.renderStage.value = ''
    mockState.renderEta.value = 0
    mockState.outputUrl.value = null
    mockState.renderFrame.value = 0
    mockState.renderTotalFrames.value = 0
    mockState.renderStartTime.value = null
    mockState.jobError.value = ''
  })

  it('remains hidden when renderStatus is idle', () => {
    const wrapper = mount(RenderProgressOverlay, {
      global: { stubs: { Icon: true, NuxtIcon: true } }
    })
    const overlay = wrapper.find('[data-testid="render-overlay"]')
    expect(overlay.exists()).toBe(false)
  })

  it('renders HUD overlay with 3-stage pipeline stepper during rendering', () => {
    mockState.renderStatus.value = 'rendering'
    mockState.renderStage.value = 'bundling'
    mockState.renderProgress.value = 12

    const wrapper = mount(RenderProgressOverlay, {
      global: { stubs: { Icon: true, NuxtIcon: true } }
    })

    expect(wrapper.find('[data-testid="render-overlay"]').exists()).toBe(true)
    const stages = wrapper.findAll('[data-testid="stepper-stage"]')
    expect(stages.length).toBe(3)
  })

  it('correctly maps engine prep stage before first frame is emitted and frame rendering stage afterwards', async () => {
    mockState.renderStatus.value = 'rendering'
    mockState.renderStage.value = 'rendering'
    mockState.renderProgress.value = 15
    mockState.renderFrame.value = 0
    mockState.renderTotalFrames.value = 300

    const wrapper = mount(RenderProgressOverlay, {
      global: { stubs: { Icon: true, NuxtIcon: true } }
    })

    // During engine prep (frame = 0)
    expect(wrapper.text()).toContain('Engine & Canvas Prep')

    // After frame 1 is emitted
    mockState.renderFrame.value = 45
    mockState.renderProgress.value = 30
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Frame 45 / 300')
    expect(wrapper.text()).toContain('Frame Rendering')
  })

  it('renders in-overlay celebration screen when renderStatus is done', async () => {
    mockState.renderStatus.value = 'done'
    mockState.outputUrl.value = 'http://localhost:8000/static/output/sample.mp4'

    const wrapper = mount(RenderProgressOverlay, {
      global: { stubs: { Icon: true, NuxtIcon: true } }
    })

    expect(wrapper.find('[data-testid="render-overlay"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Clip Rendered Successfully!')
    expect(wrapper.find('[data-testid="download-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-close-btn"]').exists()).toBe(true)

    // Clicking close resets renderStatus to idle
    await wrapper.find('[data-testid="preview-close-btn"]').trigger('click')
    expect(mockState.renderStatus.value).toBe('idle')
  })

  it('renders in-overlay error diagnostics when renderStatus is error and allows retry', async () => {
    mockState.renderStatus.value = 'error'
    mockState.jobError.value = 'Remotion exited with code 1: Font missing'

    const wrapper = mount(RenderProgressOverlay, {
      global: { stubs: { Icon: true, NuxtIcon: true } }
    })

    expect(wrapper.find('[data-testid="render-overlay"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Render Encountered an Issue')
    expect(wrapper.text()).toContain('Remotion exited with code 1: Font missing')

    const retryBtn = wrapper.find('[data-testid="retry-render-btn"]')
    expect(retryBtn.exists()).toBe(true)
    await retryBtn.trigger('click')
    expect(mockState.renderClip).toHaveBeenCalled()
  })
})

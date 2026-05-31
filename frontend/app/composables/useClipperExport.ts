// Deep composable: render & export pipeline
// Encapsulates SSE stream parsing, progress tracking, ETA, and render lifecycle

import { useTimelineState } from './useTimelineState'
import { parseRenderEvent } from '../utils/renderEventParser'

interface ExportDeps {
  saveTranscript: (isSilent?: boolean) => Promise<void>
}

export const useClipperExport = (deps: ExportDeps) => {
  const API_BASE = 'http://localhost:8000'

  const timeline = useTimelineState()

  // --- Render state (global useState keys) ---
  const renderStatus = useState<string>('renderStatus', () => 'idle')
  const renderProgress = useState<number>('renderProgress', () => 0)
  const renderStage = useState<string>('renderStage', () => '')
  const renderEta = useState<number>('renderEta', () => 0)
  const outputUrl = useState<string | null>('outputUrl', () => null)

  // --- Shared states read from other domains (via matching useState keys) ---
  const jobId = useState<string | null>('jobId', () => null)
  const jobError = useState<string>('jobError', () => '')
  const videoUrl = useState<string | null>('videoUrl', () => null)
  const videoFps = useState<number>('videoFps', () => 30)
  const volume = useState<number>('volume', () => 0.5)
  const fullTranscript = useState<any[]>('fullTranscript', () => [])

  // Subtitle style states (read via shared useState keys)
  const subtitlePosition = useState<string>('subtitlePosition', () => 'center')
  const subtitleOffset = useState<number>('subtitleOffset', () => 50)
  const subtitleSyncOffset = useState<number>('subtitleSyncOffset', () => -500)
  const font = useState<string>('font', () => 'Montserrat')
  const fontSize = useState<number>('fontSize', () => 100)
  const cropMode = useState<string>('cropMode', () => 'manual')
  const cropPercentX = useState<number>('cropPercentX', () => 50)
  const subtitleMode = useState<'word' | '3_words' | '4_words'>('subtitleMode', () => 'word')
  const subtitleAnimation = useState<string>('subtitleAnimation', () => 'pop')
  const subtitleHighlightMode = useState<string>('subtitleHighlightMode', () => 'color')
  const subtitleHighlightColor = useState<string>('subtitleHighlightColor', () => '#CFFF50')
  const subtitleTextColor = useState<string>('subtitleTextColor', () => '#FFFFFF')
  const subtitleStrokeColor = useState<string>('subtitleStrokeColor', () => '#000000')
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth', () => 4)
  const subtitleFontWeight = useState<number>('subtitleFontWeight', () => 900)
  const subtitleTextTransform = useState<string>('subtitleTextTransform', () => 'uppercase')
  const subtitleBackground = useState<string>('subtitleBackground', () => 'none')
  const subtitleBackgroundOpacity = useState<number>('subtitleBackgroundOpacity', () => 0.7)
  const subtitleWordSpacing = useState<number>('subtitleWordSpacing', () => 0)

  // Thumbnail states (read via shared useState keys)
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
  const thumbnailDuration = useState<number>('thumbnailDuration', () => 3)
  const thumbnailTextOverlays = useState<any[]>('thumbnailTextOverlays', () => [])
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)

  // --- Private SSE stream parser ---
  function handleSSEData(data: any) {
    const currentState = {
      progress: renderProgress.value,
      stage: renderStage.value,
      eta: renderEta.value,
      status: renderStatus.value,
      outputUrl: outputUrl.value,
      videoUrl: videoUrl.value,
      jobError: jobError.value
    }
    const nextState = parseRenderEvent(data, currentState, API_BASE)
    
    renderProgress.value = nextState.progress
    renderStage.value = nextState.stage
    renderEta.value = nextState.eta
    renderStatus.value = nextState.status
    outputUrl.value = nextState.outputUrl
    videoUrl.value = nextState.videoUrl
    jobError.value = nextState.jobError
  }

  // --- Private: build render request body ---
  function buildRenderBody(hookIndex: number, outputName?: string) {
    return {
      job_id: jobId.value,
      hook_index: hookIndex,
      subtitle_position: subtitlePosition.value,
      subtitle_offset: subtitleOffset.value,
      font: font.value,
      font_size: fontSize.value,
      face_tracking: cropMode.value === 'face_tracking',
      crop_percent_x: cropPercentX.value,
      subtitle_sync_offset: subtitleSyncOffset.value,
      subtitle_mode: subtitleMode.value,
      timeline_tracks: timeline.timelineTracks.value,
      subtitle_animation: subtitleAnimation.value,
      subtitle_highlight_mode: subtitleHighlightMode.value,
      subtitle_highlight_color: subtitleHighlightColor.value,
      subtitle_text_color: subtitleTextColor.value,
      subtitle_stroke_color: subtitleStrokeColor.value,
      subtitle_stroke_width: subtitleStrokeWidth.value,
      subtitle_font_weight: subtitleFontWeight.value,
      subtitle_text_transform: subtitleTextTransform.value,
      subtitle_background: subtitleBackground.value,
      subtitle_background_opacity: subtitleBackgroundOpacity.value,
      subtitle_word_spacing: subtitleWordSpacing.value,
      volume: volume.value,
      fps: videoFps.value,
      transcript: fullTranscript.value.map((seg: any) => ({
        start: typeof seg.start === 'string' ? parseFloat(seg.start) : seg.start,
        duration: typeof seg.duration === 'string' ? parseFloat(seg.duration) : seg.duration,
        text: seg.text
      })),
      thumbnail_enabled: thumbnailEnabled.value,
      thumbnail_duration: thumbnailDuration.value,
      thumbnail_text_overlays: thumbnailTextOverlays.value,
      thumbnail_x_offset: thumbnailXOffset.value,
      output_name: outputName
    }
  }

  // --- Public: trigger render ---
  async function renderClip(hookIndex = 0, outputName?: string) {
    if (!jobId.value) return
    renderStatus.value = 'rendering'
    renderProgress.value = 0
    renderStage.value = 'starting'
    renderEta.value = 0
    outputUrl.value = null

    try {
      await deps.saveTranscript()

      const body = buildRenderBody(hookIndex, outputName)

      const response = await fetch(`${API_BASE}/api/render-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`Render failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleSSEData(data)
            } catch {}
          }
        }
      }

      if (renderStatus.value === 'rendering') {
        renderStatus.value = 'error'
        jobError.value = 'Render stream ended unexpectedly'
      }
    } catch (e: any) {
      renderStatus.value = 'error'
      jobError.value = e.message || 'Render failed'
      renderProgress.value = 0
      renderStage.value = ''
    }
  }

  return {
    // State
    renderStatus,
    renderProgress,
    renderStage,
    renderEta,
    outputUrl,
    // Actions
    renderClip
  }
}

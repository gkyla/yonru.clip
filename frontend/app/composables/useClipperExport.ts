// Deep composable: render & export pipeline
// Encapsulates SSE stream parsing, progress tracking, ETA, and render lifecycle

import { useTimelineState } from './useTimelineState';
import { useSafetyAuditor } from './useSafetyAuditor';
import { useSubtitleStyle } from './useSubtitleStyle';
import { parseRenderEvent } from '../utils/renderEventParser';

interface ExportDeps {
  saveTranscript: (isSilent?: boolean) => Promise<void>;
  saveStyleSettings: () => Promise<void>;
  saveTimelineTracks: () => Promise<void>;
  saveThumbnailConfig: () => Promise<void>;
}

export const useClipperExport = (deps: ExportDeps) => {
  const API_BASE = resolveApiBase();

  const timeline = useTimelineState();
  const safety = useSafetyAuditor();
  const subtitleStyle = useSubtitleStyle();

  // --- Render state (global useState keys) ---
  const renderStatus = useState<string>('renderStatus', () => 'idle');
  const renderProgress = useState<number>('renderProgress', () => 0);
  const renderStage = useState<string>('renderStage', () => '');
  const renderEta = useState<number>('renderEta', () => 0);
  const outputUrl = useState<string | null>('outputUrl', () => null);
  const renderFrame = useState<number>('renderFrame', () => 0);
  const renderTotalFrames = useState<number>('renderTotalFrames', () => 0);
  const renderStartTime = useState<number | null>(
    'renderStartTime',
    () => null
  );

  // --- Shared states read from other domains (via matching useState keys) ---
  const jobId = useState<string | null>('jobId', () => null);
  const jobError = useState<string>('jobError', () => '');
  const videoUrl = useState<string | null>('videoUrl', () => null);
  const videoFps = useState<number>('videoFps', () => 30);
  const volume = useState<number>('volume', () => 0.5);
  const fullTranscript = useState<any[]>('fullTranscript', () => []);

  // Cover & Thumbnail states (read via shared useState keys)
  const coverEnabled = useState<boolean>('coverEnabled', () => false);
  const coverDuration = useState<number>('coverDuration', () => 1.0);
  const coverTextOverlays = useState<any[]>('coverTextOverlays', () => []);
  const coverXOffset = useState<number>('coverXOffset', () => 50);

  const thumbnailEnabled = useState<boolean>(
    'thumbnailEnabled',
    () => coverEnabled.value
  );
  const thumbnailDuration = useState<number>(
    'thumbnailDuration',
    () => coverDuration.value
  );
  const thumbnailTextOverlays = useState<any[]>(
    'thumbnailTextOverlays',
    () => coverTextOverlays.value
  );
  const thumbnailXOffset = useState<number>(
    'thumbnailXOffset',
    () => coverXOffset.value
  );

  // Safety/Censorship configuration states
  const audioBleepEnabled = useState<boolean>('audioBleepEnabled', () => false);
  const audioBleepSource = useState<'mute' | 'custom'>(
    'audioBleepSource',
    () => 'mute'
  );
  const customBleepFile = useState<{ name: string; data: string } | null>(
    'customBleepFile',
    () => null
  );
  const bleepPaddingOffset = useState<number>('bleepPaddingOffset', () => 0);
  const bleepMode = useState<'full' | 'partial_end'>('bleepMode', () => 'full');
  const safetySensitivity = useState<string>(
    'safetySensitivity',
    () => 'moderate'
  );
  const maskingStyle = useState<string>('maskingStyle', () => 'asterisk');

  // --- Private SSE stream parser ---
  function handleSSEData(data: any) {
    const currentState = {
      progress: renderProgress.value,
      stage: renderStage.value,
      eta: renderEta.value,
      status: renderStatus.value,
      outputUrl: outputUrl.value,
      videoUrl: videoUrl.value,
      jobError: jobError.value,
      frame: renderFrame.value,
      totalFrames: renderTotalFrames.value
    };
    const nextState = parseRenderEvent(data, currentState, API_BASE);

    renderProgress.value = nextState.progress;
    renderStage.value = nextState.stage;
    renderEta.value = nextState.eta;
    renderStatus.value = nextState.status;
    outputUrl.value = nextState.outputUrl;
    videoUrl.value = nextState.videoUrl;
    jobError.value = nextState.jobError;
    if (nextState.frame !== undefined) renderFrame.value = nextState.frame;
    if (nextState.totalFrames !== undefined)
      renderTotalFrames.value = nextState.totalFrames;
  }

  // --- Private: build render request body ---
  function buildRenderBody(hookIndex: number, outputName?: string) {
    return {
      job_id: jobId.value,
      hook_index: hookIndex,
      ...subtitleStyle.toRenderPayload(),
      face_tracking: subtitleStyle.cropMode.value === 'face_tracking',
      crop_percent_x: subtitleStyle.cropPercentX.value,
      split_zoom_top: subtitleStyle.splitZoomTop.value,
      split_zoom_bottom: subtitleStyle.splitZoomBottom.value,
      split_offset_x_top: subtitleStyle.splitOffsetXTop.value,
      split_offset_y_top: subtitleStyle.splitOffsetYTop.value,
      split_offset_x_bottom: subtitleStyle.splitOffsetXBottom.value,
      split_offset_y_bottom: subtitleStyle.splitOffsetYBottom.value,
      timeline_tracks: timeline.timelineTracks.value,
      volume: volume.value,
      fps: videoFps.value,
      transcript: fullTranscript.value.map((seg: any) => ({
        start:
          typeof seg.start === 'string' ? parseFloat(seg.start) : seg.start,
        duration:
          typeof seg.duration === 'string'
            ? parseFloat(seg.duration)
            : seg.duration,
        text: seg.text
      })),
      cover_enabled: coverEnabled.value ?? thumbnailEnabled.value,
      cover_duration: coverDuration.value ?? thumbnailDuration.value,
      cover_text_overlays:
        coverTextOverlays.value?.length > 0
          ? coverTextOverlays.value
          : thumbnailTextOverlays.value,
      cover_x_offset: coverXOffset.value ?? thumbnailXOffset.value,
      thumbnail_enabled: thumbnailEnabled.value,
      thumbnail_duration: thumbnailDuration.value,
      thumbnail_text_overlays: thumbnailTextOverlays.value,
      thumbnail_x_offset: thumbnailXOffset.value,
      audio_bleep_enabled: audioBleepEnabled.value,
      audio_bleep_source: audioBleepSource.value,
      custom_bleep_file: customBleepFile.value
        ? { name: customBleepFile.value.name, data: customBleepFile.value.data }
        : null,
      censored_segments: safety.contentAudit.value?.flaggedSegments || [],
      bleep_padding_offset: bleepPaddingOffset.value,
      bleep_mode: bleepMode.value,
      safety_sensitivity:
        safetySensitivity.value === 'strict'
          ? 'conservative'
          : safetySensitivity.value === 'standard'
            ? 'moderate'
            : 'relaxed',
      masking_style: maskingStyle.value,
      output_name: outputName
    };
  }

  // --- Public: trigger render ---
  async function renderClip(hookIndex = 0, outputName?: string) {
    if (!jobId.value) {
      renderStatus.value = 'error';
      jobError.value =
        'No active job ID found for render. Please reload the clip.';
      return;
    }
    renderStatus.value = 'rendering';
    renderProgress.value = 0;
    renderStage.value = 'starting';
    renderEta.value = 0;
    renderFrame.value = 0;
    renderTotalFrames.value = 0;
    renderStartTime.value = Date.now();
    outputUrl.value = null;

    try {
      await Promise.all([
        deps.saveTranscript(true),
        deps.saveStyleSettings(),
        deps.saveTimelineTracks(),
        deps.saveThumbnailConfig()
      ]);

      const body = buildRenderBody(hookIndex, outputName);

      const response = await fetch(`${API_BASE}/api/render-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Render failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEData(data);
            } catch {}
          }
        }
      }

      if (renderStatus.value === 'rendering') {
        renderStatus.value = 'error';
        jobError.value = 'Render stream ended unexpectedly';
      }
    } catch (e: any) {
      renderStatus.value = 'error';
      jobError.value = e.message || 'Render failed';
      renderProgress.value = 0;
      renderStage.value = '';
    }
  }

  return {
    // State
    renderStatus,
    renderProgress,
    renderStage,
    renderEta,
    outputUrl,
    renderFrame,
    renderTotalFrames,
    renderStartTime,
    // Actions
    renderClip
  };
};

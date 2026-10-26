// Deep composable: render & export pipeline
// Encapsulates SSE stream parsing, progress tracking, ETA, cancellation, and render lifecycle

import type { RenderSpec } from '../types/render';
import { useAppNotifier } from './useAppNotifier';

export const useClipperExport = () => {
  const API_BASE = resolveApiBase();
  const { showToast } = useAppNotifier();

  // --- Render state (global useState keys) ---
  const renderStatus = useState<string>('renderStatus', () => 'idle');
  const renderProgress = useState<number>('renderProgress', () => 0);
  const renderStage = useState<string>('renderStage', () => '');
  const renderEta = useState<number>('renderEta', () => 0);
  const outputUrl = useState<string | null>('outputUrl', () => null);
  const shouldPlayRendered = useState<boolean>(
    'shouldPlayRendered',
    () => false
  );
  const isRenderPreviewActive = computed(() => Boolean(outputUrl.value));
  const renderFrame = useState<number>('renderFrame', () => 0);
  const renderTotalFrames = useState<number>('renderTotalFrames', () => 0);
  const renderStartTime = useState<number | null>(
    'renderStartTime',
    () => null
  );
  const jobError = useState<string>('jobError', () => '');

  // Internal active abort controller for clean cancellation
  let activeAbortController: AbortController | null = null;

  // --- Private: process individual SSE stream events ---
  function processSSEEvent(data: any, apiBase: string) {
    if (!data) return;

    if (data.totalFrames !== undefined) {
      renderTotalFrames.value = data.totalFrames;
    }
    if (data.frame !== undefined) {
      renderFrame.value = data.frame;
    }

    if (data.stage === 'bundling') {
      renderProgress.value = data.percent || 0;
      renderStage.value = 'bundling';
      renderEta.value = 0;
    } else if (data.stage === 'rendering') {
      renderProgress.value = data.percent || 0;
      renderStage.value = 'rendering';
      renderEta.value = data.etaSeconds || 0;
    } else if (data.stage === 'encoding') {
      renderStage.value = 'encoding';
      renderProgress.value = data.percent || 96;
      renderEta.value = 0;
    } else if (data.stage === 'starting') {
      renderStage.value = 'starting';
      renderProgress.value = 0;
      renderFrame.value = 0;
    } else if (data.stage === 'done') {
      renderStatus.value = 'done';
      renderProgress.value = 100;
      renderStage.value = '';
      renderEta.value = 0;
      outputUrl.value = `${apiBase}${data.outputUrl || ''}`;
      if (renderTotalFrames.value) {
        renderFrame.value = renderTotalFrames.value;
      }
    } else if (data.stage === 'error') {
      renderStatus.value = 'error';
      jobError.value = data.message || 'Render failed';
      renderProgress.value = 0;
      renderStage.value = '';
      renderEta.value = 0;
    }
  }

  // --- Private: map pure RenderSpec into backend /api/render-stream payload ---
  function formatRenderBody(spec: RenderSpec) {
    const transcript = (spec.transcript || []).map((seg: any) => ({
      start: typeof seg.start === 'string' ? parseFloat(seg.start) : seg.start,
      duration:
        typeof seg.duration === 'string'
          ? parseFloat(seg.duration)
          : seg.duration,
      text: seg.text
    }));

    const sensitivity =
      spec.safety?.safetySensitivity === 'strict'
        ? 'conservative'
        : spec.safety?.safetySensitivity === 'standard'
          ? 'moderate'
          : spec.safety?.safetySensitivity || 'moderate';

    return {
      job_id: spec.jobId,
      hook_index: spec.hookIndex ?? 0,
      output_name: spec.outputName,
      fps: spec.fps ?? 30,
      volume: spec.volume ?? 0.5,
      video_layout: spec.videoLayout ?? 'vertical',
      landscape_background: spec.landscapeBackground ?? 'black',
      landscape_blur_radius: spec.landscapeBlurRadius ?? 25,
      landscape_darkness: spec.landscapeDarkness ?? 35,
      face_tracking: spec.cropMode === 'face_tracking',
      crop_percent_x: spec.cropPercentX ?? 50,
      split_zoom_top: spec.splitZoomTop ?? 1.0,
      split_zoom_bottom: spec.splitZoomBottom ?? 1.0,
      split_offset_x_top: spec.splitOffsetXTop ?? 0.0,
      split_offset_y_top: spec.splitOffsetYTop ?? 0.0,
      split_offset_x_bottom: spec.splitOffsetXBottom ?? 0.0,
      split_offset_y_bottom: spec.splitOffsetYBottom ?? 0.0,
      timeline_tracks: spec.timelineTracks ?? [],
      transcript,
      ...(spec.subtitlePayload || {}),
      // Cover slide
      cover_enabled: spec.cover?.enabled ?? false,
      cover_duration: spec.cover?.duration ?? 1.0,
      cover_text_overlays: spec.cover?.textOverlays ?? [],
      cover_x_offset: spec.cover?.xOffset ?? 50,
      // Backward-compatible Thumbnail fields
      thumbnail_enabled: spec.cover?.enabled ?? false,
      thumbnail_duration: spec.cover?.duration ?? 1.0,
      thumbnail_text_overlays: spec.cover?.textOverlays ?? [],
      thumbnail_x_offset: spec.cover?.xOffset ?? 50,
      // Censorship safety
      audio_bleep_enabled: spec.safety?.audioBleepEnabled ?? false,
      audio_bleep_source: spec.safety?.audioBleepSource ?? 'mute',
      custom_bleep_file: spec.safety?.customBleepFile ?? null,
      censored_segments: spec.safety?.censoredSegments ?? [],
      bleep_padding_offset: spec.safety?.bleepPaddingOffset ?? 0,
      bleep_mode: spec.safety?.bleepMode ?? 'full',
      safety_sensitivity: sensitivity,
      masking_style: spec.safety?.maskingStyle ?? 'asterisk'
    };
  }

  // --- Public: trigger render stream with explicit RenderSpec ---
  async function exportClip(spec: RenderSpec): Promise<void> {
    if (!spec || !spec.jobId) {
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
    jobError.value = '';

    activeAbortController = new AbortController();

    try {
      const body = formatRenderBody(spec);

      const response = await fetch(`${API_BASE}/api/render-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: activeAbortController.signal
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
              processSSEEvent(data, API_BASE);
            } catch {}
          }
        }
      }

      if (renderStatus.value === 'rendering') {
        renderStatus.value = 'error';
        jobError.value = 'Render stream ended unexpectedly';
      }
    } catch (e: any) {
      if (e?.name === 'AbortError' || activeAbortController?.signal.aborted) {
        renderStatus.value = 'cancelled';
        renderProgress.value = 0;
        renderStage.value = '';
        return;
      }
      renderStatus.value = 'error';
      jobError.value = e.message || 'Render failed';
      renderProgress.value = 0;
      renderStage.value = '';
    } finally {
      activeAbortController = null;
    }
  }

  // --- Public: cancel an active render stream ---
  function cancelRender() {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    renderStatus.value = 'cancelled';
  }

  // --- Public: safely reveal rendered video in OS file manager ---
  async function openRenderFolder(targetUrl?: string | null): Promise<boolean> {
    const url = targetUrl || outputUrl.value || '';
    try {
      const res = await $fetch<{ status: string; message?: string }>(
        '/api/open-folder',
        {
          baseURL: API_BASE,
          method: 'POST',
          body: { output_url: url }
        }
      );
      if (res.status === 'ok') {
        showToast('Opened folder in file manager', 'success');
        return true;
      }
      showToast(res.message || 'Could not open folder', 'error');
      return false;
    } catch (err: any) {
      const msg =
        err?.data?.detail ||
        err?.message ||
        'Failed to open file manager on host';
      showToast(msg, 'error');
      return false;
    }
  }

  return {
    // State
    renderStatus,
    renderProgress,
    renderStage,
    renderEta,
    outputUrl,
    isRenderPreviewActive,
    shouldPlayRendered,
    renderFrame,
    renderTotalFrames,
    renderStartTime,
    jobError,
    // Actions
    exportClip,
    renderClip: exportClip,
    cancelRender,
    openRenderFolder,
    formatRenderBody
  };
};

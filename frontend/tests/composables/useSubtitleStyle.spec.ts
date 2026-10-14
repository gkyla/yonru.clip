// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSubtitleStyle } from '../../app/composables/useSubtitleStyle';

describe('useSubtitleStyle Composable - Persistence & HTTP Semantics', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
    vi.stubGlobal('$fetch', mockFetch);
  });

  it('calls PUT /api/style-settings when saving clip style settings', async () => {
    const subtitleStyle = useSubtitleStyle();
    await subtitleStyle.saveStyleSettings('test_folder', 'test_clip_1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/style-settings'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({
          folder_name: 'test_folder',
          clip_id: 'test_clip_1'
        })
      })
    );
  });

  it('calls PUT /api/default-style-settings when saving default style settings', async () => {
    const subtitleStyle = useSubtitleStyle();
    await subtitleStyle.saveDefaultStyleSettings();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/default-style-settings'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({
          settings: expect.any(Object)
        })
      })
    );
  });

  it('preserves non-typographic settings (layout, pacing, position) when applyPreset is called', () => {
    const subtitleStyle = useSubtitleStyle();

    // Set custom non-typographic settings
    subtitleStyle.videoLayout.value = 'landscape';
    subtitleStyle.landscapeBackground.value = 'blur';
    subtitleStyle.subtitlePosition.value = 'top';
    subtitleStyle.subtitleOffset.value = 85;
    subtitleStyle.subtitleSyncOffset.value = 220;
    subtitleStyle.subtitleMode.value = '3_words';

    // Apply preset
    subtitleStyle.applyPreset('clean-vlog');

    // Typographic fields updated to clean-vlog
    expect(subtitleStyle.subtitlePreset.value).toBe('clean-vlog');
    expect(subtitleStyle.font.value).toBe('Outfit');

    // Non-typographic fields strictly preserved
    expect(subtitleStyle.videoLayout.value).toBe('landscape');
    expect(subtitleStyle.landscapeBackground.value).toBe('blur');
    expect(subtitleStyle.subtitlePosition.value).toBe('top');
    expect(subtitleStyle.subtitleOffset.value).toBe(85);
    expect(subtitleStyle.subtitleSyncOffset.value).toBe(220);
    expect(subtitleStyle.subtitleMode.value).toBe('3_words');
  });

  it('derives getOuterStrokeShadow correctly from reactive properties', () => {
    const subtitleStyle = useSubtitleStyle();

    subtitleStyle.subtitleStrokeWidth.value = 0;
    expect(subtitleStyle.getOuterStrokeShadow()).toBe(
      '0 1px 3px rgba(0,0,0,0.8)'
    );

    subtitleStyle.subtitleStrokeWidth.value = 4;
    subtitleStyle.subtitleStrokeColor.value = '#00FF00';
    const shadow = subtitleStyle.getOuterStrokeShadow();
    expect(shadow).toContain('#00FF00');
    expect(shadow).toContain('-1.8px -1.8px 0 #00FF00');
  });
});

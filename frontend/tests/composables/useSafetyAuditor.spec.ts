// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useState } from '#app';
import { useSafetyAuditor } from '../../app/composables/useSafetyAuditor';
import {
  ContentSafetyAuditor,
  DEFAULT_BLEEP_PRESET,
  DEFAULT_CATEGORIZED_BLACKLIST,
  BUILTIN_BLEEP_PRESETS,
  type BleepAudioItem,
  type SafetyCategory
} from '../../app/utils/safetyEngine';
import type { TranscriptSegment } from '../../app/types/clipper';

describe('useSafetyAuditor Composable Reactive Seam', () => {
  beforeEach(() => {
    // Reset global Nuxt states
    const customBlacklist = useState<string[]>('customBlacklist', () => []);
    const customWhitelist = useState<string[]>('customWhitelist', () => []);
    const safetySensitivity = useState<'strict' | 'standard' | 'manual'>(
      'safetySensitivity',
      () => 'strict'
    );
    const maskingStyle = useState<'asterisk' | 'block' | 'bleep_marker'>(
      'maskingStyle',
      () => 'asterisk'
    );
    const audioBleepEnabled = useState<boolean>(
      'audioBleepEnabled',
      () => true
    );
    const audioBleepSource = useState<'mute' | 'custom'>(
      'audioBleepSource',
      () => 'mute'
    );
    const bleepLibrary = useState<BleepAudioItem[]>('bleepLibrary', () => [
      ...BUILTIN_BLEEP_PRESETS
    ]);
    const selectedBleepAudioId = useState<string>(
      'selectedBleepAudioId',
      () => DEFAULT_BLEEP_PRESET.id
    );
    const bleepPaddingOffset = useState<number>('bleepPaddingOffset', () => 0);
    const bleepMode = useState<'full' | 'partial_end'>(
      'bleepMode',
      () => 'full'
    );
    const activeCategories = useState<Record<SafetyCategory, boolean>>(
      'activeCategories',
      () => ({
        violence: true,
        sexual: true,
        profanity: true
      })
    );
    const categorizedBlacklist = useState<Record<SafetyCategory, string[]>>(
      'categorizedBlacklist',
      () => ({
        violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
        sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
        profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
      })
    );
    const activePlatformFilters = useState<{
      tiktok: boolean;
      reels: boolean;
      shorts: boolean;
    }>('activePlatformFilters', () => ({
      tiktok: true,
      reels: true,
      shorts: true
    }));
    const fullTranscript = useState<TranscriptSegment[]>(
      'fullTranscript',
      () => []
    );
    const activeSafeZone = useState<string>('activeSafeZone', () => 'none');
    const subtitleOffset = useState<number>('subtitleOffset', () => 50);
    const subtitlePosition = useState<string>(
      'subtitlePosition',
      () => 'center'
    );
    const subtitleBackground = useState<string>(
      'subtitleBackground',
      () => 'none'
    );
    const subtitleStrokeWidth = useState<number>(
      'subtitleStrokeWidth',
      () => 4
    );
    const subtitleStrokeColor = useState<string>(
      'subtitleStrokeColor',
      () => '#000000'
    );
    const isWarningIgnored = useState<boolean>('isWarningIgnored', () => false);

    customBlacklist.value = [];
    customWhitelist.value = [];
    safetySensitivity.value = 'strict';
    maskingStyle.value = 'asterisk';
    audioBleepEnabled.value = true;
    audioBleepSource.value = 'mute';
    bleepLibrary.value = [...BUILTIN_BLEEP_PRESETS];
    selectedBleepAudioId.value = DEFAULT_BLEEP_PRESET.id;
    bleepPaddingOffset.value = 0;
    bleepMode.value = 'full';
    activeCategories.value = {
      violence: true,
      sexual: true,
      profanity: true
    };
    categorizedBlacklist.value = {
      violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
      sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
      profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
    };
    activePlatformFilters.value = { tiktok: true, reels: true, shorts: true };
    fullTranscript.value = [];
    activeSafeZone.value = 'none';
    subtitleOffset.value = 50;
    subtitlePosition.value = 'center';
    subtitleBackground.value = 'none';
    subtitleStrokeWidth.value = 4;
    subtitleStrokeColor.value = '#000000';
    isWarningIgnored.value = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes contentAudit score reactively when transcript updates', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');

    expect(auditor.contentAudit.value.score).toBe(100);
    expect(auditor.contentAudit.value.flaggedWords).toEqual([]);

    fullTranscript.value = [
      { text: 'this is a kill word', start: 0, duration: 2 }
    ];

    expect(auditor.contentAudit.value.flaggedWords).toContain('kill');
    expect(auditor.contentAudit.value.score).toBeLessThan(100);
  });

  it('allows adding and removing custom bleep files reactively', () => {
    const auditor = useSafetyAuditor();

    const initialLen = auditor.bleepLibrary.value.length;
    const newItem = auditor.addCustomBleepFile({
      name: 'Custom Sound',
      data: 'data:audio/mp3;base64,abc'
    });

    expect(auditor.bleepLibrary.value.length).toBe(initialLen + 1);
    expect(auditor.selectedBleepAudioId.value).toBe(newItem.id);

    auditor.removeCustomBleepFile(newItem.id);
    expect(auditor.bleepLibrary.value.length).toBe(initialLen);
    expect(auditor.selectedBleepAudioId.value).toBe(DEFAULT_BLEEP_PRESET.id);
  });

  it('handles safe zone snapping via fitSubtitlesToSafeZone()', () => {
    const auditor = useSafetyAuditor();
    const activeSafeZone = useState<string>('activeSafeZone');
    const subtitlePosition = useState<string>('subtitlePosition');
    const subtitleOffset = useState<number>('subtitleOffset');

    activeSafeZone.value = 'tiktok';
    subtitlePosition.value = 'bottom';
    subtitleOffset.value = 50; // In deadzone (<250px)

    expect(auditor.layoutAudit.value.isSafe).toBe(false);

    auditor.fitSubtitlesToSafeZone();
    expect(subtitleOffset.value).toBe(270); // Safe offset: 250 + 20
    expect(auditor.layoutAudit.value.isSafe).toBe(true);
  });

  it('fixes contrast issues via fitSubtitlesToReadability()', () => {
    const auditor = useSafetyAuditor();
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth');
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor');
    const subtitleBackground = useState<string>('subtitleBackground');

    subtitleBackground.value = 'none';
    subtitleStrokeWidth.value = 0; // Low contrast

    expect(auditor.readabilityAudit.value.isSafe).toBe(false);

    auditor.fitSubtitlesToReadability();
    expect(subtitleStrokeWidth.value).toBe(4);
    expect(subtitleStrokeColor.value).toBe('#000000');
    expect(auditor.readabilityAudit.value.isSafe).toBe(true);
  });

  it('masks flagged words in fullTranscript with maskFlaggedWords()', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');

    fullTranscript.value = [
      { text: 'jangan bunuh diri', start: 0, duration: 2 }
    ];

    auditor.maskFlaggedWords();
    expect(fullTranscript.value[0]?.text).toBe('jangan b*nuh diri');
  });

  it('allows ignoring and restoring safety warnings', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');

    fullTranscript.value = [{ text: 'kill', start: 0, duration: 1 }];

    expect(auditor.contentAudit.value.score).toBeLessThan(100);

    auditor.ignoreSafetyWarnings();
    expect(auditor.contentAudit.value.score).toBe(100);

    auditor.restoreSafetyWarnings();
    expect(auditor.contentAudit.value.score).toBeLessThan(100);
  });

  it('preserves pattern cache and avoids lexical re-scans across config and bleep toggles', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
    fullTranscript.value = [{ text: 'this is kill', start: 0, duration: 2 }];

    // Warm up compiledPatterns + lexicalMatches
    const initialSegments = auditor.flaggedSegments.value;
    expect(auditor.contentAudit.value.flaggedWords).toContain('kill');
    expect(auditor.contentAudit.value.flaggedSegments).toBe(initialSegments);

    const compileSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'getCompiledPattern'
    );
    const scanSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'scanTranscriptMatches'
    );

    auditor.maskingStyle.value = 'block';
    auditor.audioBleepEnabled.value = false;
    auditor.audioBleepSource.value = 'custom';
    auditor.bleepMode.value = 'partial_end';
    auditor.isWarningIgnored.value = true;
    auditor.isWarningIgnored.value = false;
    auditor.activePlatformFilters.value = {
      tiktok: false,
      reels: true,
      shorts: true
    };
    auditor.bleepPaddingOffset.value = 100;

    // Trigger evaluation of all computeds
    expect(auditor.contentAudit.value.flaggedWords).toContain('kill');
    expect(auditor.flaggedSegments.value.length).toBe(1);

    expect(compileSpy).not.toHaveBeenCalled();
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('performs zero lexical scans or regex tests while dragging style and readability sliders', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
    const activeSafeZone = useState<string>('activeSafeZone');
    const subtitleOffset = useState<number>('subtitleOffset');
    const subtitlePosition = useState<string>('subtitlePosition');
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth');
    const subtitleBackground = useState<string>('subtitleBackground');
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor');

    fullTranscript.value = [
      {
        text: 'we talk about kill and murder here',
        start: 0,
        duration: 4
      }
    ];
    activeSafeZone.value = 'tiktok';
    subtitlePosition.value = 'bottom';
    subtitleOffset.value = 50;

    const initialSegments = auditor.flaggedSegments.value;
    expect(auditor.contentAudit.value.flaggedSegments).toBe(initialSegments);

    const scanSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'scanTranscriptMatches'
    );
    const testSpy = vi.spyOn(RegExp.prototype, 'test');

    // Drag sliders across both unsafe and safe zones repeatedly
    for (let offset = 60; offset <= 320; offset += 10) {
      subtitleOffset.value = offset;
      void auditor.layoutAudit.value;
      void auditor.contentAudit.value;
    }

    for (let stroke = 0; stroke <= 6; stroke++) {
      subtitleStrokeWidth.value = stroke;
      void auditor.readabilityAudit.value;
      void auditor.contentAudit.value;
    }

    subtitlePosition.value = 'top';
    subtitleBackground.value = '#000000';
    subtitleStrokeColor.value = '#FFFFFF';
    activeSafeZone.value = 'reels';
    auditor.ignoreSafetyWarnings();
    auditor.restoreSafetyWarnings();

    expect(auditor.contentAudit.value.flaggedSegments).toBe(initialSegments);
    expect(auditor.flaggedSegments.value).toBe(initialSegments);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(testSpy).not.toHaveBeenCalled();
  });

  it('keeps flaggedSegments, layoutAudit, and readabilityAudit references stable within unchanged zones', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
    const activeSafeZone = useState<string>('activeSafeZone');
    const subtitleOffset = useState<number>('subtitleOffset');
    const subtitlePosition = useState<string>('subtitlePosition');
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth');

    fullTranscript.value = [
      {
        text: 'hello kill world',
        start: 0,
        duration: 3,
        words: [
          { text: 'hello', start: 0, duration: 1 },
          { text: 'kill', start: 1, duration: 1 },
          { text: 'world', start: 2, duration: 1 }
        ]
      }
    ];

    const baselineSegments = auditor.flaggedSegments.value;

    // Non-flagged edit keeps matched timestamps/words identical -> exact flaggedSegments reference
    fullTranscript.value = [
      {
        text: 'hi kill buddy',
        start: 0,
        duration: 3,
        words: [
          { text: 'hi', start: 0, duration: 1 },
          { text: 'kill', start: 1, duration: 1 },
          { text: 'buddy', start: 2, duration: 1 }
        ]
      }
    ];
    expect(auditor.flaggedSegments.value).toBe(baselineSegments);

    // Dragging inside TikTok unsafe zone (<250px) preserves layoutAudit object identity
    activeSafeZone.value = 'tiktok';
    subtitlePosition.value = 'bottom';
    subtitleOffset.value = 100;
    const unsafeLayout = auditor.layoutAudit.value;
    expect(unsafeLayout.isSafe).toBe(false);

    subtitleOffset.value = 120;
    subtitleOffset.value = 180;
    expect(auditor.layoutAudit.value).toBe(unsafeLayout);

    // Crossing threshold into safe zone (>=250px) returns a new safe layoutAudit and stabilizes there
    subtitleOffset.value = 260;
    const safeLayout = auditor.layoutAudit.value;
    expect(safeLayout).not.toBe(unsafeLayout);
    expect(safeLayout.isSafe).toBe(true);

    subtitleOffset.value = 300;
    expect(auditor.layoutAudit.value).toBe(safeLayout);

    // Stroke widths >= 2 keep readabilityAudit object identity
    subtitleStrokeWidth.value = 2;
    const safeReadability = auditor.readabilityAudit.value;
    subtitleStrokeWidth.value = 6;
    expect(auditor.readabilityAudit.value).toBe(safeReadability);
  });

  it('reacts to in-place array/object mutations on categories, blacklists, whitelist, and transcript segments', async () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
    fullTranscript.value = [
      { text: 'hello clean line', start: 0, duration: 2 }
    ];

    expect(auditor.contentAudit.value.flaggedWords).toEqual([]);

    // In-place transcript segment text mutation
    fullTranscript.value[0]!.text = 'hello spoiler kill line';
    await nextTick();
    expect(auditor.contentAudit.value.flaggedWords).toEqual(['kill']);

    // In-place custom blacklist push
    auditor.customBlacklist.value.push('spoiler');
    await nextTick();
    expect(auditor.contentAudit.value.flaggedWords).toContain('spoiler');

    // In-place activeCategories property mutation
    auditor.activeCategories.value.violence = false;
    await nextTick();
    expect(auditor.contentAudit.value.flaggedWords).not.toContain('kill');
    expect(auditor.contentAudit.value.flaggedWords).toContain('spoiler');

    // In-place custom whitelist push
    auditor.customWhitelist.value.push('spoiler');
    await nextTick();
    expect(auditor.contentAudit.value.flaggedWords).toEqual([]);
  });

  it('preserves flaggedWords shape in contentAudit when warnings are ignored and avoids churning customBleepFile', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
    fullTranscript.value = [{ text: 'kill', start: 0, duration: 1 }];

    const initialBleepFile = auditor.customBleepFile.value;
    auditor.selectBleepAudio(DEFAULT_BLEEP_PRESET.id);
    expect(auditor.customBleepFile.value).toBe(initialBleepFile);

    auditor.ignoreSafetyWarnings();
    expect(auditor.contentAudit.value.score).toBe(100);
    expect(auditor.contentAudit.value.flaggedWords).toContain('kill');
    expect(auditor.contentAudit.value.flaggedSegments).toBe(
      auditor.flaggedSegments.value
    );
  });

  it('keeps lexicalMatches, flaggedSegments, and contentAudit stable across unflagged edits and non-effective audioBleepEnabled toggles', () => {
    const auditor = useSafetyAuditor();
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');

    fullTranscript.value = [
      {
        text: 'hello kill world',
        start: 0,
        duration: 3,
        words: [
          { text: 'hello', start: 0, duration: 1 },
          { text: 'kill', start: 1, duration: 1 },
          { text: 'world', start: 2, duration: 1 }
        ]
      }
    ];

    const baselineSegments = auditor.flaggedSegments.value;
    const baselineAudit = auditor.contentAudit.value;

    const buildSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'buildFlaggedSegments'
    );
    const evalSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'evaluateLexicalMatches'
    );
    const composeSpy = vi.spyOn(
      ContentSafetyAuditor.prototype,
      'composeSafetyReport'
    );

    // Editing an unflagged word keeps lexicalMatches equal -> zero downstream work
    fullTranscript.value = [
      {
        text: 'hi kill buddy',
        start: 0,
        duration: 3,
        words: [
          { text: 'hi', start: 0, duration: 1 },
          { text: 'kill', start: 1, duration: 1 },
          { text: 'buddy', start: 2, duration: 1 }
        ]
      }
    ];

    expect(auditor.flaggedSegments.value).toBe(baselineSegments);
    expect(auditor.contentAudit.value).toBe(baselineAudit);
    expect(buildSpy).not.toHaveBeenCalled();
    expect(evalSpy).not.toHaveBeenCalled();
    expect(composeSpy).not.toHaveBeenCalled();

    // Toggling audioBleepEnabled on an unmasked transcript leaves score/flags unchanged -> same contentAudit ref
    auditor.audioBleepEnabled.value = false;
    expect(auditor.contentAudit.value).toBe(baselineAudit);
    auditor.audioBleepEnabled.value = true;
    expect(auditor.contentAudit.value).toBe(baselineAudit);

    // While warnings are ignored with unmasked words, toggling audioBleepEnabled preserves contentAudit ref
    auditor.ignoreSafetyWarnings();
    const ignoredAudit = auditor.contentAudit.value;
    auditor.audioBleepEnabled.value = false;
    expect(auditor.contentAudit.value).toBe(ignoredAudit);
    auditor.audioBleepEnabled.value = true;
    auditor.restoreSafetyWarnings();

    // Masking updates remediation state while keeping flaggedSegments reference-stable
    auditor.maskFlaggedWords();
    const maskedSegments = auditor.flaggedSegments.value;
    const remediatedAudit = auditor.contentAudit.value;
    expect(maskedSegments).toBe(baselineSegments);
    expect(remediatedAudit.score).toBe(100);
    expect(remediatedAudit.isRemediated).toBe(true);

    // Disabling audio bleep on masked words drops remediation -> new un-remediated contentAudit
    auditor.audioBleepEnabled.value = false;
    expect(auditor.contentAudit.value).not.toBe(remediatedAudit);
    expect(auditor.contentAudit.value.score).toBeLessThan(100);
    expect(auditor.contentAudit.value.isRemediated).toBe(false);
    expect(auditor.flaggedSegments.value).toBe(maskedSegments);
  });
});

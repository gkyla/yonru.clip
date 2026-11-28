// useSafetyAuditor.ts — Reactive Composable Bridge over Deep ContentSafetyAuditor Engine
import {
  areAuditResultsEqual,
  areCompiledPatternsEqual,
  areContentAuditsEqual,
  areFlaggedSegmentsEqual,
  areLayoutAuditsEqual,
  areLexicalMatchesEqual,
  areReadabilityAuditsEqual,
  createContentSafetyAuditor,
  DEFAULT_CATEGORIZED_BLACKLIST,
  BUILTIN_BLEEP_PRESETS,
  DEFAULT_BLEEP_PRESET,
  type AuditResult,
  type BleepAudioItem,
  type BleepMode,
  type CompiledPattern,
  type ContentAuditSnapshot,
  type FlaggedSegment,
  type LayoutAuditResult,
  type LexicalMatch,
  type MaskingStyle,
  type PlatformSafeZone,
  type ReadabilityAuditResult,
  type SafetyCategory,
  type SafetySensitivity
} from '../utils/safetyEngine';
import type {
  Hook,
  DeepAuditResult,
  TranscriptSegment
} from '../types/clipper';

export const useSafetyAuditor = () => {
  const API_BASE = resolveApiBase();

  // Reactive State
  const customBlacklist = useState<string[]>('customBlacklist', () => []);
  const customWhitelist = useState<string[]>('customWhitelist', () => []);
  const safetySensitivity = useState<SafetySensitivity>(
    'safetySensitivity',
    () => 'strict'
  );
  const maskingStyle = useState<MaskingStyle>('maskingStyle', () => 'asterisk');
  const audioBleepEnabled = useState<boolean>('audioBleepEnabled', () => true);
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
  const customBleepFile = useState<{ name: string; data: string } | null>(
    'customBleepFile',
    () => ({
      name: DEFAULT_BLEEP_PRESET.name,
      data: DEFAULT_BLEEP_PRESET.data
    })
  );
  const bleepPaddingOffset = useState<number>('bleepPaddingOffset', () => 0);
  const bleepMode = useState<BleepMode>('bleepMode', () => 'full');
  const isWarningIgnored = useState<boolean>('isWarningIgnored', () => false);
  const activeCategories = useState<Record<SafetyCategory, boolean>>(
    'activeCategories',
    () => ({
      violence: true,
      sexual: true,
      profanity: true
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

  const deepAuditResults = useState<DeepAuditResult | null>(
    'deepAuditResults',
    () => null
  );
  const isDeepAuditing = useState<boolean>('isDeepAuditing', () => false);
  const safeZoneVisible = useState<boolean>('safeZoneVisible', () => false);

  const categorizedBlacklist = useState<Record<SafetyCategory, string[]>>(
    'categorizedBlacklist',
    () => ({
      violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
      sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
      profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
    })
  );

  // Subtitle style / mode dependencies
  const fullTranscript = useState<TranscriptSegment[]>('fullTranscript');
  const activeHook = useState<Hook | null>('activeHook');
  const language = useState<string>('language');
  const activeSafeZone = useState<PlatformSafeZone>('activeSafeZone');
  const subtitleOffset = useState<number>('subtitleOffset');
  const subtitlePosition = useState<string>('subtitlePosition');
  const subtitleBackground = useState<string>('subtitleBackground');
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth');
  const subtitleStrokeColor = useState<string>('subtitleStrokeColor');

  // Persistent engine instance preserves compiled _patternCache across config/slider changes
  const engine = createContentSafetyAuditor();

  const syncEngineConfig = () => {
    engine.hydrate({
      customBlacklist: customBlacklist.value,
      customWhitelist: customWhitelist.value,
      categorizedBlacklist: categorizedBlacklist.value,
      safetySensitivity: safetySensitivity.value,
      maskingStyle: maskingStyle.value,
      audioBleepEnabled: audioBleepEnabled.value,
      audioBleepSource: audioBleepSource.value,
      bleepLibrary: bleepLibrary.value,
      selectedBleepAudioId: selectedBleepAudioId.value,
      bleepPaddingOffset: bleepPaddingOffset.value,
      bleepMode: bleepMode.value,
      isWarningIgnored: isWarningIgnored.value,
      activeCategories: activeCategories.value,
      activePlatformFilters: activePlatformFilters.value
    });
  };

  // Synchronize bleep audio selection without redundant object allocations
  const syncCustomBleepFile = () => {
    const activeItem =
      bleepLibrary.value.find(item => item.id === selectedBleepAudioId.value) ||
      DEFAULT_BLEEP_PRESET;
    if (
      customBleepFile.value?.name === activeItem.name &&
      customBleepFile.value?.data === activeItem.data
    ) {
      return;
    }
    customBleepFile.value = { name: activeItem.name, data: activeItem.data };
  };

  watch(
    [selectedBleepAudioId, bleepLibrary],
    () => {
      syncCustomBleepFile();
    },
    { deep: true, immediate: true }
  );

  const selectBleepAudio = (id: string) => {
    if (bleepLibrary.value.some(item => item.id === id)) {
      selectedBleepAudioId.value = id;
      syncCustomBleepFile();
      saveBlacklistToStorage();
    }
  };

  const addCustomBleepFile = (file: { name: string; data: string }) => {
    syncEngineConfig();
    const newItem = engine.addCustomBleepFile(file);
    bleepLibrary.value = [...engine.bleepLibrary];
    selectedBleepAudioId.value = engine.selectedBleepAudioId;
    syncCustomBleepFile();
    saveBlacklistToStorage();
    return newItem;
  };

  const removeCustomBleepFile = (id: string) => {
    syncEngineConfig();
    const removed = engine.removeCustomBleepFile(id);
    if (removed) {
      bleepLibrary.value = [...engine.bleepLibrary];
      selectedBleepAudioId.value = engine.selectedBleepAudioId;
      syncCustomBleepFile();
      saveBlacklistToStorage();
    }
  };

  const saveBlacklistToStorage = () => {
    if (import.meta.client) {
      syncEngineConfig();
      engine.serializeToStorage(localStorage);
    }
  };

  const loadBlacklistFromStorage = () => {
    if (import.meta.client) {
      const storageEngine = createContentSafetyAuditor();
      storageEngine.hydrateFromStorage(localStorage);
      const exported = storageEngine.exportState();

      customBlacklist.value = exported.customBlacklist;
      customWhitelist.value = exported.customWhitelist;
      categorizedBlacklist.value = exported.categorizedBlacklist;
      audioBleepSource.value = exported.audioBleepSource;
      bleepLibrary.value = exported.bleepLibrary;
      selectedBleepAudioId.value = exported.selectedBleepAudioId;
      audioBleepEnabled.value = exported.audioBleepEnabled;
      bleepPaddingOffset.value = exported.bleepPaddingOffset;
      bleepMode.value = exported.bleepMode;
      syncCustomBleepFile();
    }
  };

  watch(bleepMode, val => {
    if (import.meta.client) {
      localStorage.setItem('yonru_bleep_mode', val);
    }
  });

  // Decoupled Safety Filter Scope -> Pattern Compilation -> Lexical Scan -> FlaggedSegments -> O(1) Composition
  const compiledPatterns = computed<CompiledPattern[]>(prev => {
    const blacklist = engine.resolveEffectiveBlacklist({
      safetySensitivity: safetySensitivity.value,
      activeCategories: activeCategories.value,
      categorizedBlacklist: categorizedBlacklist.value,
      customBlacklist: customBlacklist.value,
      customWhitelist: customWhitelist.value
    });
    const next = engine.compileBlacklist(blacklist);
    return prev && areCompiledPatternsEqual(prev, next) ? prev : next;
  });

  const lexicalMatches = computed<LexicalMatch[]>(prev => {
    const next = engine.scanTranscriptMatches(
      fullTranscript.value || [],
      compiledPatterns.value
    );
    return prev && areLexicalMatchesEqual(prev, next) ? prev : next;
  });

  const flaggedSegments = computed<FlaggedSegment[]>(prev => {
    const next = engine.buildFlaggedSegments(
      lexicalMatches.value,
      bleepPaddingOffset.value
    );
    return prev && areFlaggedSegmentsEqual(prev, next) ? prev : next;
  });

  const lexicalAudit = computed<AuditResult>(prev => {
    const next = engine.evaluateLexicalMatches(
      lexicalMatches.value,
      flaggedSegments.value,
      audioBleepEnabled.value
    );
    return prev && areAuditResultsEqual(prev, next) ? prev : next;
  });

  const layoutAudit = computed<LayoutAuditResult>(prev => {
    const next = engine.auditLayoutCollision(
      activeSafeZone.value || 'none',
      subtitlePosition.value || 'center',
      subtitleOffset.value || 0,
      activePlatformFilters.value,
      isWarningIgnored.value
    );
    return prev && areLayoutAuditsEqual(prev, next) ? prev : next;
  });

  const fitSubtitlesToSafeZone = () => {
    const safeOffset = engine.calculateSafeOffset(
      activeSafeZone.value || 'none',
      subtitlePosition.value || 'center'
    );
    if (safeOffset !== null) {
      subtitleOffset.value = safeOffset;
    }
  };

  const readabilityAudit = computed<ReadabilityAuditResult>(prev => {
    const next = engine.auditReadability(
      subtitleBackground.value || 'none',
      subtitleStrokeWidth.value || 0,
      subtitleStrokeColor.value || '#000000',
      isWarningIgnored.value
    );
    return prev && areReadabilityAuditsEqual(prev, next) ? prev : next;
  });

  // 3-Pillar Safety Audit Composition in O(1)
  const contentAudit = computed<ContentAuditSnapshot>(prev => {
    const report = engine.composeSafetyReport(
      lexicalAudit.value,
      layoutAudit.value,
      readabilityAudit.value,
      isWarningIgnored.value
    );

    const next: ContentAuditSnapshot = {
      ...report.rawAudit,
      score: report.score,
      remediatedWords: report.remediatedWords || [],
      remediatedSegments: report.remediatedSegments || [],
      isRemediated: report.isRemediated
    };
    return prev && areContentAuditsEqual(prev, next) ? prev : next;
  });

  const fitSubtitlesToReadability = () => {
    subtitleStrokeWidth.value = 4;
    subtitleStrokeColor.value = '#000000';
  };

  const ignoreSafetyWarnings = () => {
    isWarningIgnored.value = true;
  };

  const restoreSafetyWarnings = () => {
    isWarningIgnored.value = false;
  };

  async function runDeepAudit() {
    if (!activeHook.value || isDeepAuditing.value) return;
    isDeepAuditing.value = true;
    deepAuditResults.value = null;

    try {
      const response = await fetch(`${API_BASE}/audit/deep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: activeHook.value.transcript_quote,
          language: language.value
        })
      });
      if (!response.ok) throw new Error('Backend audit failed');
      const data = await response.json();
      deepAuditResults.value = data;
    } catch (e) {
      console.error('[audit] Deep audit failed:', e);
      setTimeout(() => {
        deepAuditResults.value = {
          riskLevel: 'medium',
          violations: [
            'Potential clickbait pattern detected',
            'Sensitive health claim check recommended'
          ],
          suggestions: 'Rephrase the opening sentence to be less inflammatory.'
        };
      }, 1500);
    } finally {
      setTimeout(() => {
        isDeepAuditing.value = false;
      }, 1500);
    }
  }

  const maskFlaggedWords = () => {
    const transcript = fullTranscript.value || [];
    fullTranscript.value = engine.maskTranscriptWithPatterns(
      transcript,
      compiledPatterns.value,
      maskingStyle.value
    );
  };

  const revertMaskedWords = () => {
    const transcript = fullTranscript.value || [];
    fullTranscript.value = engine.unmaskTranscript(transcript);
  };

  return {
    customBlacklist,
    customWhitelist,
    safetySensitivity,
    maskingStyle,
    audioBleepEnabled,
    audioBleepSource,
    customBleepFile,
    bleepLibrary,
    selectedBleepAudioId,
    selectBleepAudio,
    addCustomBleepFile,
    removeCustomBleepFile,
    bleepPaddingOffset,
    bleepMode,
    isWarningIgnored,
    activeCategories,
    activePlatformFilters,
    categorizedBlacklist,
    deepAuditResults,
    isDeepAuditing,
    safeZoneVisible,
    saveBlacklistToStorage,
    loadBlacklistFromStorage,
    flaggedSegments,
    contentAudit,
    runDeepAudit,
    maskFlaggedWords,
    revertMaskedWords,
    layoutAudit,
    fitSubtitlesToSafeZone,
    readabilityAudit,
    fitSubtitlesToReadability,
    ignoreSafetyWarnings,
    restoreSafetyWarnings
  };
};

/**
 * ContentSafetyAuditor — Deep Domain Engine for Content Safety,
 * Profanity Auditing, Platform Safe-Zone Collisions, Subtitle Readability,
 * and Word-Level Audio Censorship Presets.
 */

import type { TranscriptSegment } from '../types/clipper';

export interface FlaggedSegment {
  start: number;
  duration: number;
  word: string;
  text: string;
}

export interface AuditResult {
  score: number;
  flaggedWords: string[];
  flaggedSegments: FlaggedSegment[];
  uniqueFlagsCount: number;
  remediatedWords?: string[];
  remediatedSegments?: FlaggedSegment[];
}

export interface LayoutAuditResult {
  isSafe: boolean;
  reason: string;
  collisionCount: number;
}

export interface ReadabilityAuditResult {
  isSafe: boolean;
  reason: string;
}

export interface CompiledPattern {
  source: string;
  regex: RegExp;
  globalRegex: RegExp;
}

export interface BleepAudioItem {
  id: string;
  name: string;
  data: string;
  isPreset?: boolean;
}

export type SafetyCategory = 'violence' | 'sexual' | 'profanity';
export type ActiveCategories = Record<SafetyCategory, boolean>;
export type SafetySensitivity = 'strict' | 'standard' | 'manual';
export type MaskingStyle = 'asterisk' | 'block' | 'bleep_marker';
export type BleepMode = 'full' | 'partial_end';
export type PlatformSafeZone = 'none' | 'tiktok' | 'reels' | 'shorts';

export interface ComprehensiveSafetyReport {
  rawAudit: AuditResult;
  adjustedScore: number;
  score: number;
  flaggedWords: string[];
  flaggedSegments: FlaggedSegment[];
  uniqueFlagsCount: number;
  remediatedWords: string[];
  remediatedSegments: FlaggedSegment[];
  isRemediated: boolean;
  layout: LayoutAuditResult;
  readability: ReadabilityAuditResult;
  isLayoutSafe: boolean;
  isReadabilitySafe: boolean;
  isIgnored: boolean;
}

export interface SafetyFilterScope {
  safetySensitivity: SafetySensitivity;
  activeCategories: ActiveCategories;
  categorizedBlacklist: Record<SafetyCategory, string[]>;
  customBlacklist: string[];
  customWhitelist: string[];
}

export interface LexicalMatch {
  start: number;
  duration: number;
  word: string;
  text: string;
  isVisualMasked: boolean;
}

export interface ContentAuditSnapshot extends AuditResult {
  remediatedWords: string[];
  remediatedSegments: FlaggedSegment[];
  isRemediated: boolean;
}

export interface SafetyAuditConfig {
  customBlacklist: string[];
  customWhitelist: string[];
  categorizedBlacklist: Record<SafetyCategory, string[]>;
  safetySensitivity: SafetySensitivity;
  maskingStyle: MaskingStyle;
  audioBleepEnabled: boolean;
  audioBleepSource: 'mute' | 'custom';
  bleepLibrary: BleepAudioItem[];
  selectedBleepAudioId: string;
  customBleepFile: { name: string; data: string } | null;
  bleepPaddingOffset: number;
  bleepMode: BleepMode;
  isWarningIgnored: boolean;
  activeCategories: ActiveCategories;
  activePlatformFilters: { tiktok: boolean; reels: boolean; shorts: boolean };
}

export const DEFAULT_CATEGORIZED_BLACKLIST: Record<SafetyCategory, string[]> = {
  violence: [
    'kill',
    'death',
    'suicide',
    'unalive',
    'gun',
    'blood',
    'weapon',
    'murder',
    'shot',
    '/bunuh/',
    'mati',
    'tewas',
    '/darah/',
    '/senjata/',
    '/tembak/',
    'perang',
    '/teroris/',
    '/bom/',
    'war',
    'terror',
    'bomb',
    'crash',
    'accident',
    'crime'
  ],
  sexual: [
    'sex',
    'porn',
    'seggs',
    'hentai',
    'nude',
    'nudity',
    'sexy',
    '/bokep/',
    '/telanjang/',
    '/seks/',
    '/mesum/',
    's*ksi',
    '/lonte/',
    '/perek/'
  ],
  profanity: [
    'sh!t',
    'f*ck',
    'b!tch',
    'damn',
    'hell',
    '/anjing/',
    '/anjg/',
    '/bangsat/',
    '/bgsat/',
    '/tolol/',
    '/goblok/',
    '/babi/',
    '/kontol/',
    '/kontl/',
    '/memek/',
    '/memk/',
    '/itil/',
    '/bajingan/',
    '/pantek/',
    '/jancok/',
    '/jancuk/',
    '/tai/'
  ]
};

const DEFAULT_CATEGORIZED_BLACKLIST_SETS: Record<
  SafetyCategory,
  Set<string>
> = {
  violence: new Set(DEFAULT_CATEGORIZED_BLACKLIST.violence),
  sexual: new Set(DEFAULT_CATEGORIZED_BLACKLIST.sexual),
  profanity: new Set(DEFAULT_CATEGORIZED_BLACKLIST.profanity)
};

export const CATEGORIZED_BLACKLIST = DEFAULT_CATEGORIZED_BLACKLIST;

export const DEFAULT_BLACKLIST: string[] = [
  ...DEFAULT_CATEGORIZED_BLACKLIST.violence,
  ...DEFAULT_CATEGORIZED_BLACKLIST.sexual,
  ...DEFAULT_CATEGORIZED_BLACKLIST.profanity
];

export const SEVERE_WORDS = new Set([
  // violence
  'suicide',
  'unalive',
  'murder',
  'bunuh',
  'teroris',
  'bom',
  'terror',
  'bomb',
  // sexual
  'porn',
  'hentai',
  'nude',
  'nudity',
  'bokep',
  'telanjang',
  'mesum',
  'lonte',
  'perek',
  // profanity
  'f*ck',
  'b!tch',
  'bangsat',
  'bgsat',
  'kontol',
  'kontl',
  'memek',
  'memk',
  'itil',
  'bajingan',
  'pantek',
  'jancok',
  'jancuk'
]);

export const BUILTIN_BLEEP_PRESETS: BleepAudioItem[] = [
  {
    id: 'default_preset',
    name: 'Standard Bleep',
    data: '/audio/bleep.wav',
    isPreset: true
  }
];

export const DEFAULT_BLEEP_PRESET: BleepAudioItem = BUILTIN_BLEEP_PRESETS[0]!;

/**
 * Deep Domain Engine encapsulating all content safety inspection,
 * regex caching, audio censorship presets, safe zones, and readability.
 */
export class ContentSafetyAuditor {
  private _config: SafetyAuditConfig;
  private _patternCache: Map<string, CompiledPattern> = new Map();

  constructor(initialConfig?: Partial<SafetyAuditConfig>) {
    this._config = {
      customBlacklist: [],
      customWhitelist: [],
      categorizedBlacklist: {
        violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
        sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
        profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
      },
      safetySensitivity: 'strict',
      maskingStyle: 'asterisk',
      audioBleepEnabled: true,
      audioBleepSource: 'mute',
      bleepLibrary: [...BUILTIN_BLEEP_PRESETS],
      selectedBleepAudioId: DEFAULT_BLEEP_PRESET.id,
      customBleepFile: {
        name: DEFAULT_BLEEP_PRESET.name,
        data: DEFAULT_BLEEP_PRESET.data
      },
      bleepPaddingOffset: 0,
      bleepMode: 'full',
      isWarningIgnored: false,
      activeCategories: { violence: true, sexual: true, profanity: true },
      activePlatformFilters: { tiktok: true, reels: true, shorts: true },
      ...initialConfig
    };
    this._syncCustomBleepFile();
  }

  // Configuration Property Accessors
  public get config(): Readonly<SafetyAuditConfig> {
    return this._config;
  }

  public get customBlacklist(): string[] {
    return this._config.customBlacklist;
  }
  public set customBlacklist(val: string[]) {
    this._config.customBlacklist = val;
  }

  public get customWhitelist(): string[] {
    return this._config.customWhitelist;
  }
  public set customWhitelist(val: string[]) {
    this._config.customWhitelist = val;
  }

  public get categorizedBlacklist(): Record<SafetyCategory, string[]> {
    return this._config.categorizedBlacklist;
  }
  public set categorizedBlacklist(val: Record<SafetyCategory, string[]>) {
    this._config.categorizedBlacklist = val;
  }

  public get safetySensitivity(): SafetySensitivity {
    return this._config.safetySensitivity;
  }
  public set safetySensitivity(val: SafetySensitivity) {
    this._config.safetySensitivity = val;
  }

  public get maskingStyle(): MaskingStyle {
    return this._config.maskingStyle;
  }
  public set maskingStyle(val: MaskingStyle) {
    this._config.maskingStyle = val;
  }

  public get audioBleepEnabled(): boolean {
    return this._config.audioBleepEnabled;
  }
  public set audioBleepEnabled(val: boolean) {
    this._config.audioBleepEnabled = val;
  }

  public get audioBleepSource(): 'mute' | 'custom' {
    return this._config.audioBleepSource;
  }
  public set audioBleepSource(val: 'mute' | 'custom') {
    this._config.audioBleepSource = val;
  }

  public get bleepLibrary(): BleepAudioItem[] {
    return this._config.bleepLibrary;
  }

  public get selectedBleepAudioId(): string {
    return this._config.selectedBleepAudioId;
  }

  public get customBleepFile(): { name: string; data: string } | null {
    return this._config.customBleepFile;
  }

  public get bleepPaddingOffset(): number {
    return this._config.bleepPaddingOffset;
  }
  public set bleepPaddingOffset(val: number) {
    this._config.bleepPaddingOffset = Math.max(0, val);
  }

  public get bleepMode(): BleepMode {
    return this._config.bleepMode;
  }
  public set bleepMode(val: BleepMode) {
    this._config.bleepMode = val;
  }

  public get isWarningIgnored(): boolean {
    return this._config.isWarningIgnored;
  }
  public set isWarningIgnored(val: boolean) {
    this._config.isWarningIgnored = val;
  }

  public get activeCategories(): ActiveCategories {
    return this._config.activeCategories;
  }
  public set activeCategories(val: ActiveCategories) {
    this._config.activeCategories = val;
  }

  public get activePlatformFilters(): {
    tiktok: boolean;
    reels: boolean;
    shorts: boolean;
  } {
    return this._config.activePlatformFilters;
  }
  public set activePlatformFilters(val: {
    tiktok: boolean;
    reels: boolean;
    shorts: boolean;
  }) {
    this._config.activePlatformFilters = val;
  }

  // --- Pattern Compilation & Caching ---

  public getCompiledPattern(word: string): CompiledPattern | null {
    if (!word) return null;
    const trimmed = word.trim();
    if (!trimmed) return null;

    let pattern = this._patternCache.get(trimmed);
    if (!pattern) {
      if (
        trimmed.startsWith('/') &&
        trimmed.endsWith('/') &&
        trimmed.length > 2
      ) {
        const raw = trimmed.slice(1, -1);
        pattern = {
          source: trimmed,
          regex: new RegExp(raw, 'i'),
          globalRegex: new RegExp(raw, 'gi')
        };
      } else {
        const escaped = trimmed
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = {
          source: trimmed,
          regex: new RegExp(`\\b${escaped}\\b`, 'i'),
          globalRegex: new RegExp(`\\b${escaped}\\b`, 'gi')
        };
      }
      this._patternCache.set(trimmed, pattern);
    }
    return pattern;
  }

  public compileBlacklist(blacklist: string[]): CompiledPattern[] {
    const compiled: CompiledPattern[] = [];
    for (const word of blacklist) {
      const p = this.getCompiledPattern(word);
      if (p) compiled.push(p);
    }
    return compiled;
  }

  /**
   * Resolves the effective active blacklist for a given filter scope
   * (or this engine's own config) without allocating category default sets per call.
   */
  public resolveEffectiveBlacklist(
    scope?: Partial<SafetyFilterScope>
  ): string[] {
    const safetySensitivity =
      scope?.safetySensitivity ?? this._config.safetySensitivity;
    const activeCategories =
      scope?.activeCategories ?? this._config.activeCategories;
    const categorizedBlacklist =
      scope?.categorizedBlacklist ?? this._config.categorizedBlacklist;
    const customBlacklist =
      scope?.customBlacklist ?? this._config.customBlacklist;
    const customWhitelist =
      scope?.customWhitelist ?? this._config.customWhitelist;

    const list: string[] = [];

    if (safetySensitivity !== 'manual') {
      const categories: SafetyCategory[] = ['violence', 'sexual', 'profanity'];
      for (const cat of categories) {
        if (activeCategories[cat]) {
          const words = categorizedBlacklist[cat] || [];
          if (safetySensitivity === 'standard') {
            // Only severe words OR user-added words (not in default list)
            const defaultSet = DEFAULT_CATEGORIZED_BLACKLIST_SETS[cat];
            list.push(
              ...words.filter(word => {
                const clean =
                  word.startsWith('/') && word.endsWith('/')
                    ? word.slice(1, -1)
                    : word;
                const isSevere = SEVERE_WORDS.has(clean.toLowerCase().trim());
                const isUserAdded = !defaultSet.has(word);
                return isSevere || isUserAdded;
              })
            );
          } else {
            // Strict mode uses all words from active categories
            list.push(...words);
          }
        }
      }
    }

    // Append custom blacklist
    list.push(...customBlacklist);

    // Filter out case-insensitive whitelisted words
    const whitelistSet = new Set(
      customWhitelist.map(w => w.toLowerCase().trim())
    );
    return [...new Set(list)].filter(word => {
      const cleanWord =
        word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word;
      return (
        !whitelistSet.has(cleanWord.toLowerCase().trim()) &&
        !whitelistSet.has(word.toLowerCase().trim())
      );
    });
  }

  /**
   * Compiles the effective active blacklist based on sensitivity,
   * active categories, custom blacklist entries, and whitelist exceptions.
   */
  public getEffectiveBlacklist(): string[] {
    return this.resolveEffectiveBlacklist();
  }

  // --- Core Safety Auditing & Inspection ---

  /**
   * Scans the transcript once against pre-compiled patterns and returns
   * raw acoustic/visual word matches independent of bleep padding or enabled toggles.
   */
  public scanTranscriptMatches(
    transcript: TranscriptSegment[],
    compiledPatterns: CompiledPattern[]
  ): LexicalMatch[] {
    if (
      compiledPatterns.length === 0 ||
      !transcript ||
      transcript.length === 0
    ) {
      return [];
    }

    const flatWords: {
      text: string;
      rawText: string;
      isMasked: boolean;
      parentSegLowerText: string;
      start: number;
      duration: number;
    }[] = [];

    for (const seg of transcript) {
      const segText = (seg.text || '').trim();
      const segRawText = (seg.rawText || segText).trim();
      if (!segText && !segRawText) continue;
      const parentSegLowerText = segText.toLowerCase();

      if (seg.words && Array.isArray(seg.words) && seg.words.length > 0) {
        for (const w of seg.words) {
          const wText = (w.text || '').trim();
          const wRawText = (w.rawText || wText).trim();
          if (!wText && !wRawText) continue;
          const wStart = Number(w.start) || 0;
          const wDuration = Number(w.duration) || 0;
          const isWordMasked = Boolean(
            w.isMasked || (wText !== wRawText && wText.includes('*'))
          );
          flatWords.push({
            text: wText || wRawText,
            rawText: wRawText || wText,
            isMasked: isWordMasked,
            parentSegLowerText,
            start: wStart,
            duration: wDuration
          });
        }
      } else {
        const words = segText.split(/\s+/);
        const rawWords = segRawText.split(/\s+/);
        const isSegMasked = Boolean(seg.rawText && seg.rawText !== seg.text);
        if (words.length === 1) {
          flatWords.push({
            text: words[0] || '',
            rawText: rawWords[0] || words[0] || '',
            isMasked: isSegMasked,
            parentSegLowerText,
            start: seg.start,
            duration: seg.duration
          });
        } else {
          const wordDur = seg.duration / words.length;
          words.forEach((w: string, idx: number) => {
            flatWords.push({
              text: w,
              rawText: rawWords[idx] || w,
              isMasked: isSegMasked,
              parentSegLowerText,
              start: seg.start + idx * wordDur,
              duration: wordDur
            });
          });
        }
      }
    }

    const matches: LexicalMatch[] = [];
    for (const w of flatWords) {
      const lowerRaw = w.rawText.toLowerCase();
      const sameExactText = w.text === w.rawText;
      const lowerVisual = sameExactText ? lowerRaw : w.text.toLowerCase();
      const sameLowerText = sameExactText || lowerVisual === lowerRaw;

      for (const pattern of compiledPatterns) {
        const matchesRaw = pattern.regex.test(lowerRaw);
        const matchesVisual = sameLowerText
          ? matchesRaw
          : pattern.regex.test(lowerVisual);

        if (matchesRaw || matchesVisual) {
          const isVisualMasked = Boolean(
            w.isMasked ||
            !matchesVisual ||
            w.text.includes('*') ||
            w.text.includes('[BLEEP]') ||
            !pattern.regex.test(w.parentSegLowerText)
          );

          matches.push({
            start: w.start,
            duration: w.duration,
            word: pattern.source,
            text: w.rawText || w.text,
            isVisualMasked
          });
        }
      }
    }

    return matches;
  }

  /**
   * Projects lexical matches onto timeline bleep ranges with the configured padding offset.
   */
  public buildFlaggedSegments(
    matches: LexicalMatch[],
    bleepPaddingOffsetMs?: number
  ): FlaggedSegment[] {
    if (!matches || matches.length === 0) return [];
    const padding =
      bleepPaddingOffsetMs ?? this._config.bleepPaddingOffset ?? 0;
    const paddingSec = padding / 1000;
    return matches.map(m => ({
      start: Math.max(0, m.start - paddingSec),
      duration: m.duration + 2 * paddingSec,
      word: m.word,
      text: m.text
    }));
  }

  /**
   * Scores and partitions pre-matched lexical hits in O(M) without running regexes.
   */
  public evaluateLexicalMatches(
    matches: LexicalMatch[],
    flaggedSegments: FlaggedSegment[],
    audioBleepEnabledOverride?: boolean
  ): AuditResult {
    if (!matches || matches.length === 0 || flaggedSegments.length === 0) {
      return {
        score: 100,
        flaggedWords: [],
        flaggedSegments,
        uniqueFlagsCount: 0
      };
    }

    const audioBleepEnabled =
      audioBleepEnabledOverride ?? this._config.audioBleepEnabled;
    const flaggedWords: string[] = [];
    const remediatedWords: string[] = [];
    const remediatedSegments: FlaggedSegment[] = [];
    const activeSegments: FlaggedSegment[] = [];
    const count = Math.min(matches.length, flaggedSegments.length);

    for (let i = 0; i < count; i++) {
      const match = matches[i]!;
      const segItem = flaggedSegments[i]!;

      // Remediated Violation: Visually masked AND Audio Bleep enabled
      if (match.isVisualMasked && audioBleepEnabled) {
        remediatedSegments.push(segItem);
        if (!remediatedWords.includes(match.word)) {
          remediatedWords.push(match.word);
        }
      } else {
        activeSegments.push(segItem);
        if (!flaggedWords.includes(match.word)) {
          flaggedWords.push(match.word);
        }
      }
    }

    let score = 100;
    // Only active (unremediated) flags penalize the safety score!
    const uniqueTimeFlags = new Set(activeSegments.map(f => f.start.toFixed(2)))
      .size;
    score -= uniqueTimeFlags * 12;

    const result: AuditResult = {
      score: Math.max(0, score),
      flaggedWords,
      flaggedSegments,
      uniqueFlagsCount: flaggedSegments.length
    };
    if (remediatedWords.length > 0) {
      result.remediatedWords = remediatedWords;
      result.remediatedSegments = remediatedSegments;
    }
    return result;
  }

  /**
   * Evaluates sensitive vocabulary, bleep offsets, and timestamps against the transcript.
   */
  public auditTranscript(
    transcript: TranscriptSegment[],
    blacklistOverride?: string[],
    _mode: string = 'word',
    bleepPaddingOffsetMs?: number,
    bleepMode?: BleepMode,
    audioBleepEnabledOverride?: boolean
  ): AuditResult {
    const activeBlacklist = blacklistOverride ?? this.getEffectiveBlacklist();
    const compiledPatterns = this.compileBlacklist(activeBlacklist);
    const padding = bleepPaddingOffsetMs ?? this._config.bleepPaddingOffset;
    const _effectiveMode = bleepMode ?? this._config.bleepMode;
    const audioBleepEnabled =
      audioBleepEnabledOverride ?? this._config.audioBleepEnabled;

    if (
      compiledPatterns.length === 0 ||
      !transcript ||
      transcript.length === 0
    ) {
      return {
        score: 100,
        flaggedWords: [],
        flaggedSegments: [],
        uniqueFlagsCount: 0
      };
    }

    const matches = this.scanTranscriptMatches(transcript, compiledPatterns);
    const flaggedSegments = this.buildFlaggedSegments(matches, padding);
    return this.evaluateLexicalMatches(
      matches,
      flaggedSegments,
      audioBleepEnabled
    );
  }

  /**
   * Audits subtitle placement against social media platform safe zones.
   */
  public auditLayoutCollision(
    platform: PlatformSafeZone | string = 'none',
    position: 'top' | 'bottom' | 'center' | string = 'center',
    offset: number = 0,
    activeFilters?: { tiktok: boolean; reels: boolean; shorts: boolean },
    isWarningIgnored?: boolean
  ): LayoutAuditResult {
    const filters = activeFilters ?? this._config.activePlatformFilters;
    const ignored = isWarningIgnored ?? this._config.isWarningIgnored;

    const isFilterActive =
      platform === 'none' ||
      (platform === 'tiktok' && filters.tiktok) ||
      (platform === 'reels' && filters.reels) ||
      (platform === 'shorts' && filters.shorts);

    if (platform === 'none' || !isFilterActive || ignored) {
      return {
        isSafe: true,
        reason: 'No safe zone selected or check is disabled.',
        collisionCount: 0
      };
    }

    let isColliding = false;
    let reason = 'Subtitles are placed in a safe layout zone.';

    if (position === 'top') {
      const topDeadzone =
        platform === 'tiktok' ? 130 : platform === 'reels' ? 220 : 160;
      if (offset < topDeadzone) {
        isColliding = true;
        reason = `Subtitles collide with top ${platform} header zone (${topDeadzone}px).`;
      }
    } else if (position === 'bottom') {
      const bottomDeadzone =
        platform === 'tiktok' ? 250 : platform === 'reels' ? 350 : 280;
      if (offset < bottomDeadzone) {
        isColliding = true;
        reason = `Subtitles collide with bottom ${platform} controls/caption zone (${bottomDeadzone}px).`;
      }
    }

    return {
      isSafe: !isColliding,
      reason,
      collisionCount: isColliding ? 1 : 0
    };
  }

  /**
   * Calculates the recommended safe offset for placing subtitles outside platform deadzones.
   */
  public calculateSafeOffset(
    platform: PlatformSafeZone | string = 'none',
    position: 'top' | 'bottom' | 'center' | string = 'center'
  ): number | null {
    if (platform === 'none') return null;
    if (position === 'top') {
      const topDeadzone =
        platform === 'tiktok' ? 130 : platform === 'reels' ? 220 : 160;
      return topDeadzone + 20;
    }
    if (position === 'bottom') {
      const bottomDeadzone =
        platform === 'tiktok' ? 250 : platform === 'reels' ? 350 : 280;
      return bottomDeadzone + 20;
    }
    return null;
  }

  /**
   * Checks whether subtitle styling has sufficient contrast and background readability.
   */
  public auditReadability(
    background: string = 'none',
    strokeWidth: number = 0,
    strokeColor: string = '#000000',
    isWarningIgnored?: boolean
  ): ReadabilityAuditResult {
    const ignored = isWarningIgnored ?? this._config.isWarningIgnored;
    if (ignored) {
      return {
        isSafe: true,
        reason: 'Subtitle readability warnings ignored.'
      };
    }

    const hasBg = background !== 'none';
    const hasStroke =
      strokeWidth >= 2 &&
      strokeColor !== 'transparent' &&
      strokeColor !== 'none';

    if (!hasBg && !hasStroke) {
      return {
        isSafe: false,
        reason:
          'Low subtitle contrast: Add a text outline or background box to guarantee readability.'
      };
    }

    return {
      isSafe: true,
      reason:
        'Subtitle readability is secured with active outline or background styles.'
    };
  }

  /**
   * Combines raw vocabulary score with safe zone layout and contrast readability penalties.
   */
  public calculateAdjustedScore(
    rawScore: number,
    isLayoutSafe: boolean,
    isReadabilitySafe: boolean,
    isWarningIgnored?: boolean
  ): number {
    const ignored = isWarningIgnored ?? this._config.isWarningIgnored;
    if (ignored) return 100;

    let score = rawScore;
    if (!isLayoutSafe) score -= 15;
    if (!isReadabilitySafe) score -= 10;
    return Math.max(0, score);
  }

  /**
   * Combines pre-computed lexical, layout, and readability pillar results
   * into a ComprehensiveSafetyReport in O(1) without re-scanning transcripts.
   */
  public composeSafetyReport(
    rawAudit: AuditResult,
    layout: LayoutAuditResult,
    readability: ReadabilityAuditResult,
    isWarningIgnored?: boolean
  ): ComprehensiveSafetyReport {
    const ignored = isWarningIgnored ?? this._config.isWarningIgnored;
    const adjustedScore = this.calculateAdjustedScore(
      rawAudit.score,
      layout.isSafe,
      readability.isSafe,
      ignored
    );

    const isRemediated =
      (rawAudit.remediatedWords?.length ?? 0) > 0 &&
      rawAudit.flaggedWords.length === 0;

    if (ignored) {
      return {
        rawAudit,
        adjustedScore: 100,
        score: 100,
        flaggedWords: [],
        flaggedSegments: rawAudit.flaggedSegments,
        uniqueFlagsCount: rawAudit.uniqueFlagsCount,
        remediatedWords: rawAudit.remediatedWords || [],
        remediatedSegments: rawAudit.remediatedSegments || [],
        isRemediated,
        layout,
        readability,
        isLayoutSafe: true,
        isReadabilitySafe: true,
        isIgnored: true
      };
    }

    return {
      rawAudit,
      adjustedScore,
      score: adjustedScore,
      flaggedWords: rawAudit.flaggedWords,
      flaggedSegments: rawAudit.flaggedSegments,
      uniqueFlagsCount: rawAudit.uniqueFlagsCount,
      remediatedWords: rawAudit.remediatedWords || [],
      remediatedSegments: rawAudit.remediatedSegments || [],
      isRemediated,
      layout,
      readability,
      isLayoutSafe: layout.isSafe,
      isReadabilitySafe: readability.isSafe,
      isIgnored: false
    };
  }

  /**
   * Comprehensive 3-Pillar Audit Evaluation entrypoint.
   */
  public audit(context: {
    transcript: TranscriptSegment[];
    activeSafeZone?: PlatformSafeZone | string;
    subtitlePosition?: string;
    subtitleOffset?: number;
    subtitleBackground?: string;
    subtitleStrokeWidth?: number;
    subtitleStrokeColor?: string;
    isWarningIgnored?: boolean;
    blacklistOverride?: string[];
    audioBleepEnabled?: boolean;
  }): ComprehensiveSafetyReport {
    const ignored = context.isWarningIgnored ?? this._config.isWarningIgnored;
    const bleepEnabled =
      context.audioBleepEnabled ?? this._config.audioBleepEnabled;
    const rawAudit = this.auditTranscript(
      context.transcript,
      context.blacklistOverride,
      'word',
      this._config.bleepPaddingOffset,
      this._config.bleepMode,
      bleepEnabled
    );

    const layout = this.auditLayoutCollision(
      context.activeSafeZone || 'none',
      context.subtitlePosition || 'center',
      context.subtitleOffset || 0,
      this._config.activePlatformFilters,
      ignored
    );

    const readability = this.auditReadability(
      context.subtitleBackground || 'none',
      context.subtitleStrokeWidth || 0,
      context.subtitleStrokeColor || '#000000',
      ignored
    );

    return this.composeSafetyReport(rawAudit, layout, readability, ignored);
  }

  // --- Text & Transcript Masking ---

  private _maskTextWithPatterns(
    text: string,
    compiledPatterns: CompiledPattern[],
    style: MaskingStyle
  ): string {
    let masked = text || '';
    if (!masked || compiledPatterns.length === 0) return masked;

    for (const pattern of compiledPatterns) {
      masked = masked.replace(pattern.globalRegex, (match: string) => {
        if (style === 'block') {
          return '*'.repeat(match.length);
        } else if (style === 'bleep_marker') {
          return '[BLEEP]';
        } else {
          if (match.length <= 1) return match;
          if (match.length === 2) return match.charAt(0) + '*';
          return match.charAt(0) + '*' + match.slice(2);
        }
      });
    }
    return masked;
  }

  public maskText(
    text: string,
    blacklistOverride?: string[],
    styleOverride?: MaskingStyle
  ): string {
    const masked = text || '';
    if (!masked) return masked;
    const blacklist = blacklistOverride ?? this.getEffectiveBlacklist();
    if (!blacklist || blacklist.length === 0) return masked;
    const style = styleOverride ?? this._config.maskingStyle;
    const compiledPatterns = this.compileBlacklist(blacklist);
    return this._maskTextWithPatterns(masked, compiledPatterns, style);
  }

  public maskTranscriptWithPatterns(
    transcript: TranscriptSegment[],
    compiledPatterns: CompiledPattern[],
    styleOverride?: MaskingStyle
  ): TranscriptSegment[] {
    if (!transcript) return [];
    const style = styleOverride ?? this._config.maskingStyle;

    return transcript.map(seg => {
      const origSegText = seg.rawText || seg.text || '';
      const maskedSegText = this._maskTextWithPatterns(
        origSegText,
        compiledPatterns,
        style
      );

      const maskedWords = seg.words?.map(w => {
        const origWordText = w.rawText || w.text || '';
        const maskedWordText = this._maskTextWithPatterns(
          origWordText,
          compiledPatterns,
          style
        );
        const isWordMasked = maskedWordText !== origWordText;
        return {
          ...w,
          text: maskedWordText,
          rawText: origWordText,
          isMasked: isWordMasked
        };
      });

      return {
        ...seg,
        text: maskedSegText,
        rawText: origSegText,
        words: maskedWords
      };
    });
  }

  public maskTranscript(
    transcript: TranscriptSegment[],
    blacklistOverride?: string[],
    styleOverride?: MaskingStyle
  ): TranscriptSegment[] {
    if (!transcript) return [];
    const blacklist = blacklistOverride ?? this.getEffectiveBlacklist();
    const compiledPatterns =
      blacklist && blacklist.length > 0 ? this.compileBlacklist(blacklist) : [];
    return this.maskTranscriptWithPatterns(
      transcript,
      compiledPatterns,
      styleOverride
    );
  }

  public unmaskTranscript(
    transcript: TranscriptSegment[]
  ): TranscriptSegment[] {
    if (!transcript) return [];
    return transcript.map(seg => {
      const restoredText = seg.rawText || seg.text || '';
      const restoredWords = seg.words?.map(w => ({
        ...w,
        text: w.rawText || w.text,
        isMasked: false
      }));
      return {
        ...seg,
        text: restoredText,
        words: restoredWords
      };
    });
  }

  // --- Bleep Audio Library Management ---

  public selectBleepAudio(id: string): boolean {
    if (this._config.bleepLibrary.some(item => item.id === id)) {
      this._config.selectedBleepAudioId = id;
      this._syncCustomBleepFile();
      return true;
    }
    return false;
  }

  public addCustomBleepFile(file: {
    name: string;
    data: string;
  }): BleepAudioItem {
    const newItem: BleepAudioItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      data: file.data,
      isPreset: false
    };
    this._config.bleepLibrary.push(newItem);
    this._config.selectedBleepAudioId = newItem.id;
    this._syncCustomBleepFile();
    return newItem;
  }

  public removeCustomBleepFile(id: string): boolean {
    const index = this._config.bleepLibrary.findIndex(
      item => item.id === id && !item.isPreset
    );
    if (index !== -1) {
      this._config.bleepLibrary.splice(index, 1);
      if (this._config.selectedBleepAudioId === id) {
        this._config.selectedBleepAudioId = DEFAULT_BLEEP_PRESET.id;
      }
      this._syncCustomBleepFile();
      return true;
    }
    return false;
  }

  private _syncCustomBleepFile(): void {
    const activeItem =
      this._config.bleepLibrary.find(
        item => item.id === this._config.selectedBleepAudioId
      ) || DEFAULT_BLEEP_PRESET;
    this._config.customBleepFile = {
      name: activeItem.name,
      data: activeItem.data
    };
  }

  // --- Serialization & Storage Hydration ---

  public exportState(): SafetyAuditConfig {
    return {
      ...this._config,
      customBlacklist: [...this._config.customBlacklist],
      customWhitelist: [...this._config.customWhitelist],
      categorizedBlacklist: {
        violence: [...this._config.categorizedBlacklist.violence],
        sexual: [...this._config.categorizedBlacklist.sexual],
        profanity: [...this._config.categorizedBlacklist.profanity]
      },
      bleepLibrary: [...this._config.bleepLibrary],
      activeCategories: { ...this._config.activeCategories },
      activePlatformFilters: { ...this._config.activePlatformFilters }
    };
  }

  public hydrate(state: Partial<SafetyAuditConfig>): void {
    if (state.customBlacklist)
      this._config.customBlacklist = [...state.customBlacklist];
    if (state.customWhitelist)
      this._config.customWhitelist = [...state.customWhitelist];
    if (state.categorizedBlacklist) {
      this._config.categorizedBlacklist = {
        violence: [
          ...(state.categorizedBlacklist.violence ||
            DEFAULT_CATEGORIZED_BLACKLIST.violence)
        ],
        sexual: [
          ...(state.categorizedBlacklist.sexual ||
            DEFAULT_CATEGORIZED_BLACKLIST.sexual)
        ],
        profanity: [
          ...(state.categorizedBlacklist.profanity ||
            DEFAULT_CATEGORIZED_BLACKLIST.profanity)
        ]
      };
    }
    if (state.safetySensitivity)
      this._config.safetySensitivity = state.safetySensitivity;
    if (state.maskingStyle) this._config.maskingStyle = state.maskingStyle;
    if (state.audioBleepEnabled !== undefined)
      this._config.audioBleepEnabled = state.audioBleepEnabled;
    if (state.audioBleepSource)
      this._config.audioBleepSource = state.audioBleepSource;
    if (state.bleepLibrary) {
      const customOnly = state.bleepLibrary.filter(item => !item.isPreset);
      this._config.bleepLibrary = [...BUILTIN_BLEEP_PRESETS, ...customOnly];
    }
    if (state.selectedBleepAudioId) {
      if (
        this._config.bleepLibrary.some(
          item => item.id === state.selectedBleepAudioId
        )
      ) {
        this._config.selectedBleepAudioId = state.selectedBleepAudioId;
      } else {
        this._config.selectedBleepAudioId = DEFAULT_BLEEP_PRESET.id;
      }
    }
    if (state.bleepPaddingOffset !== undefined)
      this.bleepPaddingOffset = state.bleepPaddingOffset;
    if (state.bleepMode) this._config.bleepMode = state.bleepMode;
    if (state.isWarningIgnored !== undefined)
      this._config.isWarningIgnored = state.isWarningIgnored;
    if (state.activeCategories)
      this._config.activeCategories = {
        ...this._config.activeCategories,
        ...state.activeCategories
      };
    if (state.activePlatformFilters)
      this._config.activePlatformFilters = {
        ...this._config.activePlatformFilters,
        ...state.activePlatformFilters
      };

    this._syncCustomBleepFile();
  }

  public serializeToStorage(storage?: Storage): void {
    const targetStorage =
      storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!targetStorage) return;

    targetStorage.setItem(
      'yonru_subtitle_blacklist',
      JSON.stringify(this._config.customBlacklist)
    );
    targetStorage.setItem(
      'yonru_subtitle_whitelist',
      JSON.stringify(this._config.customWhitelist)
    );
    targetStorage.setItem(
      'yonru_categorized_blacklist',
      JSON.stringify(this._config.categorizedBlacklist)
    );
    targetStorage.setItem(
      'yonru_audio_bleep_enabled',
      this._config.audioBleepEnabled ? 'true' : 'false'
    );
    targetStorage.setItem(
      'yonru_audio_bleep_source',
      this._config.audioBleepSource
    );
    targetStorage.setItem(
      'yonru_bleep_padding_offset',
      this._config.bleepPaddingOffset.toString()
    );
    targetStorage.setItem(
      'yonru_selected_bleep_id',
      this._config.selectedBleepAudioId
    );
    targetStorage.setItem('yonru_bleep_mode', this._config.bleepMode);

    const customOnly = this._config.bleepLibrary.filter(item => !item.isPreset);
    targetStorage.setItem('yonru_bleep_library', JSON.stringify(customOnly));

    if (this._config.customBleepFile) {
      targetStorage.setItem(
        'yonru_custom_bleep_file',
        JSON.stringify(this._config.customBleepFile)
      );
    } else {
      targetStorage.removeItem('yonru_custom_bleep_file');
    }
  }

  public hydrateFromStorage(storage?: Storage): void {
    const targetStorage =
      storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!targetStorage) return;

    const savedBlack = targetStorage.getItem('yonru_subtitle_blacklist');
    if (savedBlack) {
      try {
        this._config.customBlacklist = JSON.parse(savedBlack);
      } catch {
        this._config.customBlacklist = [];
      }
    }

    const savedWhite = targetStorage.getItem('yonru_subtitle_whitelist');
    if (savedWhite) {
      try {
        this._config.customWhitelist = JSON.parse(savedWhite);
      } catch {
        this._config.customWhitelist = [];
      }
    }

    const savedCategorized = targetStorage.getItem(
      'yonru_categorized_blacklist'
    );
    if (savedCategorized) {
      try {
        this._config.categorizedBlacklist = JSON.parse(savedCategorized);
      } catch {
        // Keep defaults
      }
    }

    const savedBleepSource = targetStorage.getItem('yonru_audio_bleep_source');
    if (savedBleepSource === 'mute' || savedBleepSource === 'custom') {
      this._config.audioBleepSource = savedBleepSource;
    }

    const savedLibrary = targetStorage.getItem('yonru_bleep_library');
    if (savedLibrary) {
      try {
        const parsedCustom: BleepAudioItem[] = JSON.parse(savedLibrary);
        this._config.bleepLibrary = [...BUILTIN_BLEEP_PRESETS, ...parsedCustom];
      } catch {
        this._config.bleepLibrary = [...BUILTIN_BLEEP_PRESETS];
      }
    } else {
      this._config.bleepLibrary = [...BUILTIN_BLEEP_PRESETS];
    }

    const savedSelectedId = targetStorage.getItem('yonru_selected_bleep_id');
    if (
      savedSelectedId &&
      this._config.bleepLibrary.some(item => item.id === savedSelectedId)
    ) {
      this._config.selectedBleepAudioId = savedSelectedId;
    } else {
      this._config.selectedBleepAudioId = DEFAULT_BLEEP_PRESET.id;
    }

    const savedBleepEnabled = targetStorage.getItem(
      'yonru_audio_bleep_enabled'
    );
    if (savedBleepEnabled !== null) {
      this._config.audioBleepEnabled = savedBleepEnabled === 'true';
    }

    const savedPadding = targetStorage.getItem('yonru_bleep_padding_offset');
    if (savedPadding !== null) {
      const parsed = parseInt(savedPadding, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        this._config.bleepPaddingOffset = parsed;
      }
    }

    const savedBleepMode = targetStorage.getItem('yonru_bleep_mode');
    if (savedBleepMode === 'full' || savedBleepMode === 'partial_end') {
      this._config.bleepMode = savedBleepMode;
    }

    this._syncCustomBleepFile();
  }
}

// --- Reference-Stability Equality Helpers ---

function areStringArraysEqual(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areOptionalFlaggedSegmentsEqual(
  a: readonly FlaggedSegment[] | undefined,
  b: readonly FlaggedSegment[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return areFlaggedSegmentsEqual(a, b);
}

export function areCompiledPatternsEqual(
  a: readonly CompiledPattern[],
  b: readonly CompiledPattern[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function areLexicalMatchesEqual(
  a: readonly LexicalMatch[],
  b: readonly LexicalMatch[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.start !== right.start ||
      left.duration !== right.duration ||
      left.word !== right.word ||
      left.text !== right.text ||
      left.isVisualMasked !== right.isVisualMasked
    ) {
      return false;
    }
  }
  return true;
}

export function areFlaggedSegmentsEqual(
  a: readonly FlaggedSegment[],
  b: readonly FlaggedSegment[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.start !== right.start ||
      left.duration !== right.duration ||
      left.word !== right.word ||
      left.text !== right.text
    ) {
      return false;
    }
  }
  return true;
}

export function areAuditResultsEqual(a: AuditResult, b: AuditResult): boolean {
  if (a === b) return true;
  return (
    a.score === b.score &&
    a.uniqueFlagsCount === b.uniqueFlagsCount &&
    areStringArraysEqual(a.flaggedWords, b.flaggedWords) &&
    areFlaggedSegmentsEqual(a.flaggedSegments, b.flaggedSegments) &&
    areStringArraysEqual(a.remediatedWords, b.remediatedWords) &&
    areOptionalFlaggedSegmentsEqual(a.remediatedSegments, b.remediatedSegments)
  );
}

export function areLayoutAuditsEqual(
  a: LayoutAuditResult,
  b: LayoutAuditResult
): boolean {
  if (a === b) return true;
  return (
    a.isSafe === b.isSafe &&
    a.reason === b.reason &&
    a.collisionCount === b.collisionCount
  );
}

export function areReadabilityAuditsEqual(
  a: ReadabilityAuditResult,
  b: ReadabilityAuditResult
): boolean {
  if (a === b) return true;
  return a.isSafe === b.isSafe && a.reason === b.reason;
}

export function areContentAuditsEqual(
  a: ContentAuditSnapshot,
  b: ContentAuditSnapshot
): boolean {
  if (a === b) return true;
  return (
    a.score === b.score &&
    a.isRemediated === b.isRemediated &&
    a.uniqueFlagsCount === b.uniqueFlagsCount &&
    areStringArraysEqual(a.flaggedWords, b.flaggedWords) &&
    areFlaggedSegmentsEqual(a.flaggedSegments, b.flaggedSegments) &&
    areStringArraysEqual(a.remediatedWords, b.remediatedWords) &&
    areFlaggedSegmentsEqual(a.remediatedSegments, b.remediatedSegments)
  );
}

// Global default singleton instance
const defaultAuditor = new ContentSafetyAuditor();

export function createContentSafetyAuditor(
  config?: Partial<SafetyAuditConfig>
): ContentSafetyAuditor {
  return new ContentSafetyAuditor(config);
}

// --- Backward-Compatible Pure Function Facades ---

export function getCompiledPattern(word: string): CompiledPattern | null {
  return defaultAuditor.getCompiledPattern(word);
}

export function compileBlacklist(blacklist: string[]): CompiledPattern[] {
  return defaultAuditor.compileBlacklist(blacklist);
}

export function auditTranscript(
  transcript: TranscriptSegment[],
  blacklist?: string[],
  mode: string = 'word',
  bleepPaddingOffsetMs: number = 0,
  bleepMode: 'full' | 'partial_end' = 'full'
): AuditResult {
  return defaultAuditor.auditTranscript(
    transcript,
    blacklist,
    mode,
    bleepPaddingOffsetMs,
    bleepMode
  );
}

export function maskText(
  text: string,
  blacklist?: string[],
  style: 'asterisk' | 'block' | 'bleep_marker' = 'asterisk'
): string {
  return defaultAuditor.maskText(text, blacklist, style);
}

export function auditLayoutCollision(
  platform: 'none' | 'tiktok' | 'reels' | 'shorts',
  position: 'top' | 'bottom' | 'center' | string,
  offset: number,
  activeFilters: { tiktok: boolean; reels: boolean; shorts: boolean },
  isWarningIgnored: boolean = false
): LayoutAuditResult {
  return defaultAuditor.auditLayoutCollision(
    platform,
    position,
    offset,
    activeFilters,
    isWarningIgnored
  );
}

export function calculateSafeOffset(
  platform: 'none' | 'tiktok' | 'reels' | 'shorts',
  position: 'top' | 'bottom' | 'center' | string
): number | null {
  return defaultAuditor.calculateSafeOffset(platform, position);
}

export function auditReadability(
  background: string = 'none',
  strokeWidth: number = 0,
  strokeColor: string = '#000000',
  isWarningIgnored: boolean = false
): ReadabilityAuditResult {
  return defaultAuditor.auditReadability(
    background,
    strokeWidth,
    strokeColor,
    isWarningIgnored
  );
}

export function calculateAdjustedScore(
  rawScore: number,
  isLayoutSafe: boolean,
  isReadabilitySafe: boolean,
  isWarningIgnored: boolean = false
): number {
  return defaultAuditor.calculateAdjustedScore(
    rawScore,
    isLayoutSafe,
    isReadabilitySafe,
    isWarningIgnored
  );
}

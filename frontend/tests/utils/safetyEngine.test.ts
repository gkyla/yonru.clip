import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  areAuditResultsEqual,
  areCompiledPatternsEqual,
  areContentAuditsEqual,
  areFlaggedSegmentsEqual,
  areLayoutAuditsEqual,
  areLexicalMatchesEqual,
  areReadabilityAuditsEqual,
  ContentSafetyAuditor,
  createContentSafetyAuditor,
  getCompiledPattern,
  compileBlacklist,
  auditTranscript,
  maskText,
  auditLayoutCollision,
  calculateSafeOffset,
  auditReadability,
  calculateAdjustedScore,
  DEFAULT_BLEEP_PRESET,
  BUILTIN_BLEEP_PRESETS
} from '../../app/utils/safetyEngine';

describe('SafetyEngine Unit Tests', () => {
  describe('Pattern Compilation & Caching', () => {
    it('returns null for empty or whitespace-only patterns', () => {
      expect(getCompiledPattern('')).toBeNull();
      expect(getCompiledPattern('   ')).toBeNull();
    });

    it('compiles literal words with word-boundary regexes', () => {
      const p = getCompiledPattern('kill');
      expect(p).not.toBeNull();
      expect(p?.regex.test('kill')).toBe(true);
      expect(p?.regex.test('skill')).toBe(false);
    });

    it('compiles slash-enclosed regex patterns', () => {
      const p = getCompiledPattern('/bunuh/');
      expect(p).not.toBeNull();
      expect(p?.regex.test('membunuh')).toBe(true);
    });

    it('reuses cached pattern instances for identical inputs', () => {
      const p1 = getCompiledPattern('death');
      const p2 = getCompiledPattern('death');
      expect(p1).toBe(p2);
    });

    it('compiles array of blacklist words', () => {
      const compiled = compileBlacklist(['kill', 'death', '']);
      expect(compiled.length).toBe(2);
    });
  });

  describe('Transcript Auditing', () => {
    it('returns 100 with no flags for empty transcript or empty blacklist', () => {
      expect(auditTranscript([], ['kill'])).toEqual({
        score: 100,
        flaggedWords: [],
        flaggedSegments: [],
        uniqueFlagsCount: 0
      });
      expect(
        auditTranscript([{ text: 'hello', start: 0, duration: 1 }], [])
      ).toEqual({
        score: 100,
        flaggedWords: [],
        flaggedSegments: [],
        uniqueFlagsCount: 0
      });
    });

    it('accurately flags words with full padding offset', () => {
      const transcript = [{ text: 'a kill b', start: 0, duration: 3 }];
      const res = auditTranscript(transcript, ['kill'], 'word', 50, 'full');
      expect(res.flaggedWords).toContain('kill');
      expect(res.flaggedSegments).toEqual([
        { start: 0.95, duration: 1.1, word: 'kill', text: 'kill' }
      ]);
      expect(res.score).toBeLessThan(100);
    });

    it('always applies full word censorship boundaries for consistent protection', () => {
      const transcript = [{ text: 'mati', start: 2.0, duration: 1.0 }];
      const res = auditTranscript(transcript, ['mati'], 'word', 50, 'full');
      expect(res.flaggedWords).toContain('mati');
      expect(res.flaggedSegments).toEqual([
        { start: 1.95, duration: 1.1, word: 'mati', text: 'mati' }
      ]);
    });

    it('prioritizes Acoustic Word Map timestamps (words array) over linear duration division', () => {
      const transcript = [
        {
          text: 'kamu brengsek banget',
          start: 0,
          duration: 3.0,
          words: [
            { text: 'kamu', start: 0.2, duration: 0.3 },
            { text: 'brengsek', start: 0.8, duration: 0.6 },
            { text: 'banget', start: 1.8, duration: 0.5 }
          ]
        }
      ];
      // With 0 padding, should strictly match exact word boundaries [0.8, 0.6] rather than linear [1.0, 1.0]
      const res = auditTranscript(transcript, ['brengsek'], 'word', 0, 'full');
      expect(res.flaggedWords).toContain('brengsek');
      expect(res.flaggedSegments).toEqual([
        { start: 0.8, duration: 0.6, word: 'brengsek', text: 'brengsek' }
      ]);
    });

    it('treats visually masked words as Remediated Violations when audio bleep is enabled (retaining flaggedSegments and setting score=100)', () => {
      const auditor = new ContentSafetyAuditor({
        customBlacklist: ['brengsek'],
        audioBleepEnabled: true,
        bleepPaddingOffset: 0
      });

      const rawTranscript = [
        {
          text: 'kamu brengsek banget',
          start: 0,
          duration: 3.0,
          words: [
            { text: 'kamu', start: 0.2, duration: 0.3 },
            { text: 'brengsek', start: 0.8, duration: 0.6 },
            { text: 'banget', start: 1.8, duration: 0.5 }
          ]
        }
      ];

      // 1. Unmasked state: flaggedWords has 'brengsek', score is penalized
      const unmaskedReport = auditor.audit({
        transcript: rawTranscript,
        subtitleStrokeWidth: 4
      });
      expect(unmaskedReport.score).toBeLessThan(100);
      expect(unmaskedReport.flaggedWords).toContain('brengsek');
      expect(unmaskedReport.flaggedSegments.length).toBe(1);

      // 2. Masked state (Auto-Fix):
      const maskedTranscript = auditor.maskTranscript(rawTranscript);
      const maskedReport = auditor.audit({
        transcript: maskedTranscript,
        subtitleStrokeWidth: 4
      });

      // Score must be 100 (Safe) because it is remediated (masked + audio bleep enabled)
      expect(maskedReport.score).toBe(100);
      expect(maskedReport.flaggedWords).toEqual([]);
      expect(maskedReport.remediatedWords).toContain('brengsek');
      // Critical requirement: flaggedSegments MUST be retained for audio muting!
      expect(maskedReport.flaggedSegments).toEqual([
        { start: 0.8, duration: 0.6, word: 'brengsek', text: 'brengsek' }
      ]);

      // 3. If audioBleepEnabled is disabled, remediated status drops and score is penalized
      auditor.audioBleepEnabled = false;
      const unbleepedReport = auditor.audit({
        transcript: maskedTranscript,
        subtitleStrokeWidth: 4
      });
      expect(unbleepedReport.score).toBeLessThan(100);
      expect(unbleepedReport.flaggedWords).toContain('brengsek');

      // 4. Unmask / Revert: restores original transcript text
      const revertedTranscript = auditor.unmaskTranscript(maskedTranscript);
      expect(revertedTranscript[0]?.text).toBe('kamu brengsek banget');
      expect(revertedTranscript[0]?.words?.[1]?.text).toBe('brengsek');
    });
  });

  describe('Profanity Masking', () => {
    it('masks with asterisk style', () => {
      expect(maskText('kill', ['kill'], 'asterisk')).toBe('k*ll');
      expect(maskText('ab', ['ab'], 'asterisk')).toBe('a*');
      expect(maskText('a', ['a'], 'asterisk')).toBe('a');
    });

    it('masks with block style', () => {
      expect(maskText('kill', ['kill'], 'block')).toBe('****');
    });

    it('masks with bleep_marker style', () => {
      expect(maskText('stop the kill now', ['kill'], 'bleep_marker')).toBe(
        'stop the [BLEEP] now'
      );
    });

    it('handles empty input gracefully', () => {
      expect(maskText('', ['kill'])).toBe('');
      expect(maskText('hello', [])).toBe('hello');
    });
  });

  describe('Layout Safe-Zone Auditing', () => {
    const allActive = { tiktok: true, reels: true, shorts: true };

    it('returns safe when platform is none or warning ignored', () => {
      const resNone = auditLayoutCollision('none', 'top', 50, allActive, false);
      expect(resNone.isSafe).toBe(true);

      const resIgnored = auditLayoutCollision(
        'tiktok',
        'top',
        50,
        allActive,
        true
      );
      expect(resIgnored.isSafe).toBe(true);
    });

    it('detects top collision on TikTok header deadzone (<130px)', () => {
      const colliding = auditLayoutCollision('tiktok', 'top', 100, allActive);
      expect(colliding.isSafe).toBe(false);
      expect(colliding.collisionCount).toBe(1);
      expect(colliding.reason).toContain('130px');

      const safe = auditLayoutCollision('tiktok', 'top', 150, allActive);
      expect(safe.isSafe).toBe(true);
    });

    it('detects bottom collision on Reels controls deadzone (<350px)', () => {
      const colliding = auditLayoutCollision('reels', 'bottom', 300, allActive);
      expect(colliding.isSafe).toBe(false);
      expect(colliding.collisionCount).toBe(1);

      const safe = auditLayoutCollision('reels', 'bottom', 370, allActive);
      expect(safe.isSafe).toBe(true);
    });

    it('calculates optimal safe offsets', () => {
      expect(calculateSafeOffset('none', 'top')).toBeNull();
      expect(calculateSafeOffset('tiktok', 'top')).toBe(150);
      expect(calculateSafeOffset('reels', 'bottom')).toBe(370);
      expect(calculateSafeOffset('shorts', 'bottom')).toBe(300);
    });
  });

  describe('Readability & Contrast Auditing', () => {
    it('is safe when background is set', () => {
      const res = auditReadability('#000000', 0, 'none');
      expect(res.isSafe).toBe(true);
    });

    it('is safe when outline stroke is >= 2px and not transparent', () => {
      const res = auditReadability('none', 3, '#000000');
      expect(res.isSafe).toBe(true);
    });

    it('flags unsafe when neither background nor sufficient stroke exists', () => {
      const res = auditReadability('none', 1, '#000000');
      expect(res.isSafe).toBe(false);
      expect(res.reason).toContain('Low subtitle contrast');
    });

    it('bypasses check when warnings are ignored', () => {
      const res = auditReadability('none', 0, 'none', true);
      expect(res.isSafe).toBe(true);
    });
  });

  describe('Score Penalty Calculation', () => {
    it('applies penalties for layout (-15) and readability (-10)', () => {
      expect(calculateAdjustedScore(100, true, true, false)).toBe(100);
      expect(calculateAdjustedScore(100, false, true, false)).toBe(85);
      expect(calculateAdjustedScore(100, true, false, false)).toBe(90);
      expect(calculateAdjustedScore(100, false, false, false)).toBe(75);
    });

    it('clamps adjusted score to 0 minimum', () => {
      expect(calculateAdjustedScore(10, false, false, false)).toBe(0);
    });

    it('returns 100 when warnings are ignored', () => {
      expect(calculateAdjustedScore(50, false, false, true)).toBe(100);
    });
  });

  describe('ContentSafetyAuditor Deep Engine Methods', () => {
    let auditor: ContentSafetyAuditor;

    beforeEach(() => {
      auditor = createContentSafetyAuditor();
    });

    it('compiles effective blacklist respecting category toggles and whitelist', () => {
      auditor.customBlacklist = ['custombadword'];
      auditor.customWhitelist = ['kill'];

      const effective = auditor.getEffectiveBlacklist();
      expect(effective).toContain('custombadword');
      expect(effective).not.toContain('kill');
      expect(effective).toContain('murder');
    });

    it('filters non-severe words when standard sensitivity is active regardless of audio bleeping', () => {
      auditor.safetySensitivity = 'standard';
      auditor.audioBleepEnabled = false;

      let effective = auditor.getEffectiveBlacklist();
      expect(effective).toContain('murder'); // severe word
      expect(effective).not.toContain('crash'); // mild word in violence category

      auditor.audioBleepEnabled = true;
      effective = auditor.getEffectiveBlacklist();
      expect(effective).toContain('murder');
      expect(effective).not.toContain('crash');
    });

    it('uses all category words when strict sensitivity is active', () => {
      auditor.safetySensitivity = 'strict';
      const effective = auditor.getEffectiveBlacklist();
      expect(effective).toContain('crash');
      expect(effective).toContain('murder');
    });

    it('evaluates comprehensive 3-pillar audit report in a single call', () => {
      const report = auditor.audit({
        transcript: [{ text: 'this is murder', start: 0, duration: 2 }],
        activeSafeZone: 'tiktok',
        subtitlePosition: 'bottom',
        subtitleOffset: 100, // Collides with bottom 250px deadzone
        subtitleBackground: 'none',
        subtitleStrokeWidth: 0 // Collides with readability
      });

      expect(report.score).toBeLessThan(80);
      expect(report.flaggedWords).toContain('murder');
      expect(report.isLayoutSafe).toBe(false);
      expect(report.isReadabilitySafe).toBe(false);
    });

    it('masks entire transcript array using maskTranscript()', () => {
      auditor.customBlacklist = ['danger'];
      const masked = auditor.maskTranscript([
        { text: 'this is danger zone', start: 0, duration: 2 }
      ]);
      expect(masked[0]?.text).toBe('this is d*nger zone');
    });

    it('manages bleep audio preset library lifecycle', () => {
      expect(auditor.bleepLibrary.length).toBeGreaterThanOrEqual(
        BUILTIN_BLEEP_PRESETS.length
      );
      expect(auditor.selectedBleepAudioId).toBe(DEFAULT_BLEEP_PRESET.id);

      // Add custom bleep
      const custom = auditor.addCustomBleepFile({
        name: 'My Bleep',
        data: 'data:audio/mp3;base64,123'
      });
      expect(auditor.selectedBleepAudioId).toBe(custom.id);
      expect(auditor.customBleepFile?.name).toBe('My Bleep');

      // Select preset
      expect(auditor.selectBleepAudio('default_preset')).toBe(true);
      expect(auditor.selectedBleepAudioId).toBe('default_preset');

      // Remove custom bleep
      expect(auditor.removeCustomBleepFile(custom.id)).toBe(true);
      expect(auditor.bleepLibrary.some(item => item.id === custom.id)).toBe(
        false
      );
    });

    it('initializes with default bleepPaddingOffset of 0ms', () => {
      const fresh = createContentSafetyAuditor();
      expect(fresh.bleepPaddingOffset).toBe(0);
    });

    it('exports and hydrates state cleanly', () => {
      auditor.customBlacklist = ['testword'];
      auditor.bleepPaddingOffset = 80;
      auditor.bleepMode = 'partial_end';

      const exported = auditor.exportState();
      const freshAuditor = createContentSafetyAuditor();
      freshAuditor.hydrate(exported);

      expect(freshAuditor.customBlacklist).toEqual(['testword']);
      expect(freshAuditor.bleepPaddingOffset).toBe(80);
      expect(freshAuditor.bleepMode).toBe('partial_end');
    });

    it('serializes and hydrates with mock localStorage', () => {
      const storageMap = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => storageMap.get(k) || null,
        setItem: (k: string, v: string) => {
          storageMap.set(k, v);
        },
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        clear: () => {
          storageMap.clear();
        },
        key: () => null,
        length: 0
      } as Storage;

      auditor.customBlacklist = ['persisted_bad_word'];
      auditor.serializeToStorage(mockStorage);

      const reloadedAuditor = createContentSafetyAuditor();
      reloadedAuditor.hydrateFromStorage(mockStorage);

      expect(reloadedAuditor.customBlacklist).toContain('persisted_bad_word');
    });
  });

  describe('Modular Lexical Stages & Scan Optimization', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('runs RegExp.prototype.test once per pattern on unmasked words where text matches rawText', () => {
      const auditor = createContentSafetyAuditor();
      const patterns = auditor.compileBlacklist(['kill', 'murder', 'bomb']);
      const transcript = [
        {
          text: 'hello clean transcript world',
          start: 0,
          duration: 2,
          words: [
            { text: 'hello', start: 0, duration: 0.4 },
            { text: 'clean', start: 0.4, duration: 0.4 },
            { text: 'transcript', start: 0.8, duration: 0.6 },
            { text: 'world', start: 1.4, duration: 0.6 }
          ]
        }
      ];

      const testSpy = vi.spyOn(RegExp.prototype, 'test');
      const matches = auditor.scanTranscriptMatches(transcript, patterns);

      expect(matches).toEqual([]);
      // 4 words x 3 patterns = 12 checks (previously 24 due to redundant lowerVisual test)
      expect(testSpy).toHaveBeenCalledTimes(12);
    });

    it('detects masked words via rawText even when visual text is masked', () => {
      const auditor = createContentSafetyAuditor();
      const patterns = auditor.compileBlacklist(['kill']);
      const transcript = [
        {
          text: 'do not k*ll',
          rawText: 'do not kill',
          start: 0,
          duration: 1.5,
          words: [
            { text: 'do', start: 0, duration: 0.3 },
            { text: 'not', start: 0.3, duration: 0.3 },
            {
              text: 'k*ll',
              rawText: 'kill',
              isMasked: true,
              start: 0.6,
              duration: 0.9
            }
          ]
        }
      ];

      const matches = auditor.scanTranscriptMatches(transcript, patterns);
      expect(matches).toEqual([
        {
          start: 0.6,
          duration: 0.9,
          word: 'kill',
          text: 'kill',
          isVisualMasked: true
        }
      ]);
    });

    it('compiles blacklist patterns only once across multi-segment transcripts in maskTranscript()', () => {
      const auditor = createContentSafetyAuditor({
        customBlacklist: ['danger', 'risk']
      });
      const compileSpy = vi.spyOn(auditor, 'compileBlacklist');

      const transcript = [
        {
          text: 'high danger here',
          start: 0,
          duration: 2,
          words: [
            { text: 'high', start: 0, duration: 0.5 },
            { text: 'danger', start: 0.5, duration: 0.8 },
            { text: 'here', start: 1.3, duration: 0.7 }
          ]
        },
        {
          text: 'big risk there',
          start: 2,
          duration: 2,
          words: [
            { text: 'big', start: 2, duration: 0.5 },
            { text: 'risk', start: 2.5, duration: 0.8 },
            { text: 'there', start: 3.3, duration: 0.7 }
          ]
        }
      ];

      const masked = auditor.maskTranscript(transcript);
      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(masked[0]?.text).toBe('high d*nger here');
      expect(masked[0]?.words?.[1]?.text).toBe('d*nger');
      expect(masked[1]?.text).toBe('big r*sk there');
    });

    it('preserves flaggedSegments reference across evaluateLexicalMatches() and matches composeSafetyReport() with audit()', () => {
      const auditor = createContentSafetyAuditor({
        customBlacklist: ['brengsek'],
        bleepPaddingOffset: 50
      });
      const transcript = [
        {
          text: 'kamu b*engsek',
          rawText: 'kamu brengsek',
          start: 1,
          duration: 2,
          words: [
            { text: 'kamu', start: 1, duration: 0.5 },
            {
              text: 'b*engsek',
              rawText: 'brengsek',
              isMasked: true,
              start: 1.5,
              duration: 1
            }
          ]
        }
      ];

      const patterns = auditor.compileBlacklist(
        auditor.getEffectiveBlacklist()
      );
      const matches = auditor.scanTranscriptMatches(transcript, patterns);
      const segments = auditor.buildFlaggedSegments(matches, 50);

      const enabledEval = auditor.evaluateLexicalMatches(
        matches,
        segments,
        true
      );
      const disabledEval = auditor.evaluateLexicalMatches(
        matches,
        segments,
        false
      );

      expect(enabledEval.flaggedSegments).toBe(segments);
      expect(disabledEval.flaggedSegments).toBe(segments);
      expect(enabledEval.score).toBe(100);
      expect(enabledEval.remediatedWords).toContain('brengsek');
      expect(disabledEval.score).toBeLessThan(100);
      expect(disabledEval.flaggedWords).toContain('brengsek');

      const layout = auditor.auditLayoutCollision('tiktok', 'bottom', 100);
      const readability = auditor.auditReadability('none', 0, '#000000');
      const composed = auditor.composeSafetyReport(
        disabledEval,
        layout,
        readability,
        false
      );
      const direct = auditor.audit({
        transcript,
        activeSafeZone: 'tiktok',
        subtitlePosition: 'bottom',
        subtitleOffset: 100,
        subtitleBackground: 'none',
        subtitleStrokeWidth: 0,
        subtitleStrokeColor: '#000000',
        isWarningIgnored: false,
        audioBleepEnabled: false
      });

      expect(composed.score).toBe(direct.score);
      expect(composed.flaggedWords).toEqual(direct.flaggedWords);
      expect(composed.flaggedSegments).toEqual(direct.flaggedSegments);

      const ignoredComposed = auditor.composeSafetyReport(
        disabledEval,
        layout,
        readability,
        true
      );
      expect(ignoredComposed.score).toBe(100);
      expect(ignoredComposed.flaggedSegments).toBe(segments);
    });
  });

  describe('Reference-Stability Equality Helpers', () => {
    it('compares CompiledPattern, LexicalMatch, and FlaggedSegment slices accurately', () => {
      const p1 = getCompiledPattern('kill')!;
      const p2 = getCompiledPattern('murder')!;
      expect(areCompiledPatternsEqual([p1, p2], [p1, p2])).toBe(true);
      expect(areCompiledPatternsEqual([p1], [p2])).toBe(false);
      expect(areCompiledPatternsEqual([p1], [p1, p2])).toBe(false);

      const m1 = {
        start: 1,
        duration: 0.5,
        word: 'kill',
        text: 'kill',
        isVisualMasked: false
      };
      expect(areLexicalMatchesEqual([m1], [{ ...m1 }])).toBe(true);
      expect(
        areLexicalMatchesEqual([m1], [{ ...m1, isVisualMasked: true }])
      ).toBe(false);
      expect(areLexicalMatchesEqual([m1], [{ ...m1, text: 'k*ll' }])).toBe(
        false
      );

      const s1 = { start: 1, duration: 0.5, word: 'kill', text: 'kill' };
      expect(areFlaggedSegmentsEqual([s1], [{ ...s1 }])).toBe(true);
      expect(areFlaggedSegmentsEqual([s1], [{ ...s1, duration: 0.7 }])).toBe(
        false
      );
    });

    it('compares AuditResult, LayoutAuditResult, ReadabilityAuditResult, and ContentAuditSnapshot values', () => {
      const seg = { start: 1, duration: 0.5, word: 'kill', text: 'kill' };
      const auditA = {
        score: 100,
        flaggedWords: [],
        flaggedSegments: [seg],
        uniqueFlagsCount: 1,
        remediatedWords: ['kill'],
        remediatedSegments: [{ ...seg }]
      };
      const auditB = {
        score: 100,
        flaggedWords: [],
        flaggedSegments: [{ ...seg }],
        uniqueFlagsCount: 1,
        remediatedWords: ['kill'],
        remediatedSegments: [{ ...seg }]
      };

      expect(areAuditResultsEqual(auditA, auditB)).toBe(true);
      expect(areAuditResultsEqual(auditA, { ...auditB, score: 88 })).toBe(
        false
      );
      expect(
        areAuditResultsEqual(auditA, {
          ...auditB,
          remediatedWords: ['murder']
        })
      ).toBe(false);
      expect(
        areAuditResultsEqual(auditA, {
          ...auditB,
          remediatedSegments: undefined
        })
      ).toBe(false);

      const layout = { isSafe: true, reason: 'ok', collisionCount: 0 };
      expect(areLayoutAuditsEqual(layout, { ...layout })).toBe(true);
      expect(
        areLayoutAuditsEqual(layout, { ...layout, collisionCount: 1 })
      ).toBe(false);

      const readability = { isSafe: false, reason: 'low contrast' };
      expect(areReadabilityAuditsEqual(readability, { ...readability })).toBe(
        true
      );
      expect(
        areReadabilityAuditsEqual(readability, { ...readability, isSafe: true })
      ).toBe(false);

      const snapA = {
        score: 100,
        flaggedWords: [],
        flaggedSegments: [seg],
        uniqueFlagsCount: 1,
        remediatedWords: ['kill'],
        remediatedSegments: [{ ...seg }],
        isRemediated: true
      };
      expect(areContentAuditsEqual(snapA, { ...snapA })).toBe(true);
      expect(
        areContentAuditsEqual(snapA, { ...snapA, isRemediated: false })
      ).toBe(false);
      expect(
        areContentAuditsEqual(snapA, {
          ...snapA,
          remediatedWords: ['other']
        })
      ).toBe(false);
    });
  });
});

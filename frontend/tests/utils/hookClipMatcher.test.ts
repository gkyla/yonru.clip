import { describe, it, expect } from 'vitest';
import {
  findMatchingClip,
  isHookRendered,
  HookClipMatcher
} from '../../app/utils/hookClipMatcher';
import type { Hook, ReadyClip } from '../../app/types/clipper';

describe('HookClipMatcher Domain Engine (TDD)', () => {
  const sampleFolder = 'test-folder-123';

  const baseHook: Hook = {
    start: 10,
    end: 25,
    theme: 'Viral Coding Tips',
    virality_score: 95
  };

  describe('findMatchingClip', () => {
    it('returns undefined if hook is null or undefined', () => {
      expect(findMatchingClip(null, [], sampleFolder)).toBeUndefined();
      expect(findMatchingClip(undefined, [], sampleFolder)).toBeUndefined();
    });

    it('returns undefined if readyClips is empty, null, or undefined', () => {
      expect(findMatchingClip(baseHook, [], sampleFolder)).toBeUndefined();
      expect(findMatchingClip(baseHook, null, sampleFolder)).toBeUndefined();
      expect(
        findMatchingClip(baseHook, undefined, sampleFolder)
      ).toBeUndefined();
    });

    it('returns undefined if folderName is missing or mismatched', () => {
      const clips: ReadyClip[] = [
        { folder_name: 'other-folder', clip_id: '8_25_clip' }
      ];
      expect(findMatchingClip(baseHook, clips, '')).toBeUndefined();
      expect(findMatchingClip(baseHook, clips, null)).toBeUndefined();
      expect(findMatchingClip(baseHook, clips, sampleFolder)).toBeUndefined();
    });

    it('ignores clips with malformed or non-numeric clip_id timestamps', () => {
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: 'invalid' },
        { folder_name: sampleFolder, clip_id: 'abc_def_clip' },
        { folder_name: sampleFolder, clip_id: '10_notanumber_clip' },
        { folder_name: sampleFolder, clip_id: 'nan_25_clip' }
      ];
      expect(findMatchingClip(baseHook, clips, sampleFolder)).toBeUndefined();
    });

    it('matches clip using custom safetyBuffer interval calculation within 1.5s tolerance', () => {
      // hook: start: 10, end: 25, safetyBuffer: 3.0 -> expectedStart: 7, expectedEnd: 25
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '7_25_custom_buffer' }
      ];
      const match = findMatchingClip(baseHook, clips, sampleFolder, 3.0);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('7_25_custom_buffer');
    });

    it('matches clip using default 2.0s safetyBuffer interval calculation', () => {
      // hook: start: 10, end: 25 -> expectedStartDefault: 8, expectedEnd: 25
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '8_25_default_buffer' }
      ];
      // Even if custom safetyBuffer is set to 5.0, default 2.0 fallback still matches
      const match = findMatchingClip(baseHook, clips, sampleFolder, 5.0);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('8_25_default_buffer');
    });

    it('matches clip using zero safetyBuffer interval calculation', () => {
      // hook: start: 10, end: 25 -> expectedStartNone: 10, expectedEnd: 25
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '10_25_zero_buffer' }
      ];
      const match = findMatchingClip(baseHook, clips, sampleFolder, 5.0);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('10_25_zero_buffer');
    });

    it('handles hook starting near 0 where Math.max(0, start - buffer) clamps to 0', () => {
      const nearZeroHook: Hook = { start: 1, end: 15, theme: 'Intro' };
      // buffer 2.0 -> Math.max(0, 1 - 2) = 0
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '0_15_intro' }
      ];
      const match = findMatchingClip(nearZeroHook, clips, sampleFolder, 2.0);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('0_15_intro');
    });

    it('matches clip when duration overlap ratio is >= 80%', () => {
      // hook duration = 25 - 10 = 15s. 80% is 12s.
      // Clip from 11 to 24 gives overlap 13s (13 / 15 = 86.6%)
      // Neither interval match fires because abs(11 - 8) = 3 >= 1.5 and abs(11 - 10) = 1, but abs(24 - 25) = 1...
      // Let's craft clip: cStart: 12, cEnd: 25.
      // expectedStart(8): abs(12-8) = 4 >= 1.5; expectedStartDefault(8): 4; expectedStartNone(10): abs(12-10) = 2 >= 1.5
      // Overlap: min(25, 25) - max(12, 10) = 25 - 12 = 13s. Overlap ratio = 13/15 = 86.6% >= 80%
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '12_25_overlap_clip' }
      ];
      const match = findMatchingClip(baseHook, clips, sampleFolder);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('12_25_overlap_clip');
    });

    it('rejects clip when overlap ratio is less than 80%', () => {
      // hook duration = 15s. Clip from 15 to 25 gives overlap 10s (10/15 = 66.6% < 80%)
      // and interval differences: cStart=15, expected=8/10 (diff >= 5)
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '15_25_insufficient_overlap' }
      ];
      const match = findMatchingClip(baseHook, clips, sampleFolder);
      expect(match).toBeUndefined();
    });

    it('rejects clip when hook duration is zero or negative', () => {
      const invalidHook: Hook = { start: 20, end: 15, theme: 'Negative' };
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '10_20_clip' }
      ];
      expect(
        findMatchingClip(invalidHook, clips, sampleFolder)
      ).toBeUndefined();
    });

    it('matches clip using normalized theme slug when timestamps do not match', () => {
      // Timestamp far away: cStart: 50, cEnd: 60 (diff > 20s, 0 overlap)
      // Theme has punctuation, spaces, uppercase
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '50_60_viral_coding_tips_clip' }
      ];
      const match = findMatchingClip(baseHook, clips, sampleFolder);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('50_60_viral_coding_tips_clip');
    });

    it('matches clip when hook theme is substring of clip theme or vice versa', () => {
      const longHook: Hook = {
        start: 100,
        end: 120,
        theme: 'Advanced TypeScript Masterclass & Architecture'
      };
      const clips: ReadyClip[] = [
        {
          folder_name: sampleFolder,
          clip_id: '0_10_advanced_typescript_masterclass'
        }
      ];
      const match = findMatchingClip(longHook, clips, sampleFolder);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('0_10_advanced_typescript_masterclass');
    });

    it('ignores theme matching if clip_id has fewer than 3 parts or themes are empty', () => {
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '50_60' }
      ];
      expect(findMatchingClip(baseHook, clips, sampleFolder)).toBeUndefined();

      const hookWithoutTheme: Hook = { start: 100, end: 120, theme: '   ' };
      const clips2: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '50_60_empty_theme' }
      ];
      expect(
        findMatchingClip(hookWithoutTheme, clips2, sampleFolder)
      ).toBeUndefined();
    });

    it('returns undefined if hook start or end is NaN', () => {
      const nanHook = { start: NaN, end: 20, theme: 'NaN' } as Hook;
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '8_20_clip' }
      ];
      expect(findMatchingClip(nanHook, clips, sampleFolder)).toBeUndefined();
    });

    it('supports string representation of start and end in hook', () => {
      const stringHook = {
        start: '10' as any,
        end: '25' as any,
        theme: 'String Hook'
      } as Hook;
      const clips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '8_25_string_clip' }
      ];
      const match = findMatchingClip(stringHook, clips, sampleFolder);
      expect(match).toBeDefined();
      expect(match?.clip_id).toBe('8_25_string_clip');
    });
  });

  describe('isHookRendered', () => {
    const readyClips: ReadyClip[] = [
      { folder_name: sampleFolder, clip_id: '8_25_rendered_clip' }
    ];

    it('returns false when hook is null or undefined', () => {
      expect(isHookRendered(null, readyClips, sampleFolder)).toBe(false);
      expect(isHookRendered(undefined, readyClips, sampleFolder)).toBe(false);
    });

    it('returns false when active extraction is running and hook matches activeHook within 0.1s', () => {
      const activeHook: Hook = {
        start: 10.05,
        end: 24.95,
        theme: 'Extracting Now'
      };
      const rendered = isHookRendered(
        baseHook,
        readyClips,
        sampleFolder,
        'cutting',
        activeHook,
        'other_clip'
      );
      expect(rendered).toBe(false);
    });

    it('supports string timestamps for activeHook and hook comparison', () => {
      const activeHook = {
        start: '10.02' as any,
        end: '25.01' as any,
        theme: 'String Active'
      } as Hook;
      const hook = {
        start: '10.00' as any,
        end: '25.00' as any,
        theme: 'String Hook'
      } as Hook;
      const rendered = isHookRendered(
        hook,
        readyClips,
        sampleFolder,
        'transcribing',
        activeHook
      );
      expect(rendered).toBe(false);
    });

    it('returns false when active extraction is running and clipId matches matchingClip.clip_id', () => {
      const otherActiveHook: Hook = { start: 99, end: 110, theme: 'Other' };
      const rendered = isHookRendered(
        baseHook,
        readyClips,
        sampleFolder,
        'queued',
        otherActiveHook,
        '8_25_rendered_clip' // matches clip_id
      );
      expect(rendered).toBe(false);
    });

    it('returns false when no matching clip is found', () => {
      const unrenderedHook: Hook = {
        start: 100,
        end: 120,
        theme: 'Unrendered'
      };
      expect(isHookRendered(unrenderedHook, readyClips, sampleFolder)).toBe(
        false
      );
    });

    it('returns true when matching clip exists and job is ready/idle', () => {
      const rendered = isHookRendered(
        baseHook,
        readyClips,
        sampleFolder,
        'ready',
        null,
        null
      );
      expect(rendered).toBe(true);
    });

    it('returns true when active extraction is running for an unrelated hook and unrelated clipId', () => {
      const unrelatedActiveHook: Hook = {
        start: 99,
        end: 110,
        theme: 'Unrelated'
      };
      const rendered = isHookRendered(
        baseHook,
        readyClips,
        sampleFolder,
        'cutting',
        unrelatedActiveHook,
        'unrelated_clip_id'
      );
      expect(rendered).toBe(true);
    });
  });

  describe('HookClipMatcher Class Encapsulation', () => {
    const readyClips: ReadyClip[] = [
      { folder_name: sampleFolder, clip_id: '8_25_class_clip' }
    ];

    it('provides static findMatchingClip and isHookRendered methods', () => {
      const match = HookClipMatcher.findMatchingClip(
        baseHook,
        readyClips,
        sampleFolder
      );
      expect(match?.clip_id).toBe('8_25_class_clip');

      const rendered = HookClipMatcher.isHookRendered(
        baseHook,
        readyClips,
        sampleFolder,
        'ready'
      );
      expect(rendered).toBe(true);
    });

    it('provides instance methods with bound context', () => {
      const matcher = new HookClipMatcher({
        readyClips,
        folderName: sampleFolder,
        safetyBuffer: 2.0,
        jobStatus: 'ready'
      });

      const match = matcher.findMatchingClip(baseHook);
      expect(match?.clip_id).toBe('8_25_class_clip');

      const rendered = matcher.isHookRendered(baseHook);
      expect(rendered).toBe(true);

      // Test overrideBuffer
      const customClips: ReadyClip[] = [
        { folder_name: sampleFolder, clip_id: '5_25_custom' }
      ];
      const customMatcher = new HookClipMatcher({
        readyClips: customClips,
        folderName: sampleFolder,
        safetyBuffer: 2.0,
        jobStatus: 'ready'
      });
      // default 2.0 safetyBuffer gives expected 8_25, so 5_25 doesn't match default buffer without override
      // but with overrideBuffer = 5.0 (10 - 5 = 5), expected is 5_25:
      expect(customMatcher.findMatchingClip(baseHook, 5.0)?.clip_id).toBe(
        '5_25_custom'
      );
      expect(customMatcher.isHookRendered(baseHook, 5.0)).toBe(true);
    });

    it('handles empty constructor without options gracefully', () => {
      const emptyMatcher = new HookClipMatcher();
      expect(emptyMatcher.findMatchingClip(baseHook)).toBeUndefined();
      expect(emptyMatcher.isHookRendered(baseHook)).toBe(false);
    });
  });
});

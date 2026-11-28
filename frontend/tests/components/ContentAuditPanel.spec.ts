import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import ContentAuditPanel from '../../app/components/ContentAuditPanel.vue';

const mockContentAudit = ref({
  score: 88,
  flaggedWords: ['kill'],
  flaggedSegments: [{ start: 1, duration: 0.5, word: 'kill', text: 'kill' }],
  uniqueFlagsCount: 1,
  remediatedWords: [] as string[],
  remediatedSegments: [],
  isRemediated: false
});

const mockLayoutAudit = ref({
  isSafe: true,
  reason: 'Subtitles are placed in a safe layout zone.',
  collisionCount: 0
});

const mockReadabilityAudit = ref({
  isSafe: true,
  reason: 'Subtitle readability is secured.'
});

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    contentAudit: mockContentAudit,
    layoutAudit: mockLayoutAudit,
    readabilityAudit: mockReadabilityAudit,
    isWarningIgnored: ref(false),
    ignoreSafetyWarnings: vi.fn(),
    restoreSafetyWarnings: vi.fn(),
    fitSubtitlesToSafeZone: vi.fn(),
    fitSubtitlesToReadability: vi.fn(),
    maskFlaggedWords: vi.fn(),
    revertMaskedWords: vi.fn()
  })
}));

describe('ContentAuditPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log to console on mount or when contentAudit updates', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const wrapper = mount(ContentAuditPanel, {
      props: { expanded: true },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    expect(wrapper.text()).toContain('Content Safety Audit');
    expect(logSpy).not.toHaveBeenCalled();

    mockContentAudit.value = {
      score: 100,
      flaggedWords: [],
      flaggedSegments: [],
      uniqueFlagsCount: 0,
      remediatedWords: [],
      remediatedSegments: [],
      isRemediated: false
    };
    await nextTick();

    expect(logSpy).not.toHaveBeenCalled();
  });
});

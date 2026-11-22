import type {
  HookDiscoveryModelId,
  HookDiscoveryModelOption
} from '../types/clipper';

export const DEFAULT_HOOK_DISCOVERY_MODEL: HookDiscoveryModelId =
  'gemini-3.5-flash-lite';

export const HOOK_DISCOVERY_MODELS: readonly HookDiscoveryModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    providerLabel: 'Gemini',
    name: 'Gemini 3.5 Flash-Lite',
    shortLabel: '3.5 LITE',
    tier: 'Default',
    speedNote: 'Fastest',
    quotaNote: 'Highest free-tier allowance',
    desc: 'Fastest response with the highest free-tier daily allowance. Best default for everyday clipping.'
  },
  {
    id: 'gemini-3.6-flash',
    provider: 'gemini',
    providerLabel: 'Gemini',
    name: 'Gemini 3.6 Flash',
    shortLabel: '3.6 FLASH',
    tier: 'Balanced',
    speedNote: 'Fast',
    quotaNote: 'Moderate free-tier allowance',
    desc: 'Stronger narrative reasoning for nuanced dialogue, with a moderate free-tier daily allowance.'
  },
  {
    id: 'gemini-3.8-flash',
    provider: 'gemini',
    providerLabel: 'Gemini',
    name: 'Gemini 3.8 Flash',
    shortLabel: '3.8 FLASH',
    tier: 'Highest Quality',
    speedNote: 'Deliberate',
    quotaNote: 'Strictest free-tier daily cap',
    desc: 'Deepest hook reasoning for complex long-form discussions, with the strictest free-tier daily cap.'
  }
];

const DEFAULT_MODEL_OPTION: HookDiscoveryModelOption = {
  id: 'gemini-3.5-flash-lite',
  provider: 'gemini',
  providerLabel: 'Gemini',
  name: 'Gemini 3.5 Flash-Lite',
  shortLabel: '3.5 LITE',
  tier: 'Default',
  speedNote: 'Fastest',
  quotaNote: 'Highest free-tier allowance',
  desc: 'Fastest response with the highest free-tier daily allowance. Best default for everyday clipping.'
};

export function isHookDiscoveryModelId(
  value: unknown
): value is HookDiscoveryModelId {
  return (
    typeof value === 'string' && HOOK_DISCOVERY_MODELS.some(m => m.id === value)
  );
}

export function normalizeHookDiscoveryModel(
  rawModel: string | null | undefined
): HookDiscoveryModelId {
  if (!rawModel) return DEFAULT_HOOK_DISCOVERY_MODEL;
  const cleaned = rawModel.trim().replace(/^["']|["']$/g, '');
  if (!cleaned || cleaned === 'gemini-2.5-flash') {
    return DEFAULT_HOOK_DISCOVERY_MODEL;
  }
  return isHookDiscoveryModelId(cleaned)
    ? cleaned
    : DEFAULT_HOOK_DISCOVERY_MODEL;
}

export function getHookDiscoveryModelOption(
  rawModel: string | null | undefined
): HookDiscoveryModelOption {
  const normalized = normalizeHookDiscoveryModel(rawModel);
  return (
    HOOK_DISCOVERY_MODELS.find(m => m.id === normalized) ?? DEFAULT_MODEL_OPTION
  );
}

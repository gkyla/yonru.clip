import { isPrerequisiteMissing } from '../utils/systemDiagnostics';
import type { SystemHealth } from '../utils/systemDiagnostics';
import type { HardwareProfile, HookDiscoveryModelId } from '../types/clipper';
import {
  DEFAULT_HOOK_DISCOVERY_MODEL,
  normalizeHookDiscoveryModel
} from '../utils/hookDiscoveryModels';

export const useSystemDiagnostics = () => {
  const API_BASE = resolveApiBase();

  const systemHealth = useState<SystemHealth | null>(
    'systemHealth',
    () => null
  );
  const checkingHealth = useState<boolean>('checkingHealth', () => false);
  const healthError = useState<string | null>('healthError', () => null);
  const settingsScrollTarget = useState<string | null>(
    'settingsScrollTarget',
    () => null
  );
  const geminiModel = useState<HookDiscoveryModelId>(
    'geminiModel',
    () => DEFAULT_HOOK_DISCOVERY_MODEL
  );

  const hardwareProfile = useState<HardwareProfile | null>(
    'hardwareProfile',
    () => null
  );
  const detectingHardware = useState<boolean>('detectingHardware', () => false);
  const hardwareError = useState<string | null>('hardwareError', () => null);

  const isAnyPrerequisiteMissing = computed(() => {
    return isPrerequisiteMissing(systemHealth.value);
  });

  // Initialize cached hardware profile from localStorage on client
  if (import.meta.client && !hardwareProfile.value) {
    try {
      const cached = localStorage.getItem('yonru_hardware_profile');
      if (cached) {
        hardwareProfile.value = JSON.parse(cached);
      }
    } catch {
      // ignore JSON parse or storage errors
    }
  }

  async function checkSystemHealth() {
    checkingHealth.value = true;
    healthError.value = null;
    try {
      const res = await $fetch<SystemHealth>(`${API_BASE}/api/system-health`);
      if (
        !res ||
        typeof res !== 'object' ||
        !('ffmpeg' in res) ||
        !('python_env' in res)
      ) {
        healthError.value =
          'Could not check system tools right now. Make sure the local app service is running and try again.';
        return;
      }
      systemHealth.value = res;
      if (res?.gemini_api?.model) {
        geminiModel.value = normalizeHookDiscoveryModel(res.gemini_api.model);
      }
    } catch (e) {
      console.error('Failed to fetch system health', e);
      healthError.value =
        'Could not check system tools right now. Make sure the local app service is running and try again.';
    } finally {
      checkingHealth.value = false;
    }
  }

  async function detectHardwareProfile(): Promise<HardwareProfile | null> {
    detectingHardware.value = true;
    hardwareError.value = null;
    try {
      const res = await $fetch<HardwareProfile>(
        `${API_BASE}/api/system/hardware-profile`
      );
      hardwareProfile.value = res;
      if (import.meta.client) {
        localStorage.setItem('yonru_hardware_profile', JSON.stringify(res));
      }
      return res;
    } catch (e) {
      console.error('Failed to detect hardware profile', e);
      hardwareError.value =
        'Could not detect hardware capabilities right now. Make sure the local app service is running and try again.';
      return null;
    } finally {
      detectingHardware.value = false;
    }
  }

  return {
    systemHealth,
    checkingHealth,
    healthError,
    settingsScrollTarget,
    geminiModel,
    isAnyPrerequisiteMissing,
    checkSystemHealth,
    hardwareProfile,
    detectingHardware,
    hardwareError,
    detectHardwareProfile
  };
};

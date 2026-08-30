import { isPrerequisiteMissing } from '../utils/systemDiagnostics'
import type { SystemHealth } from '../utils/systemDiagnostics'
import type { HardwareProfile } from '../types/clipper'

export const useSystemDiagnostics = () => {
  const API_BASE = 'http://localhost:8000'

  const systemHealth = useState<SystemHealth | null>('systemHealth', () => null)
  const checkingHealth = useState<boolean>('checkingHealth', () => false)
  const settingsScrollTarget = useState<string | null>('settingsScrollTarget', () => null)

  const hardwareProfile = useState<HardwareProfile | null>('hardwareProfile', () => null)
  const detectingHardware = useState<boolean>('detectingHardware', () => false)

  const isAnyPrerequisiteMissing = computed(() => {
    return isPrerequisiteMissing(systemHealth.value)
  })

  // Initialize cached hardware profile from localStorage on client
  if (import.meta.client && !hardwareProfile.value) {
    try {
      const cached = localStorage.getItem('yonru_hardware_profile')
      if (cached) {
        hardwareProfile.value = JSON.parse(cached)
      }
    } catch {
      // ignore JSON parse or storage errors
    }
  }

  async function checkSystemHealth() {
    checkingHealth.value = true
    try {
      const res = await $fetch<SystemHealth>(`${API_BASE}/api/system-health`)
      systemHealth.value = res
    } catch (e) {
      console.error('Failed to fetch system health', e)
    } finally {
      checkingHealth.value = false
    }
  }

  async function detectHardwareProfile(): Promise<HardwareProfile | null> {
    detectingHardware.value = true
    try {
      const res = await $fetch<HardwareProfile>(`${API_BASE}/api/system/hardware-profile`)
      hardwareProfile.value = res
      if (import.meta.client) {
        localStorage.setItem('yonru_hardware_profile', JSON.stringify(res))
      }
      return res
    } catch (e) {
      console.error('Failed to detect hardware profile', e)
      return null
    } finally {
      detectingHardware.value = false
    }
  }

  return {
    systemHealth,
    checkingHealth,
    settingsScrollTarget,
    isAnyPrerequisiteMissing,
    checkSystemHealth,
    hardwareProfile,
    detectingHardware,
    detectHardwareProfile
  }
}

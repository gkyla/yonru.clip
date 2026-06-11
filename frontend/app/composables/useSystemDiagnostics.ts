import { isPrerequisiteMissing } from '../utils/systemDiagnostics'
import type { SystemHealth } from '../utils/systemDiagnostics'

export const useSystemDiagnostics = () => {
  const API_BASE = 'http://localhost:8000'

  const systemHealth = useState<SystemHealth | null>('systemHealth', () => null)
  const checkingHealth = useState<boolean>('checkingHealth', () => false)
  const settingsScrollTarget = useState<string | null>('settingsScrollTarget', () => null)

  const isAnyPrerequisiteMissing = computed(() => {
    return isPrerequisiteMissing(systemHealth.value)
  })

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

  return {
    systemHealth,
    checkingHealth,
    settingsScrollTarget,
    isAnyPrerequisiteMissing,
    checkSystemHealth
  }
}

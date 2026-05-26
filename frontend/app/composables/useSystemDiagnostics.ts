// useSystemDiagnostics.ts - Extracted system diagnostics logic
export const useSystemDiagnostics = () => {
  const API_BASE = 'http://localhost:8000'

  const systemHealth = useState<any | null>('systemHealth', () => null)
  const checkingHealth = useState<boolean>('checkingHealth', () => false)
  const settingsScrollTarget = useState<string | null>('settingsScrollTarget', () => null)

  const isAnyPrerequisiteMissing = computed(() => {
    if (!systemHealth.value) return false
    const keys = ['ffmpeg', 'node', 'python_env', 'gemini_api', 'cookies']
    return keys.some(key => {
      const item = systemHealth.value[key]
      if (!item) return false
      if (['ffmpeg', 'node', 'python_env'].includes(key)) {
        return item.status !== 'OK'
      } else {
        return item.status !== 'Configured'
      }
    })
  })

  async function checkSystemHealth() {
    checkingHealth.value = true
    try {
      const res = await $fetch<any>(`${API_BASE}/api/system-health`)
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

/**
 * System Diagnostics — pure-function extraction from useSystemDiagnostics composable.
 */

export interface DependencyStatus {
  status: string
  [key: string]: any
}

export interface SystemHealth {
  ffmpeg?: DependencyStatus
  node?: DependencyStatus
  python_env?: DependencyStatus
  gemini_api?: DependencyStatus
  cookies?: DependencyStatus
  [key: string]: any
}

export function isPrerequisiteMissing(health: SystemHealth | null | undefined): boolean {
  if (!health) return false
  const keys = ['ffmpeg', 'node', 'python_env', 'gemini_api', 'cookies']
  return keys.some(key => {
    const item = health[key]
    if (!item) return false
    if (['ffmpeg', 'node', 'python_env'].includes(key)) {
      return item.status !== 'OK'
    } else {
      return item.status !== 'Configured'
    }
  })
}

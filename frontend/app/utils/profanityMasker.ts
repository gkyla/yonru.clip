/**
 * Profanity Masker — pure-function extraction from useSafetyAuditor composable.
 */

export function maskText(text: string, blacklist: string[]): string {
  let masked = text || ''
  blacklist.forEach(word => {
    if (!word) return
    let regex: RegExp
    if (word.startsWith('/') && word.endsWith('/')) {
      regex = new RegExp(word.slice(1, -1), 'gi')
    } else {
      const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
    }
    
    masked = masked.replace(regex, (match: string) => {
      if (match.length <= 1) return match
      return match.charAt(0) + '*' + match.slice(2)
    })
  })
  return masked
}

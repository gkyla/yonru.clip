const raf = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number
}
const caf = (id: number): void => {
  clearTimeout(id)
}

globalThis.requestAnimationFrame = raf
globalThis.cancelAnimationFrame = caf

if (typeof global !== 'undefined') {
  (global as any).requestAnimationFrame = raf
  ;(global as any).cancelAnimationFrame = caf
}

if (typeof window !== 'undefined') {
  window.requestAnimationFrame = raf
  window.cancelAnimationFrame = caf
}

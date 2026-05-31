export function calculateCropPercent(
  dx: number,
  dragStartPercent: number,
  previewScale: number,
  maxOffset: number
): number {
  if (maxOffset === 0 || previewScale === 0) return dragStartPercent
  const scaledDx = dx / previewScale
  const percentDelta = (scaledDx / maxOffset) * -100
  return Math.max(0, Math.min(100, dragStartPercent + percentDelta))
}

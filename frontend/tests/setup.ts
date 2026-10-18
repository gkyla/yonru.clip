import { afterEach, afterAll } from 'vitest';

const raf = (callback: FrameRequestCallback): number => {
  return setTimeout(() => {
    try {
      callback(Date.now());
    } catch {}
  }, 16) as unknown as number;
};
const caf = (id: number): void => {
  clearTimeout(id);
};

const defineGlobals = () => {
  const targets = [
    globalThis,
    typeof global !== 'undefined' ? global : null,
    typeof window !== 'undefined' ? window : null
  ];
  for (const target of targets) {
    if (!target) continue;
    try {
      (target as any).requestAnimationFrame = raf;
      (target as any).cancelAnimationFrame = caf;
    } catch {}
  }
};

defineGlobals();
afterEach(defineGlobals);
afterAll(defineGlobals);

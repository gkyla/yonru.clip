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

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: raf,
  writable: true,
  configurable: true
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: caf,
  writable: true,
  configurable: true
});

if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'requestAnimationFrame', {
    value: raf,
    writable: true,
    configurable: true
  });
  Object.defineProperty(global, 'cancelAnimationFrame', {
    value: caf,
    writable: true,
    configurable: true
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: raf,
    writable: true,
    configurable: true
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    value: caf,
    writable: true,
    configurable: true
  });
}

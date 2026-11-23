let cachedDisplayTransitionSupport: boolean | undefined;

/**
 * Probes whether the browser actually animates discrete `display` transitions
 * (guards against Firefox 129+ parsing `allow-discrete` without deferring `display: none`).
 */
export function canTransitionDisplay(): boolean {
  if (cachedDisplayTransitionSupport !== undefined) {
    return cachedDisplayTransitionSupport;
  }
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !document.body ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete')
  ) {
    return false;
  }

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  // Force style flush before toggling display to none.
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedDisplayTransitionSupport = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedDisplayTransitionSupport;
}

/**
 * Returns true when native top-layer exit transitions (`overlay` + discrete `display`) are supported.
 */
export function supportsTopLayerExit(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.CSS?.supports?.('overlay', 'auto')) && canTransitionDisplay()
  );
}

/**
 * Opens a `<dialog>` in the top layer, clearing any stale exit flag first.
 */
export function openModalDialog(dialog: HTMLDialogElement | null): void {
  if (!dialog) return;
  dialog.removeAttribute('data-closing');
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }
}

/**
 * Waits for active Web Animations inside the dialog subtree (capped at 400ms).
 */
async function waitForDialogAnimations(
  dialog: HTMLDialogElement
): Promise<void> {
  if (typeof dialog.getAnimations !== 'function') return;
  const animations = dialog.getAnimations({ subtree: true });
  if (animations.length === 0) return;
  await Promise.race([
    Promise.allSettled(animations.map(a => a.finished)),
    new Promise<void>(resolve => setTimeout(resolve, 400))
  ]);
}

/**
 * Closes a `<dialog>`, awaiting CSS exit transitions before returning so callers
 * can keep dialog content mounted until the exit transition finishes.
 */
export async function closeModalDialog(
  dialog: HTMLDialogElement | null
): Promise<void> {
  if (!dialog) return;
  const isOpen = dialog.open || dialog.hasAttribute('open');

  if (!supportsTopLayerExit()) {
    if (!isOpen) {
      dialog.removeAttribute('data-closing');
      return;
    }
    dialog.setAttribute('data-closing', '');
    await waitForDialogAnimations(dialog);
    if (!dialog.hasAttribute('data-closing')) {
      return;
    }
    dialog.removeAttribute('data-closing');
    if (typeof dialog.close === 'function') {
      dialog.close();
    }
    if (dialog.hasAttribute('open')) {
      dialog.removeAttribute('open');
    }
    return;
  }

  if (isOpen) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    }
    if (dialog.hasAttribute('open')) {
      dialog.removeAttribute('open');
    }
  }
  await waitForDialogAnimations(dialog);
}

/**
 * Tests pointer coordinates against the dialog box rather than `event.target`,
 * since `<dialog>` receives events on its own padding and gaps.
 */
export function isPointerOutsideDialog(
  event: PointerEvent,
  dialog: HTMLDialogElement
): boolean {
  const rect = dialog.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/**
 * Dismisses a `<dialog>` only when both pointerdown and pointerup occur outside the dialog box.
 */
export function attachLightDismiss(
  dialog: HTMLDialogElement,
  onDismiss: () => void,
  canDismiss?: () => boolean
): () => void {
  let pressedOutside = false;

  const handlePointerDown = (event: PointerEvent) => {
    pressedOutside = isPointerOutsideDialog(event, dialog);
  };

  const handlePointerUp = (event: PointerEvent) => {
    const wasPressedOutside = pressedOutside;
    pressedOutside = false;
    if (!wasPressedOutside) return;
    if (canDismiss && !canDismiss()) return;
    if (isPointerOutsideDialog(event, dialog)) {
      onDismiss();
    }
  };

  const handlePointerCancel = () => {
    pressedOutside = false;
  };

  dialog.addEventListener('pointerdown', handlePointerDown);
  dialog.addEventListener('pointerup', handlePointerUp);
  dialog.addEventListener('pointercancel', handlePointerCancel);

  return () => {
    dialog.removeEventListener('pointerdown', handlePointerDown);
    dialog.removeEventListener('pointerup', handlePointerUp);
    dialog.removeEventListener('pointercancel', handlePointerCancel);
  };
}

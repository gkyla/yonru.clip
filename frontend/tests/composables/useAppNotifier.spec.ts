// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppNotifier } from '../../app/composables/useAppNotifier';
import { useState } from '#imports';

describe('useAppNotifier Composable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const notifier = useAppNotifier();
    notifier.dismissToast();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with null toast state', () => {
    const { toast } = useAppNotifier();
    expect(toast.value).toBeNull();
  });

  it('updates toast state when showToast is called with default type', () => {
    const { toast, showToast } = useAppNotifier();

    showToast('Operation successful');

    expect(toast.value).toEqual({
      message: 'Operation successful',
      type: 'success'
    });
  });

  it('updates toast state with explicit type (error, info)', () => {
    const { toast, showToast } = useAppNotifier();

    showToast('Failed to save', 'error');
    expect(toast.value).toEqual({
      message: 'Failed to save',
      type: 'error'
    });

    showToast('Processing started', 'info');
    expect(toast.value).toEqual({
      message: 'Processing started',
      type: 'info'
    });
  });

  it('automatically clears toast after 3000ms timeout', async () => {
    const { toast, showToast } = useAppNotifier();

    showToast('Self-clearing message');
    expect(toast.value).not.toBeNull();

    // Advance time by 2999ms - should still be visible
    vi.advanceTimersByTime(2999);
    expect(toast.value).toEqual({
      message: 'Self-clearing message',
      type: 'success'
    });

    // Advance 1ms more (total 3000ms) - should clear
    vi.advanceTimersByTime(1);
    expect(toast.value).toBeNull();
  });

  it('resets timer on rapid consecutive showToast dispatches', async () => {
    const { toast, showToast } = useAppNotifier();

    showToast('First message');
    vi.advanceTimersByTime(2000);
    expect(toast.value?.message).toBe('First message');

    // Dispatch second message at 2000ms
    showToast('Second message');
    expect(toast.value?.message).toBe('Second message');

    // Advance 2000ms (4000ms from start, but only 2000ms from second message)
    vi.advanceTimersByTime(2000);
    expect(toast.value?.message).toBe('Second message');

    // Advance remaining 1000ms - now should clear
    vi.advanceTimersByTime(1000);
    expect(toast.value).toBeNull();
  });

  it('dismisses toast immediately via dismissToast and cancels pending timeout', () => {
    const { toast, showToast, dismissToast } = useAppNotifier();

    showToast('Dismiss me');
    expect(toast.value).not.toBeNull();

    dismissToast();
    expect(toast.value).toBeNull();

    // Advancing timers should not cause any error or unexpected state
    vi.advanceTimersByTime(5000);
    expect(toast.value).toBeNull();
  });

  it('coordinates with direct useState(clipperToast) mutations for shared reactive consistency', async () => {
    const { toast } = useAppNotifier();
    const externalToast = useState<{
      message: string;
      type: 'success' | 'error' | 'info';
    } | null>('clipperToast');

    externalToast.value = {
      message: 'External toast dispatch',
      type: 'info'
    };

    expect(toast.value).toEqual({
      message: 'External toast dispatch',
      type: 'info'
    });

    // Watcher should auto-clear after 3000ms
    vi.advanceTimersByTime(3000);
    expect(toast.value).toBeNull();
  });
});

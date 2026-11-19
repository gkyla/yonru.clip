import type { ClipSessionClient } from './clipSessionClient';
import type { ClipSessionAck, ClipSessionPatch } from '../types/clipper';

export type ClipSessionSaveDomain =
  'transcript' | 'style_settings' | 'timeline' | 'cover_config' | 'history';

export interface ClipSessionTarget {
  folderName: string;
  clipId: string;
}

export interface ClipSessionSaveSource {
  getTarget: () => ClipSessionTarget | null;
  buildDomainPatch: (
    domains: ReadonlySet<ClipSessionSaveDomain>
  ) => ClipSessionPatch;
  isLocked?: () => boolean;
  onPendingStateChange?: (isPendingOrInFlight: boolean) => void;
  onBeforePatch?: (
    domains: ReadonlySet<ClipSessionSaveDomain>,
    target: ClipSessionTarget
  ) => void;
  onAfterPatch?: (
    domains: ReadonlySet<ClipSessionSaveDomain>,
    target: ClipSessionTarget,
    ok: boolean,
    error?: unknown
  ) => void;
}

export interface ClipSessionSaveSchedulerOptions {
  client: Pick<ClipSessionClient, 'patchSession'>;
  source: ClipSessionSaveSource;
  domainDelaysMs?: Partial<Record<ClipSessionSaveDomain, number>>;
}

export const DEFAULT_DOMAIN_DELAYS_MS: Record<ClipSessionSaveDomain, number> = {
  cover_config: 300,
  timeline: 400,
  style_settings: 800,
  transcript: 800,
  history: 1500
};

interface QueuedSaveJob {
  target: ClipSessionTarget;
  domains: Set<ClipSessionSaveDomain>;
  patch: ClipSessionPatch;
  throwOnError: boolean;
  resolve: (ack?: ClipSessionAck) => void;
  reject: (err: unknown) => void;
  promise: Promise<ClipSessionAck | undefined>;
}

function sameTarget(
  a: ClipSessionTarget | null,
  b: ClipSessionTarget | null
): boolean {
  return (
    a !== null &&
    b !== null &&
    a.folderName === b.folderName &&
    a.clipId === b.clipId
  );
}

/**
 * Single-flight, debounced domain coalescing scheduler for clip session persistence.
 * Accumulates dirty domains (`transcript`, `style_settings`, `timeline`, `cover_config`,
 * `history`) per `(folderName, clipId)` behind one timer and guarantees at most one
 * in-flight `PUT /api/clip-session/{folder}/{clip}` request at any time.
 */
export class ClipSessionSaveScheduler {
  private readonly client: Pick<ClipSessionClient, 'patchSession'>;
  private readonly source: ClipSessionSaveSource;
  private readonly domainDelaysMs: Record<ClipSessionSaveDomain, number>;

  private dirtyDomains = new Set<ClipSessionSaveDomain>();
  private dirtyTarget: ClipSessionTarget | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private queuedJobs: QueuedSaveJob[] = [];
  private inFlightPromise: Promise<void> | null = null;
  private flushRequestedWhileInFlight = false;
  private disposed = false;
  private lastNotifiedPending = false;

  constructor(options: ClipSessionSaveSchedulerOptions) {
    this.client = options.client;
    this.source = options.source;
    this.domainDelaysMs = {
      ...DEFAULT_DOMAIN_DELAYS_MS,
      ...(options.domainDelaysMs || {})
    };
  }

  /**
   * Marks a clip session domain as dirty and (re)arms the shared coalescing timer.
   * Returns false if disposed, saving is locked, or no active clip target exists.
   */
  public markDirty(
    domain: ClipSessionSaveDomain,
    options?: { delayMs?: number }
  ): boolean {
    if (this.disposed || this.source.isLocked?.()) {
      return false;
    }

    const currentTarget = this.source.getTarget();
    if (!currentTarget || !currentTarget.folderName || !currentTarget.clipId) {
      return false;
    }

    if (this.dirtyTarget && !sameTarget(this.dirtyTarget, currentTarget)) {
      this.clearDirtyState();
    }

    this.dirtyTarget = { ...currentTarget };
    this.dirtyDomains.add(domain);
    this.flushRequestedWhileInFlight = false;

    const delayMs =
      options?.delayMs !== undefined
        ? Math.max(0, options.delayMs)
        : this.computeMinDelayMs();

    this.armDebounceTimer(delayMs);
    this.notifyPendingState();
    return true;
  }

  /**
   * Cancels the debounce timer and flushes all currently dirty domains in one
   * coalesced PUT request (or awaits any active in-flight drain).
   */
  public flush(options?: {
    throwOnError?: boolean;
  }): Promise<ClipSessionAck | undefined> {
    if (this.disposed) {
      return Promise.resolve(undefined);
    }

    this.clearDebounceTimer();
    this.flushRequestedWhileInFlight = false;

    if (this.dirtyDomains.size > 0 && this.dirtyTarget !== null) {
      const job = this.materializeDirtyJob(Boolean(options?.throwOnError));
      if (job) {
        this.queuedJobs.push(job);
        this.drainQueue();
        return job.promise;
      }
    }

    const lastQueued = this.queuedJobs[this.queuedJobs.length - 1];
    if (lastQueued) {
      return lastQueued.promise;
    }

    if (this.inFlightPromise) {
      return this.inFlightPromise.then(() => undefined);
    }

    this.notifyPendingState();
    return Promise.resolve(undefined);
  }

  /**
   * Immediately persists the specified domains (merging any already-dirty domains
   * for the same target) through the single-flight queue and cancels pending timers.
   */
  public saveNow(
    domains: Iterable<ClipSessionSaveDomain>,
    options?: {
      customPatch?: Partial<ClipSessionPatch>;
      targetOverride?: ClipSessionTarget;
      throwOnError?: boolean;
    }
  ): Promise<ClipSessionAck | undefined> {
    if (this.disposed) {
      return Promise.resolve(undefined);
    }

    const resolvedTarget = options?.targetOverride ?? this.source.getTarget();
    if (
      !resolvedTarget ||
      !resolvedTarget.folderName ||
      !resolvedTarget.clipId
    ) {
      return Promise.resolve(undefined);
    }

    const mergedDomains = new Set<ClipSessionSaveDomain>(domains);
    const matchesDirtyTarget =
      this.dirtyTarget !== null && sameTarget(this.dirtyTarget, resolvedTarget);

    if (matchesDirtyTarget) {
      this.clearDebounceTimer();
      this.flushRequestedWhileInFlight = false;
      for (const dirtyDomain of this.dirtyDomains) {
        mergedDomains.add(dirtyDomain);
      }
      this.dirtyDomains.clear();
      this.dirtyTarget = null;
    }

    const basePatch =
      mergedDomains.size > 0 ? this.source.buildDomainPatch(mergedDomains) : {};
    const finalPatch: ClipSessionPatch = options?.customPatch
      ? { ...basePatch, ...options.customPatch }
      : basePatch;

    if (Object.keys(finalPatch).length === 0) {
      this.notifyPendingState();
      return Promise.resolve(undefined);
    }

    const job = this.createJob(
      { ...resolvedTarget },
      mergedDomains,
      finalPatch,
      Boolean(options?.throwOnError)
    );
    this.queuedJobs.push(job);
    this.drainQueue();
    return job.promise;
  }

  /**
   * Enqueues a pre-snapshotted patch for a specific target (e.g. flushing an
   * outgoing clip synchronously during clip switching without mixing refs).
   */
  public enqueueFrozenPatch(
    target: ClipSessionTarget,
    patch: ClipSessionPatch,
    domains: Iterable<ClipSessionSaveDomain>,
    options?: { throwOnError?: boolean }
  ): Promise<ClipSessionAck | undefined> {
    if (
      this.disposed ||
      !target.folderName ||
      !target.clipId ||
      Object.keys(patch).length === 0
    ) {
      return Promise.resolve(undefined);
    }

    if (this.dirtyTarget && sameTarget(this.dirtyTarget, target)) {
      this.clearDirtyState();
    }

    const job = this.createJob(
      { ...target },
      new Set(domains),
      patch,
      Boolean(options?.throwOnError)
    );
    this.queuedJobs.push(job);
    this.drainQueue();
    return job.promise;
  }

  public hasPendingWork(): boolean {
    return (
      this.dirtyDomains.size > 0 ||
      this.queuedJobs.length > 0 ||
      this.inFlightPromise !== null
    );
  }

  public hasDirtyDomains(target?: ClipSessionTarget | null): boolean {
    if (this.dirtyDomains.size === 0) {
      return false;
    }
    if (target) {
      return sameTarget(this.dirtyTarget, target);
    }
    return true;
  }

  public getDirtyTarget(): ClipSessionTarget | null {
    return this.dirtyTarget ? { ...this.dirtyTarget } : null;
  }

  public getDirtyDomains(): ReadonlySet<ClipSessionSaveDomain> {
    return new Set(this.dirtyDomains);
  }

  public cancelPending(): void {
    this.clearDirtyState();
    this.notifyPendingState();
  }

  public dispose(): void {
    this.disposed = true;
    this.cancelPending();
  }

  private computeMinDelayMs(): number {
    let minDelay = Number.POSITIVE_INFINITY;
    for (const domain of this.dirtyDomains) {
      const delay = this.domainDelaysMs[domain];
      if (delay < minDelay) {
        minDelay = delay;
      }
    }
    return Number.isFinite(minDelay) ? minDelay : 400;
  }

  private armDebounceTimer(delayMs: number): void {
    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.onDebounceElapsed();
    }, delayMs);
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearDirtyState(): void {
    this.clearDebounceTimer();
    this.dirtyDomains.clear();
    this.dirtyTarget = null;
    this.flushRequestedWhileInFlight = false;
  }

  private onDebounceElapsed(): void {
    if (this.disposed || this.dirtyDomains.size === 0 || !this.dirtyTarget) {
      this.notifyPendingState();
      return;
    }

    if (this.inFlightPromise !== null) {
      this.flushRequestedWhileInFlight = true;
      return;
    }

    const job = this.materializeDirtyJob(false);
    if (job) {
      this.queuedJobs.push(job);
      this.drainQueue();
    } else {
      this.notifyPendingState();
    }
  }

  private materializeDirtyJob(throwOnError = false): QueuedSaveJob | null {
    if (this.dirtyDomains.size === 0 || !this.dirtyTarget) {
      return null;
    }

    const target = { ...this.dirtyTarget };
    const domains = new Set(this.dirtyDomains);
    this.dirtyDomains.clear();
    this.dirtyTarget = null;
    this.flushRequestedWhileInFlight = false;

    const patch = this.source.buildDomainPatch(domains);
    if (Object.keys(patch).length === 0) {
      return null;
    }

    return this.createJob(target, domains, patch, throwOnError);
  }

  private createJob(
    target: ClipSessionTarget,
    domains: Set<ClipSessionSaveDomain>,
    patch: ClipSessionPatch,
    throwOnError: boolean
  ): QueuedSaveJob {
    let resolveFn!: (ack?: ClipSessionAck) => void;
    let rejectFn!: (err: unknown) => void;
    const promise = new Promise<ClipSessionAck | undefined>(
      (resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      }
    );

    return {
      target,
      domains,
      patch,
      throwOnError,
      resolve: resolveFn,
      reject: rejectFn,
      promise
    };
  }

  private drainQueue(): Promise<void> {
    if (this.inFlightPromise) {
      this.notifyPendingState();
      return this.inFlightPromise;
    }

    const run = async (): Promise<void> => {
      try {
        while (
          this.queuedJobs.length > 0 ||
          (this.flushRequestedWhileInFlight &&
            this.dirtyDomains.size > 0 &&
            this.dirtyTarget !== null)
        ) {
          const nextJob =
            this.queuedJobs.shift() ?? this.materializeDirtyJob(false);
          if (!nextJob) {
            continue;
          }
          await this.executeJob(nextJob);
        }
      } finally {
        this.inFlightPromise = null;
        this.notifyPendingState();
      }
    };

    this.inFlightPromise = run();
    this.notifyPendingState();
    return this.inFlightPromise;
  }

  private async executeJob(job: QueuedSaveJob): Promise<void> {
    try {
      this.source.onBeforePatch?.(job.domains, job.target);
      const ack = await this.client.patchSession(
        job.target.folderName,
        job.target.clipId,
        job.patch
      );
      this.source.onAfterPatch?.(job.domains, job.target, true);
      job.resolve(ack);
    } catch (error) {
      this.source.onAfterPatch?.(job.domains, job.target, false, error);
      if (job.throwOnError) {
        job.reject(error);
      } else {
        job.resolve(undefined);
      }
    }
  }

  private notifyPendingState(): void {
    const isPending = this.hasPendingWork();
    if (isPending !== this.lastNotifiedPending) {
      this.lastNotifiedPending = isPending;
      this.source.onPendingStateChange?.(isPending);
    }
  }
}

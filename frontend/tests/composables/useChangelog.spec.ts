import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChangelog } from '../../app/composables/useChangelog';

describe('useChangelog Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).queryCollection;
  });

  afterEach(() => {
    delete (globalThis as any).queryCollection;
  });

  it('initializes with default empty state', () => {
    const { releases, status } = useChangelog();
    expect(releases.value).toEqual([]);
    expect(status.value).toBe('idle');
  });

  it('fetches releases successfully when queryCollection is defined', async () => {
    const mockData = [
      {
        version: '0.1.0',
        date: '2026-10-21',
        title: 'Initial Release'
      }
    ];

    const mockAll = vi.fn().mockResolvedValue(mockData);
    const mockOrder = vi.fn().mockReturnValue({ all: mockAll });
    const mockQuery = vi.fn().mockReturnValue({ order: mockOrder });

    (globalThis as any).queryCollection = mockQuery;

    const { releases, status, fetchReleases } = useChangelog();
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toEqual(mockData);
    expect(mockQuery).toHaveBeenCalledWith('changelog');
    expect(mockOrder).toHaveBeenCalledWith('date', 'DESC');
  });

  it('handles query error gracefully', async () => {
    const mockQuery = vi.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    (globalThis as any).queryCollection = mockQuery;

    const { releases, status, fetchReleases } = useChangelog();
    await fetchReleases();

    expect(status.value).toBe('error');
    expect(releases.value).toEqual([]);
  });

  it('handles missing queryCollection gracefully via queryOverride null', async () => {
    const { releases, status, fetchReleases } = useChangelog(null);
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toEqual([]);
  });

  it('handles missing queryCollection gracefully when globalThis is explicitly null', async () => {
    (globalThis as any).queryCollection = null;

    const { releases, status, fetchReleases } = useChangelog();
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toEqual([]);
  });
});

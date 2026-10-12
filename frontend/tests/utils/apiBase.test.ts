import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveApiBase } from '../../app/utils/apiBase';

describe('resolveApiBase', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
  });

  it('returns window.location.origin in production single-server mode (e.g. port 8765)', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        port: '8765',
        origin: 'http://localhost:8765'
      }
    });

    expect(resolveApiBase()).toBe('http://localhost:8765');
  });

  it('returns window.location.origin on custom port in production mode (e.g. port 9999)', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        port: '9999',
        origin: 'http://localhost:9999'
      }
    });

    expect(resolveApiBase()).toBe('http://localhost:9999');
  });

  it('returns fallback in development mode when on frontend dev port 3765', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        port: '3765',
        origin: 'http://localhost:3765'
      }
    });

    expect(resolveApiBase()).toBe('http://localhost:8765');
    expect(resolveApiBase('http://custom-backend:8765')).toBe(
      'http://custom-backend:8765'
    );
  });

  it('returns fallback in development mode when on legacy dev port 3000', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        port: '3000',
        origin: 'http://localhost:3000'
      }
    });

    expect(resolveApiBase()).toBe('http://localhost:8765');
  });
});

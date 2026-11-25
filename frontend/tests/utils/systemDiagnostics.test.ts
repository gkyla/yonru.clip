import { describe, it, expect } from 'vitest';
import { isPrerequisiteMissing } from '../../app/utils/systemDiagnostics';

describe('System Diagnostics TDD', () => {
  it('returns false when health data is null or undefined', () => {
    expect(isPrerequisiteMissing(null)).toBe(false);
    expect(isPrerequisiteMissing(undefined)).toBe(false);
  });

  it('returns false when all required prerequisites are OK or Configured even if cookies are missing', () => {
    const health = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Not Configured' }
    };
    expect(isPrerequisiteMissing(health)).toBe(false);
  });

  it('returns true when any engine dependency (ffmpeg, node, python_env) status is not OK', () => {
    const healthWithBadFFmpeg = {
      ffmpeg: { status: 'Missing' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Configured' }
    };
    expect(isPrerequisiteMissing(healthWithBadFFmpeg)).toBe(true);

    const healthWithBadNode = {
      ffmpeg: { status: 'OK' },
      node: { status: 'Missing' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Configured' }
    };
    expect(isPrerequisiteMissing(healthWithBadNode)).toBe(true);

    const healthWithBadPython = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'Error' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Configured' }
    };
    expect(isPrerequisiteMissing(healthWithBadPython)).toBe(true);
  });

  it('returns true when gemini_api status is not Configured and ignores missing cookies', () => {
    const healthWithBadGemini = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Missing' },
      cookies: { status: 'Configured' }
    };
    expect(isPrerequisiteMissing(healthWithBadGemini)).toBe(true);

    const healthWithMissingCookiesOnly = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Missing' }
    };
    expect(isPrerequisiteMissing(healthWithMissingCookiesOnly)).toBe(false);
  });
});

/**
 * Resolves the backend API base URL dynamically based on runtime context.
 * - In Production (single-server mode): Uses window.location.origin (e.g. http://localhost:8765 or custom port)
 * - In Development mode (port 3765 / 3000): Falls back to backend port (http://localhost:8765)
 * - In SSR / Testing: Uses the provided fallback URL
 */
export function resolveApiBase(
  fallback: string = 'http://localhost:8765'
): string {
  if (typeof window !== 'undefined' && window.location) {
    const port = window.location.port;
    // When running in production single-server mode (or any port other than dev frontend 3765/3000)
    if (port !== '3765' && port !== '3000') {
      return window.location.origin;
    }
  }
  return fallback;
}

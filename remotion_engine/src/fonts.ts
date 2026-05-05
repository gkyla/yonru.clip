/**
 * Dynamic Font registry for Remotion.
 * Uses local fonts loaded via fonts.css.
 */

// Cache loaded font families
const fontCache: Record<string, string> = {};

const FONT_LIST = [
  'Montserrat', 'Inter', 'Bebas Neue', 'Oswald', 'Poppins', 
  'Outfit', 'Noto Sans', 'Roboto Condensed', 'Playfair Display',
  'Anton', 'Bangers', 'Permanent Marker', 'Russo One', 'Teko',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
];

/**
 * Load a font by name. Returns the CSS fontFamily string.
 * Falls back to system-ui if the font is not in our registry.
 */
export function getFont(name: string): string {
  if (fontCache[name]) return fontCache[name];

  if (FONT_LIST.includes(name)) {
    // Quote the name for CSS compatibility (especially for fonts with spaces like "Bebas Neue")
    const quoted = `"${name}"`;
    fontCache[name] = quoted;
    return quoted;
  }

  // Fallback: use the raw name (works for system fonts like Arial)
  return `"${name}", system-ui, -apple-system, sans-serif`;
}


/**
 * Safely parses a JSON value that may be double/triple-encoded as nested strings.
 * Loops JSON.parse up to `maxLayers` times, unwrapping one outer string layer per
 * iteration. Never mutates the input with regex, so real escape sequences inside
 * string values (e.g. a backslash-quote in a password) are preserved.
 */
export function parseResponseField(value: unknown, maxLayers = 3): any {
  let current = value;
  for (let i = 0; i < maxLayers; i++) {
    if (typeof current !== 'string') break;
    try {
      current = JSON.parse(current);
    } catch (error) {
      return null;
    }
  }
  return current;
}

/**
 * Normalizes truthy comparisons for sheet-derived boolean columns, which may be
 * stored as the string "TRUE"/"FALSE", lowercase "true"/"false", or an actual JS
 * boolean depending on the write path.
 */
export function isTrue(value: unknown): boolean {
  if (value === true) return true;
  return String(value ?? '').trim().toUpperCase() === 'TRUE';
}

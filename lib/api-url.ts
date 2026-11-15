/**
 * Helper to resolve API URLs for both web (relative paths) and mobile/Capacitor
 * (configurable via NEXT_PUBLIC_API_URL).
 */
export function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

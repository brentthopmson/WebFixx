// Shared route classification used by both middleware.ts (edge) and the client
// RootLayout guard. Keep this file free of Node-only APIs so it stays edge-safe.

export const PUBLIC_PATHS: string[] = [
  '/',
  '/account',
  '/invalid',
  '/reset-password',
  '/verify',
];

export const ADMIN_PATHS: string[] = ['/root', '/root/settings', '/root/users', '/root/transactions'];

export const API_PATHS: string[] = ['/api', '/docs', '/openapi.json'];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  for (const prefix of API_PATHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isAdminPath(pathname: string): boolean {
  return pathname === '/root' || pathname.startsWith('/root/');
}

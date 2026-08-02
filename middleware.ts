import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from './utils/protectedRoutes';

const TOKEN_COOKIE = 'loggedInAdmin';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasToken = req.cookies.get(TOKEN_COOKIE);
  if (!hasToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/';
    loginUrl.search = '';
    loginUrl.hash = '';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|.*\\.(?:exe|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|otf|css|js|map|txt)).*)',
  ],
};

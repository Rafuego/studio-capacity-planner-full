import { NextResponse } from 'next/server';

export function middleware(request) {
  // Rewrite root URL to serve public/index.html without showing /index.html in the URL
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/index.html', request.url));
  }
}

export const config = {
  matcher: '/',
};

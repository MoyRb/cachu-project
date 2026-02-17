import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const appMode = process.env.NEXT_PUBLIC_APP_MODE ?? "customer";

const isStaffPath = (pathname: string) =>
  pathname === "/caja" || pathname === "/ui-kit" || pathname.startsWith("/cocina");

export function middleware(request: NextRequest) {
  if (appMode !== "customer") {
    return NextResponse.next();
  }

  if (!isStaffPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/kiosco";
  redirectUrl.search = "";

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/cocina/:path*", "/caja", "/ui-kit/:path*"],
};

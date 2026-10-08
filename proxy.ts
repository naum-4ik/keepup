import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isOldHost, movedUrl } from "@/lib/moved";

export async function proxy(request: NextRequest) {
  // The old address forwards to the new one first: no session work for a host we're leaving (lib/moved.ts).
  if (isOldHost(request.headers.get("host"))) {
    return NextResponse.redirect(movedUrl(request.nextUrl.pathname, request.nextUrl.search), 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

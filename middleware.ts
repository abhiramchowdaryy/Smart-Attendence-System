import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and the face-api models.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|models|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

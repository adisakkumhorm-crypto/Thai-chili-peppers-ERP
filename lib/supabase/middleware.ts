import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  // Bypassing auth for UI inspection
  return NextResponse.next({ request })
}

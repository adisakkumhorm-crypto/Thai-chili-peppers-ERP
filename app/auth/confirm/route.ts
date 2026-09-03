import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url), {
        status: 303,
      })
    }
    return failure(request, error.message)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url), {
        status: 303,
      })
    }
    return failure(request, error.message)
  }

  return failure(request, "Invalid or expired confirmation link.")
}

function failure(request: NextRequest, message: string) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", message)
  return NextResponse.redirect(url, { status: 303 })
}

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

/**
 * Terminal landing for an authenticated user who belongs to no organization —
 * e.g. a brand-new `/signup` account (the handle_new_user trigger creates a
 * profile but no membership). Rendering here instead of redirecting to `/login`
 * avoids an infinite `/login` ⇄ `/dashboard` redirect loop. The single-org MVP
 * has no self-serve workspace creation, so the honest state is: ask an owner to
 * invite you, or use the demo account.
 */
export default async function NoWorkspacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Already a member? Send them into the app.
  const ctx = await getOrgContext()
  if (ctx) redirect("/dashboard")

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">No workspace yet</CardTitle>
          <CardDescription>
            Your account{user.email ? ` (${user.email})` : ""} isn’t a member of
            any workspace yet. Ask a workspace owner to invite you, then sign in
            again. Self-serve workspace creation is coming in a later version.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Just exploring? Sign out and use the demo account{" "}
          <span className="font-medium">demo@boombignose.org</span>.
        </CardContent>
        <CardFooter>
          <form action="/auth/signout" method="post" className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}

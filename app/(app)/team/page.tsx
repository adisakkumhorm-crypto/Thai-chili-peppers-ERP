import { Users, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { JoinRequests } from "./_components/join-requests"
import { RemoveMemberButton } from "./_components/remove-member-button"
import { EditMemberButton } from "./_components/edit-member-button"
import { LiveStatusIndicator } from "./_components/live-status-indicator"
import { ResetPasswordButton } from "./_components/reset-password-button"

export const dynamic = "force-dynamic"

function initials(name: string | null, fallback: string): string {
  const base = name?.trim() || fallback
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export default async function TeamPage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const canEdit = ctx.role === "owner" || ctx.role === "admin"

  // Team members
  const { data: members, error: memErr } = await adminClient
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true })

  const userIds = (members ?? []).map((m) => m.user_id)
  const { data: profiles } = userIds.length
    ? await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] }
    
  const { data: employees } = userIds.length
    ? await adminClient
        .from("employees")
        .select("user_id, allowed_features")
        .eq("org_id", ctx.orgId)
        .in("user_id", userIds)
    : { data: [] }
    
  const featuresByUserId = new Map(((employees as any[]) ?? []).map((e: any) => [e.user_id, e.allowed_features ?? []]))

  // Fetch emails from auth.users
  const { data: authData } = await adminClient.auth.admin.listUsers()
  const emailById = new Map((authData.users || []).map(u => [u.id, u.email]))

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name] as const))

  const team = (members ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    fullName: nameById.get(m.user_id) ?? null,
    email: emailById.get(m.user_id) ?? null,
    isSelf: m.user_id === ctx.userId,
    features: featuresByUserId.get(m.user_id) ?? [],
  }))

  // Pending requests
  let requests: any[] = []
  let unlinkedEmployees: any[] = []

  if (canEdit) {
    const { data: rawRequests } = await adminClient
      .from("join_requests" as any)
      .select("id, user_id, created_at")
      .eq("org_id", ctx.orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    const pendingUserIds = (rawRequests || []).map((r: any) => r.user_id)
    const { data: pendingProfiles } = pendingUserIds.length ? await adminClient.from("profiles").select("id, full_name").in("id", pendingUserIds) : { data: [] }
    const profileMap = new Map((pendingProfiles || []).map((p: any) => [p.id, p.full_name]))

    requests = await Promise.all((rawRequests || []).map(async (r: any) => {
      const { data: { user } } = await adminClient.auth.admin.getUserById(r.user_id)
      return {
        id: r.id,
        userId: r.user_id,
        email: user?.email || null,
        fullName: profileMap.get(r.user_id) || null,
        createdAt: r.created_at
      }
    }))

    const { data: unlinkedEmployeesRaw } = await adminClient
      .from("employees")
      .select("id, first_name, last_name, position")
      .eq("org_id", ctx.orgId)
      .is("user_id", null)
      
    unlinkedEmployees = unlinkedEmployeesRaw || []
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ทีมงานและสิทธิ์ (Team)"
        description="จัดการพนักงาน อนุมัติการเข้าใช้งาน และกำหนดสิทธิ์ในระบบ"
      />

      {canEdit && <JoinRequests requests={requests} unlinkedEmployees={unlinkedEmployees} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-5 text-blue-500" /> สมาชิกในทีม ({team.length})
          </CardTitle>
          <CardDescription>พนักงานที่มีสิทธิ์เข้าใช้งานระบบทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <EmptyState
              icon={Users}
              title="ไม่มีสมาชิกในทีม"
              description="ยังไม่มีใครถูกเพิ่มเข้าสู่ระบบ"
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {team.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="size-10 border border-white/10 bg-slate-800">
                      <AvatarFallback className="text-xs bg-slate-800 text-slate-300">
                        {initials(member.fullName, member.email || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center">
                        <p className="font-medium truncate flex items-center">
                          {member.fullName || "ไม่ระบุชื่อ"}
                          {member.isSelf && (
                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">คุณ</Badge>
                          )}
                        </p>
                        <LiveStatusIndicator userId={member.userId} />
                      </div>
                      {member.email && (
                        <p className="text-muted-foreground truncate text-[11px] opacity-70">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="shrink-0 capitalize px-2.5 py-0.5 border-white/10 bg-white/5 text-slate-300">
                      {member.role}
                    </Badge>
                    {canEdit && (
                      <EditMemberButton 
                        userId={member.userId} 
                        orgId={ctx.orgId} 
                        memberName={member.fullName ?? member.email ?? "ไม่ระบุชื่อ"} 
                        currentRole={member.role}
                        currentFeatures={member.features}
                      />
                    )}
                    {canEdit && (
                      <ResetPasswordButton
                        userId={member.userId}
                        memberName={member.fullName ?? member.email ?? "ไม่ระบุชื่อ"}
                      />
                    )}
                    {!member.isSelf && canEdit && (
                      <RemoveMemberButton 
                        userId={member.userId} 
                        orgId={ctx.orgId} 
                        memberName={member.fullName ?? member.email ?? "ไม่ระบุชื่อ"} 
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

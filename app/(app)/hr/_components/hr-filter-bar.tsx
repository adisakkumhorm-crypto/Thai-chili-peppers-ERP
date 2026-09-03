"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import { Search, X, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { configToHref, type ViewConfig } from "@/app/(app)/views/view-config"

export function HrFilterBar({ q, dept, departments }: { q: string, dept?: string, departments?: (string|null)[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(q)
  const [prevQ, setPrevQ] = useState(q)
  
  if (q !== prevQ) {
    setPrevQ(q)
    setSearch(q)
  }

  function submitSearch(newDept?: string) {
    const next: ViewConfig = {}
    if (search.trim()) next.q = search.trim()
    const finalDept = newDept !== undefined ? newDept : dept
    if (finalDept && finalDept !== "all") next.dept = finalDept

    router.push(configToHref(pathname, next))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 mt-2">
      <div className="relative w-full sm:w-64">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={search}
          placeholder="ค้นหาชื่อ, รหัส..."
          className="h-8 pl-8 bg-slate-950/20"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submitSearch()
            }
          }}
          onBlur={() => submitSearch()}
        />
      </div>
      
      {departments && departments.length > 0 && (
        <Select value={dept || "all"} onValueChange={(v) => { if(v) submitSearch(v) }}>

          <SelectTrigger className="h-8 w-[180px] bg-slate-950/20">
            <Filter className="size-3 mr-2 text-muted-foreground" />
            <SelectValue placeholder="ทุกแผนก" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแผนก (All)</SelectItem>
            {departments.map(d => (
              <SelectItem key={d || "none"} value={d || "none"}>{d || "ไม่ระบุแผนก"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(q || (dept && dept !== "all")) ? (
        <Button variant="ghost" size="sm" render={<Link href={pathname} />}>
          <X className="size-4" />
          ล้างตัวกรอง
        </Button>
      ) : null}
    </div>
  )
}

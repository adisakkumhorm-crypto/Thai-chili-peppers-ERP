import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { POForm } from "../_components/po-form"
import { createPO } from "../actions"

export default async function NewPOPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name")

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="New Purchase Order" description="Create a new PO for a supplier.">
        <Button variant="ghost" size="sm" render={<Link href="/purchases" />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <POForm
            action={createPO}
            suppliers={suppliers ?? []}
            submitLabel="Create PO"
          />
        </CardContent>
      </Card>
    </div>
  )
}

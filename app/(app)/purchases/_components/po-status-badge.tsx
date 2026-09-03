import { Badge } from "@/components/ui/badge"

export function POStatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "outline" | "destructive" = "outline"
  
  if (status === "pending_approval") variant = "secondary"
  if (status === "ordered") variant = "default"
  if (status === "partially_received") variant = "outline"
  if (status === "received") variant = "secondary"
  if (status === "cancelled") variant = "destructive"

  return <Badge variant={variant} className="capitalize">{status.replace("_", " ")}</Badge>
}

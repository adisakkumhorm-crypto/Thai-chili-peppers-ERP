import { Badge } from "@/components/ui/badge"

export function POStatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "outline" | "destructive" = "outline"
  
  if (status === "ordered") variant = "default"
  if (status === "received") variant = "secondary"
  if (status === "cancelled") variant = "destructive"

  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

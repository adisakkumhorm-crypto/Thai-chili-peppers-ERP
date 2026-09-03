import { Badge } from "@/components/ui/badge"

export function OrderStatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "outline" | "destructive" = "outline"
  
  if (status === "pending") variant = "secondary"
  if (status === "paid") variant = "default"
  if (status === "packing") variant = "secondary"
  if (status === "shipped") variant = "default"
  if (status === "delivered") variant = "outline"
  if (status === "cancelled") variant = "destructive"

  return <Badge variant={variant} className="capitalize">{status.replace("_", " ")}</Badge>
}

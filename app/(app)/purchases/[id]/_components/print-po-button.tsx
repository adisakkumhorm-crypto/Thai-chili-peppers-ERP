"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintPOButton() {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="mr-2 size-4" />
      พิมพ์ / PDF
    </Button>
  )
}

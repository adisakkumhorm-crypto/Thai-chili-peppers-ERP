"use client"

import dynamic from "next/dynamic"

export const ScannerClientWrapper = dynamic(
  () => import("./scanner-client").then((mod) => mod.ScannerClient),
  { 
    ssr: false,
    loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">กำลังโหลดระบบสแกนใบหน้า (AI)...</div>
  }
)

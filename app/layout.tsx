import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Thai Chili Peppers Company OS",
  description:
    "AI-native Company OS — CRM, project delivery, finance visibility, automation, and management dashboards.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased dark`}
    >
      <body className="bg-[#10243e] text-white min-h-full overflow-hidden relative">
        {/* 🌈 Dynamic Background (Refraction Source) for the whole app */}
        <div className="fixed top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-500/30 blur-[120px] mix-blend-screen animate-pulse pointer-events-none z-[-1]" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-sky-500/20 blur-[150px] mix-blend-screen animate-pulse pointer-events-none z-[-1]" style={{ animationDelay: '2s' }} />
        <div className="fixed top-[20%] right-[30%] w-[40%] h-[40%] rounded-full bg-cyan-400/20 blur-[100px] mix-blend-screen pointer-events-none z-[-1]" />

        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  )
}

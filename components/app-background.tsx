"use client"
import React, { createContext, useContext, useEffect, useState } from "react"

export type ThemeWallpaper = { name: string, type: 'image' | 'mesh', value: string }
export const THEMES: ThemeWallpaper[] = [
  { name: "Ocean Sunset", type: "image", value: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2560&auto=format&fit=crop" },
  { name: "Yosemite (macOS)", type: "image", value: "https://images.unsplash.com/photo-1414441018904-453a25bdfac5?q=80&w=2560&auto=format&fit=crop" },
  { name: "Green Meadow", type: "image", value: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2560&auto=format&fit=crop" },
  { name: "Majestic Mountains", type: "image", value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2560&auto=format&fit=crop" },
  { name: "Cascading Waterfall", type: "image", value: "https://images.unsplash.com/photo-1432405972618-fc600255b8dc?q=80&w=2560&auto=format&fit=crop" },
  { name: "Aurora Night", type: "image", value: "https://images.unsplash.com/photo-1579033461387-adb471940f4c?q=80&w=2560&auto=format&fit=crop" },
  { name: "Abstract Fluid", type: "mesh", value: "bg-gradient-to-br from-indigo-900 via-purple-900 to-black" }
]

const ThemeContext = createContext<{theme: ThemeWallpaper, setTheme: (t: ThemeWallpaper) => void}>({
  theme: THEMES[0], setTheme: () => {}
})

export function AppBackground({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(THEMES[0])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedName = localStorage.getItem("erp-wallpaper-name")
    const savedUrl = localStorage.getItem("erp-wallpaper-custom-url")
    
    if (savedName === "Custom Image" && savedUrl) {
      setTheme({ name: "Custom Image", type: "image", value: savedUrl })
    } else if (savedName) {
      const found = THEMES.find(t => t.name === savedName)
      if (found) setTheme(found)
    }
  }, [])

  const saveTheme = (t: ThemeWallpaper) => {
    setTheme(t)
    localStorage.setItem("erp-wallpaper-name", t.name)
    if (t.name === "Custom Image") {
      localStorage.setItem("erp-wallpaper-custom-url", t.value)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: saveTheme }}>
      <div className="fixed inset-0 w-full h-full -z-50 bg-black">
         {mounted && theme.type === 'image' ? (
           <img src={theme.value} className="w-full h-full object-cover opacity-80 transition-opacity duration-1000" alt="bg" />
         ) : mounted && theme.type === 'mesh' ? (
           <div className={`w-full h-full ${theme.value}`} />
         ) : (
           <img src={THEMES[0].value} className="w-full h-full object-cover opacity-80" alt="bg" />
         )}
         {/* Dark tinted overlay to guarantee text readability (Vibrancy emulation) */}
         <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />
      </div>
      <div id="app-main-layout" className="relative flex h-screen w-full flex-col text-white">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
export const useAppTheme = () => useContext(ThemeContext)

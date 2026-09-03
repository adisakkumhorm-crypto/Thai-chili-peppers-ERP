"use client"
import { useState } from "react"
import { Image as ImageIcon, Plus } from "lucide-react"
import { useAppTheme, THEMES } from "./app-background"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function ThemeSwitcher() {
  const { theme, setTheme } = useAppTheme()
  const [customUrl, setCustomUrl] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center px-2 py-2 rounded-2xl bg-black/40 backdrop-blur-3xl border border-white/10 hover:bg-black/50 transition-all outline-none cursor-pointer">
        <div className="flex items-center gap-3 w-full">
          <div className="flex shrink-0 items-center justify-center size-9 rounded-full bg-white/10 shadow-sm text-white">
            <ImageIcon className="size-4" />
          </div>
          <div className="grid flex-1 leading-tight text-left group-data-[collapsible=icon]:hidden text-white">
            <span className="truncate text-sm font-bold">Wallpaper</span>
            <span className="truncate text-[10px] font-bold tracking-widest uppercase mt-0.5 opacity-70">
              {theme.name === "Custom Image" ? "Custom" : theme.name}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56 bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-xl p-1 mb-2 text-white">
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.name} onClick={() => setTheme(t)} className={`cursor-pointer hover:bg-white/20 focus:bg-white/20 rounded-lg p-2 ${theme.name === t.name ? 'bg-white/20 font-bold' : 'opacity-80'}`}>
            {t.name}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator className="bg-white/10 my-1" />
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault() // ป้องกันไม่ให้ Dropdown ปิด
                setDialogOpen(true)
              }}
              className={`cursor-pointer hover:bg-white/20 focus:bg-white/20 rounded-lg p-2 flex items-center justify-between ${theme.name === "Custom Image" ? 'bg-white/20 font-bold' : 'opacity-80'}`}
            >
              <span>Custom Image...</span>
              <Plus className="size-3" />
            </DropdownMenuItem>
          } />
          <DialogContent className="sm:max-w-[425px] bg-slate-900/80 backdrop-blur-3xl border-white/10 text-white shadow-2xl">
            <DialogHeader>
              <DialogTitle>ตั้งค่าภาพพื้นหลังของคุณเอง</DialogTitle>
              <DialogDescription className="text-white/60">
                วางลิงก์รูปภาพ (Image URL) เพื่อตั้งเป็น Wallpaper ของคุณ รูปภาพนี้จะแสดงเฉพาะในเครื่องของคุณเท่านั้น
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="url" className="text-white">Image URL (ลิงก์รูปภาพ)</Label>
                <Input
                  id="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/my-photo.jpg"
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/30"
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="bg-transparent border-white/10 hover:bg-white/10 hover:text-white text-white">
                ยกเลิก
              </Button>
              <Button 
                onClick={() => {
                  if (customUrl) {
                    setTheme({ name: "Custom Image", type: "image", value: customUrl })
                    setDialogOpen(false)
                    setCustomUrl("") // รีเซ็ตหลังบันทึก
                  }
                }} 
                disabled={!customUrl}
                className="bg-blue-600 hover:bg-blue-500 text-white border-0"
              >
                บันทึก Wallpaper
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

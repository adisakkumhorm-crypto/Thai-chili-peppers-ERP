"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Edit2, Loader2, X } from "lucide-react"
import { updateOTMultiplier } from "../actions"

export function EditOTMultiplier({ timesheetId, currentMultiplier }: { timesheetId: string, currentMultiplier: number | null }) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [multiplier, setMultiplier] = useState<string>(String(currentMultiplier || 1.5))
  const router = useRouter()

  const handleSave = async () => {
    const val = parseFloat(multiplier)
    if (isNaN(val) || val <= 0) return
    
    setLoading(true)
    const res = await updateOTMultiplier(timesheetId, val)
    setLoading(false)
    
    if (res?.success) {
      setIsEditing(false)
      router.refresh()
    } else {
      alert("Error: " + res?.error)
    }
  }

  if (!isEditing) {
    return (
      <button 
        onClick={() => setIsEditing(true)}
        className="ml-1 inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 transition-colors"
      >
        (x{currentMultiplier || 1.5}) <Edit2 className="size-3" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-1 justify-center">
      <select 
        className="text-[10px] p-0.5 border rounded bg-white text-black"
        value={multiplier}
        onChange={(e) => setMultiplier(e.target.value)}
        disabled={loading}
      >
        <option value="1">1x (วันหยุด-รายเดือน)</option>
        <option value="1.5">1.5x (วันธรรมดา)</option>
        <option value="2">2x (วันหยุด-รายวัน)</option>
        <option value="3">3x (OT วันหยุด)</option>
      </select>
      <button disabled={loading} onClick={handleSave} className="text-green-600 hover:text-green-800">
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      </button>
      <button disabled={loading} onClick={() => setIsEditing(false)} className="text-red-500 hover:text-red-700">
        <X className="size-3" />
      </button>
    </div>
  )
}

"use client"
import { useState, useEffect, useRef } from "react"
import { Camera, MapPin, Loader2, CheckCircle2, ScanFace, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { processMobileCheckIn } from "../actions"
import * as faceapi from '@vladmandic/face-api'
import { getEmployeesForFaceScan, processFaceCheckIn } from "../../hr/face-actions"
import { createClient } from "@/lib/supabase/client"

export function CheckInClient({ projects }: { projects: any[] }) {
  const [projectId, setProjectId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null)
  const [locationError, setLocationError] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [intent, setIntent] = useState<"check_in" | "check_out" | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [statusText, setStatusText] = useState("กำลังโหลด AI Model...")
  
  const [employees, setEmployees] = useState<any[]>([])
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // 1. Get GPS Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLocationError("ไม่สามารถดึงพิกัด GPS ได้")
      )
    } else {
      setLocationError("เบราว์เซอร์ไม่รองรับ GPS")
    }

    // 2. Load Models & Employees Data
    async function loadData() {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        
        const emps = await getEmployeesForFaceScan()
        setEmployees(emps)
        
        if (emps.length > 0) {
          const labeledDescriptors = emps
            .filter((e: any) => e.face_descriptor)
            .map((e: any) => {
              const desc = new Float32Array(JSON.parse(e.face_descriptor))
              return new faceapi.LabeledFaceDescriptors(e.id, [desc])
            })
          
          if (labeledDescriptors.length > 0) {
            setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.6))
          }
        }
        
        setModelsLoaded(true)
        setStatusText("พร้อมใช้งาน")
      } catch (err) {
        console.error(err)
        setStatusText("โหลด AI Model ไม่สำเร็จ")
      }
    }
    loadData()
  }, [])

  async function startScanner(selectedIntent: "check_in" | "check_out") {
    setIntent(selectedIntent)
    setShowScanner(true)
    setStatusText("กำลังเปิดกล้อง...")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      streamRef.current = stream
      setStatusText("กำลังสแกนใบหน้า...")
    } catch (err) {
      console.error(err)
      toast.error("ไม่สามารถเข้าถึงกล้องได้")
      setShowScanner(false)
    }
  }

  function stopScanner() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowScanner(false)
  }

  async function captureAndCheckIn() {
    if (!videoRef.current || !faceMatcher || loading) return
    
    setLoading(true)
    setStatusText("กำลังประมวลผล...")
    
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()
      
      if (!detection) {
        toast.error("ไม่พบใบหน้า กรุณามองที่กล้องให้ชัดเจน")
        setLoading(false)
        setStatusText("กำลังสแกนใบหน้า...")
        return
      }

      const match = faceMatcher.findBestMatch(detection.descriptor)
      if (match.label === "unknown") {
        toast.error("ใบหน้าไม่ตรงกับฐานข้อมูล")
        setLoading(false)
        setStatusText("กำลังสแกนใบหน้า...")
        return
      }

      const employeeId = match.label
      const emp = employees.find((e: any) => e.id === employeeId)
      
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(videoRef.current, 0, 0)
      
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8))
      let photoPath = null
      
      if (blob) {
        const filename = `${employeeId}-${Date.now()}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("timesheet-photos")
          .upload(filename, blob, { contentType: "image/jpeg" })
          
        if (!uploadError && uploadData) {
          photoPath = uploadData.path
        }
      }
      
      const res = await processFaceCheckIn(employeeId, projectId || null, photoPath, location, intent || undefined)
      
      if (res.error) {
        toast.error(res.error)
      } else if (res.success) {
        if (res.action === "check_in") {
          toast.success(`เข้างานสำเร็จ: ${res.employeeName}`)
        } else {
          toast.success(`ออกงานสำเร็จ: ${res.employeeName} (${res.hours} ชั่วโมง)`)
        }
        stopScanner()
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "เกิดข้อผิดพลาดในการสแกน")
    }
    
    setLoading(false)
    if (showScanner) setStatusText("กำลังสแกนใบหน้า...")
  }

  useEffect(() => {
    return () => stopScanner()
  }, [])

  return (
    <Card className="overflow-hidden border-2">
      <div className="bg-muted p-3 flex justify-between items-center text-xs font-medium">
        <div className="flex items-center gap-1.5 text-blue-600">
          <MapPin className="size-4" /> 
          {location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : (locationError || "กำลังหาพิกัด...")}
        </div>
      </div>
      
      <CardContent className="p-0">
        <div className="relative bg-black/5 aspect-[4/3] flex flex-col items-center justify-center overflow-hidden border-b">
          {!modelsLoaded ? (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 w-full">
              <Loader2 className="size-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </div>
          ) : showScanner ? (
             <div className="w-full h-full max-w-sm mx-auto relative bg-black flex flex-col justify-between">
                <div className="relative flex-grow flex items-center justify-center overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  {/* Face Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                    <div className="w-56 h-72 border-4 border-dashed border-white/60 rounded-[120px] shadow-[0_0_0_999px_rgba(0,0,0,0.45)] animate-pulse"></div>
                  </div>
                  <div className="absolute top-2 inset-x-0 text-center z-20">
                    <span className="bg-black/50 text-white px-3 py-1.5 rounded-full text-xs">
                      {statusText}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-background grid grid-cols-2 gap-2 shrink-0">
                  <Button variant="secondary" onClick={stopScanner} disabled={loading}>
                    ยกเลิก
                  </Button>
                  <Button onClick={captureAndCheckIn} disabled={loading} className={intent === "check_in" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}>
                    {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ScanFace className="mr-2 size-4" />}
                    {intent === "check_in" ? "บันทึกเข้างาน" : "บันทึกออกงาน"}
                  </Button>
                </div>
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 w-full">
              <div className="bg-primary/10 p-4 rounded-full">
                <ScanFace className="size-12 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">สแกนใบหน้าเข้า-ออกงาน</p>
                <p className="text-sm text-muted-foreground max-w-xs mt-1">
                  กรุณาตรวจสอบว่ามีข้อมูลใบหน้าในระบบแล้วก่อนกดเปิดกล้อง
                </p>
              </div>
              
              <div className="flex flex-col w-full gap-2 mt-2">
                <Button 
                  onClick={() => startScanner("check_in")} 
                  className="rounded-full shadow-sm w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Camera className="mr-2 size-4" />
                  เข้างาน (Check-in)
                </Button>
                <Button 
                  onClick={() => startScanner("check_out")} 
                  className="rounded-full shadow-sm w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Camera className="mr-2 size-4" />
                  ออกงาน (Check-out)
                </Button>
                
                {!faceMatcher && (
                  <p className="text-xs text-red-500 mt-2">
                    *ยังไม่มีพนักงานคนใดลงทะเบียนใบหน้าในระบบ
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4 bg-card">
          <div className="space-y-2">
            <Label>เลือกไซต์งาน / โปรเจกต์ (ถ้ามี)</Label>
            <Select onValueChange={(val) => setProjectId(val || "")} value={projectId}>
              <SelectTrigger><SelectValue placeholder="-- ทำงานทั่วไป (ไม่ระบุ) --" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- ทำงานทั่วไป (ไม่ระบุ) --</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

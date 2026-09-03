"use client"
import { useState, useEffect, useRef } from "react"
import { ScanFace, Camera, CameraOff, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import * as faceapi from '@vladmandic/face-api'
import { getEmployeesForFaceScan, processFaceCheckIn } from "../face-actions"
import { createClient } from "@/lib/supabase/client"

export function ScannerClient({ projects }: { projects: any[] }) {
  const [projectId, setProjectId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [statusText, setStatusText] = useState("กำลังโหลด AI Model...")
  
  const [employees, setEmployees] = useState<any[]>([])
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null)
  const [location, setLocation] = useState<any>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
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

  async function startScanner() {
    setShowScanner(true)
    setStatusText("กำลังเปิดกล้องและหาตำแหน่ง GPS...")
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        (err) => {
          console.error("GPS Error:", err)
          toast.warning("ไม่สามารถระบุตำแหน่ง GPS ได้")
        }
      )
    }

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
      
      const res = await processFaceCheckIn(employeeId, projectId || null, photoPath, location)
      
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
    <div className="space-y-6">
      {!modelsLoaded ? (
        <div className="text-center p-6 border rounded-lg bg-muted/20">
          <Loader2 className="size-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
      ) : showScanner ? (
        <div className="mx-auto max-w-sm rounded-lg overflow-hidden border bg-black relative">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-auto object-cover"
          />
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center text-xs text-white bg-black/50 px-2 py-1 rounded">
            <span>{statusText}</span>
            {location && <MapPin className="size-3 text-green-400" />}
          </div>
          <div className="p-4 bg-background grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={stopScanner} disabled={loading}>
              <CameraOff className="mr-2 size-4" /> ยกเลิก
            </Button>
            <Button onClick={captureAndCheckIn} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ScanFace className="mr-2 size-4" />}
              สแกนตอนนี้
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 p-6 rounded-lg border border-dashed text-center space-y-4">
          <div className="mx-auto bg-background p-4 rounded-full w-16 h-16 flex items-center justify-center border shadow-sm">
            <ScanFace className="size-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">AI Face Scan Check-in</h3>
            <p className="text-sm text-muted-foreground mt-1">
              ระบบสแกนใบหน้าอัตโนมัติพร้อมบันทึกพิกัด GPS
            </p>
          </div>
          
          <div className="max-w-xs mx-auto space-y-4 pt-4 text-left">
            <div className="space-y-2">
              <Label>โปรเจกต์ / ไซต์งาน (ถ้ามี)</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">-- ทำงานทั่วไป (ไม่ระบุ) --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <Button onClick={startScanner} className="w-full h-12 text-lg">
              <Camera className="mr-2 size-5" />
              เปิดกล้องสแกนหน้า
            </Button>
            
            {!faceMatcher && (
              <p className="text-xs text-red-500 text-center">
                *ยังไม่มีพนักงานที่มีข้อมูลใบหน้าในระบบ
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

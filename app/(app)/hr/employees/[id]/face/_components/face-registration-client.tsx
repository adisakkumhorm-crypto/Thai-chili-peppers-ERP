"use client"

import { useState, useEffect, useRef } from "react"
import { Camera, CameraOff, ScanFace, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import * as faceapi from '@vladmandic/face-api'
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { updateFaceDescriptor } from "../../../../face-actions"

export function FaceRegistrationClient({ employeeId, hasExisting }: { employeeId: string, hasExisting: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [statusText, setStatusText] = useState("กำลังโหลด AI Model...")
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setModelsLoaded(true)
        setStatusText("พร้อมใช้งาน")
      } catch (err) {
        console.error(err)
        setStatusText("โหลด AI Model ไม่สำเร็จ")
      }
    }
    loadModels()
    return () => stopCamera()
  }, [])

  async function startCamera() {
    setIsCameraOpen(true)
    setStatusText("กำลังเปิดกล้อง...")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      streamRef.current = stream
      setStatusText("มองที่กล้องแล้วกด 'บันทึกใบหน้า'")
    } catch (err) {
      console.error(err)
      toast.error("ไม่สามารถเข้าถึงกล้องได้")
      setIsCameraOpen(false)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsCameraOpen(false)
  }

  async function captureAndSave() {
    if (!videoRef.current || loading) return
    
    setLoading(true)
    setStatusText("กำลังวิเคราะห์ใบหน้า...")
    
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor()
      
      if (!detection) {
        toast.error("ไม่พบใบหน้า กรุณามองกล้องให้ชัดเจน ไม่มีสิ่งบดบัง")
        setStatusText("มองที่กล้องแล้วกด 'บันทึกใบหน้า'")
        setLoading(false)
        return
      }

      setStatusText("กำลังบันทึกข้อมูลเข้าสู่ระบบ...")
      
      const descriptorArray = Array.from(detection.descriptor)
      
      const res = await updateFaceDescriptor(employeeId, descriptorArray)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("บันทึกข้อมูลใบหน้าสำเร็จ")
        stopCamera()
        router.push("/hr/employees")
      }
    } catch (err: any) {
      console.error(err)
      toast.error("เกิดข้อผิดพลาดในการบันทึก")
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          
          {hasExisting && !isCameraOpen && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="size-5 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium">พนักงานรายนี้มีข้อมูลใบหน้าในระบบแล้ว</h4>
                <p className="text-sm mt-1 text-emerald-600">
                  หากต้องการอัปเดตข้อมูลใหม่ให้แม่นยำขึ้น สามารถเปิดกล้องแล้วบันทึกทับได้เลย
                </p>
              </div>
            </div>
          )}

          {!modelsLoaded ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg">
              <Loader2 className="size-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-muted-foreground">{statusText}</p>
            </div>
          ) : isCameraOpen ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4] sm:aspect-video flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                {/* Face Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="w-48 h-64 sm:w-56 sm:h-72 border-4 border-dashed border-white/60 rounded-[100px] shadow-[0_0_0_999px_rgba(0,0,0,0.45)] animate-pulse"></div>
                </div>
                <div className="absolute top-4 inset-x-0 text-center z-20">
                  <span className="bg-black/50 text-white px-3 py-1.5 rounded-full text-sm">
                    {statusText}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button type="button" variant="outline" className="w-full" onClick={stopCamera} disabled={loading}>
                  <CameraOff className="mr-2 size-4" /> ยกเลิก
                </Button>
                <Button type="button" className="w-full" onClick={captureAndSave} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ScanFace className="mr-2 size-4" />
                  )}
                  บันทึกใบหน้า
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
              <ScanFace className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">พร้อมสำหรับการลงทะเบียน</h3>
              <p className="text-sm text-muted-foreground mb-6">
                กรุณาให้พนักงานมองกล้องตรงๆ ในพื้นที่ที่มีแสงสว่างเพียงพอ
              </p>
              <Button onClick={startCamera}>
                <Camera className="mr-2 size-4" /> เปิดกล้องเพื่อลงทะเบียน
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

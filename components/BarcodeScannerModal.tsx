"use client"
import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (decodedText: string) => void
}

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }: BarcodeScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Scanner စတင်ရန် Div element ရှိမရှိ စစ်ဆေးခြင်း
    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 150 } // Barcode အတွက် အကျယ်ပိုကျယ်အောင် ပြုလုပ်ထားပါသည်
    }

    // အနောက်ဘက် ကင်မရာ (environment) ကို ဦးစားပေး ဖွင့်ခိုင်းခြင်း
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScanSuccess(decodedText)
        handleClose() // Scan ဖတ်မိပါက ကင်မရာ ပိတ်မည်
      },
      (errorMessage) => {
        // Scan မဖတ်မိသေးသည့် Frame အမှားများကို ငြိမ်သက်ထားရန်
      }
    ).catch((err) => {
      console.error("Camera access error:", err)
    })

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((e) => console.error("Stop error:", e))
      }
    }
  }, [isOpen])

  const handleClose = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-base">📷</span>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Scan Item Barcode</h3>
          </div>
          <button 
            onClick={handleClose} 
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Camera Display Box */}
        <div className="p-4 flex flex-col items-center justify-center bg-black">
          <div id="reader" className="w-full overflow-hidden rounded-lg"></div>
          <p className="text-[11px] text-gray-300 mt-3 font-medium text-center">
            ပါဆယ်ပေါ်ရှိ Barcode သို့မဟုတ် QR Code ကို ကင်မရာထဲ တည့်တည့်ချိန်ပေးပါ
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button 
            onClick={handleClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
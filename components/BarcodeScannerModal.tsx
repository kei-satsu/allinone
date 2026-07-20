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

    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    const config = { 
      fps: 15, 
      qrbox: { width: 260, height: 160 }
    }

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScanSuccess(decodedText)
        handleClose()
      },
      () => {
        // Silent frame scanning errors
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
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl shadow-orange-500/10 flex flex-col">
        
        {/* ── Modal Header ── */}
        <div className="px-5 py-4 bg-zinc-900/90 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              {/* Scanner Icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Barcode Scanner</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Camera Active</span>
              </div>
            </div>
          </div>

          <button 
            onClick={handleClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Camera Viewport & Scanning Visuals ── */}
        <div className="p-4 bg-zinc-950 flex flex-col items-center justify-center relative">
          <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            
            {/* HTML5 QR Code Container */}
            <div id="reader" className="w-full overflow-hidden [&>video]:object-cover [&>video]:rounded-2xl"></div>

            {/* Custom Viewfinder Overlay (Corner Brackets & Laser) */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative w-full h-40 max-w-[260px]">
                {/* Top-Left Corner */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-500 rounded-tl-lg"></div>
                {/* Top-Right Corner */}
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-500 rounded-tr-lg"></div>
                {/* Bottom-Left Corner */}
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-500 rounded-bl-lg"></div>
                {/* Bottom-Right Corner */}
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-500 rounded-br-lg"></div>

                {/* Animated Glowing Scan Line */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.8)]"></div>
              </div>
            </div>

          </div>

          <p className="text-[11px] text-zinc-400 mt-3.5 font-medium text-center flex items-center gap-1.5 bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800">
            <span>🎯</span>
            ပါဆယ်ပေါ်ရှိ Barcode ကို ဘောင်အတွင်း တည့်တည့်ချိန်ပေးပါ
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="p-3.5 bg-zinc-900/90 border-t border-zinc-800 flex justify-end">
          <button 
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all active:scale-95 border border-zinc-700/50"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
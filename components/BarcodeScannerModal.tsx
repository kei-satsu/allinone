'use client'

import { useEffect, useRef, useState } from 'react'
import { Scanner, type IDetectedBarcode, type IScannerError } from '@yudiel/react-qr-scanner'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (decodedText: string) => void
}

const BARCODE_FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13'] as const

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }: BarcodeScannerModalProps) {
  const hasHandledScan = useRef(false)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    if (isOpen) hasHandledScan.current = false
  }, [isOpen])

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (!isOpen || hasHandledScan.current) return
    const decodedText = detectedCodes[0]?.rawValue?.trim()
    if (!decodedText) return

    hasHandledScan.current = true
    onScanSuccess(decodedText)
    onClose()
  }

  const handleScannerError = (error: IScannerError) => {
    setCameraError(error.message || 'Camera ကို ဖွင့်၍မရပါ။ Browser camera permission ကိုစစ်ပါ။')
  }

  const handleClose = () => {
    setCameraError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Barcode Scanner">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden border border-zinc-800 bg-zinc-900 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Barcode Scanner</h2>
            <p className="mt-0.5 text-[11px] text-zinc-400">Barcode ကို ဘောင်အတွင်း ချိန်ပါ</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close scanner" className="flex h-10 w-10 items-center justify-center text-zinc-300 transition hover:bg-zinc-800 hover:text-white">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="relative m-3 min-h-[260px] overflow-hidden bg-black sm:m-4">
          <Scanner
            onScan={handleScan}
            onError={handleScannerError}
            formats={[...BARCODE_FORMATS]}
            constraints={{ facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }}
            retryDelay={100}
            startTimeoutMs={5000}
            allowMultiple={false}
            sound={false}
            styles={{ container: { width: '100%', height: '100%', minHeight: '260px' }, video: { width: '100%', height: '100%', objectFit: 'cover' } }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] top-1/2 h-28 -translate-y-1/2 border-y-2 border-emerald-400/90">
            <span className="absolute inset-x-0 top-1/2 h-px bg-emerald-300/70 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
          </div>
        </div>

        <div className="min-h-12 px-4 pb-3">
          {cameraError ? <p role="alert" className="text-xs text-rose-300">{cameraError}</p> : <p className="text-xs text-zinc-400">ဖတ်ပြီးသည်နှင့် စာရင်းကို အလိုအလျောက်ရှာပါမည်။</p>}
        </div>

        <div className="border-t border-zinc-800 p-3">
          <button type="button" onClick={handleClose} className="min-h-11 w-full border border-zinc-700 bg-zinc-800 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700">Cancel</button>
        </div>
      </div>
    </div>
  )
}
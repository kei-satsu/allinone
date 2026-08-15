"use client"

import { useRef, useState } from "react"

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void
}

export default function ImageUploader({ onUploadSuccess }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("ဓာတ်ပုံဖိုင်သာ ရွေးချယ်ပါ")
      event.target.value = ""
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload-r2", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data?.url || typeof data.url !== "string") {
        throw new Error(data?.error || "Image upload failed")
      }

      setImageUrl(data.url)
      onUploadSuccess(data.url)
    } catch (error: any) {
      console.error("R2 upload failed:", error)
      alert(error.message || "ပုံတင်ရာတွင် အမှားဖြစ်ပါသည်")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {imageUrl && (
        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded Preview" className="w-full h-full object-contain" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 border-dashed rounded-xl text-zinc-400 hover:text-white text-sm font-medium transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5 text-zinc-500 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {uploading ? "Uploading to R2..." : imageUrl ? "Change Voucher Image" : "Upload Voucher Image"}
      </button>
    </div>
  )
}
"use client"

import { useRef, useState } from "react"

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void
}

export default function ImageUploader({ onUploadSuccess }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const openFileDialog = () => {
    inputRef.current?.click()
  }

  const handleSaveImage = () => {
    if (!imageUrl) return

    const link = document.createElement("a")
    link.href = imageUrl
    link.download = "voucher-image"
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

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
        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-950 shadow-inner">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="block w-full h-full group"
            aria-label="Preview uploaded image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Uploaded Preview" className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]" />
          </button>

          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg bg-black/60 text-white p-2 hover:bg-black/80 transition-colors"
              aria-label="Open image preview"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12zm9.5 3a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSaveImage}
              className="rounded-lg bg-orange-500 text-white p-2 hover:bg-orange-600 transition-colors"
              aria-label="Save image"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={openFileDialog}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 rounded-xl text-zinc-300 hover:text-white text-sm font-medium transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 text-zinc-500 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {uploading ? "Uploading to R2..." : imageUrl ? "Select New Image" : "Upload Voucher Image"}
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-3 py-3 bg-zinc-700/80 hover:bg-zinc-700 text-zinc-100 rounded-xl text-sm font-medium transition-colors"
          >
            Preview
          </button>
        )}
      </div>

      {previewOpen && imageUrl && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-700 rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              aria-label="Close preview"
            >
              ✕
            </button>

            <div className="overflow-hidden rounded-xl bg-black/40 border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Voucher Preview" className="max-h-[75vh] w-full object-contain" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveImage}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
              >
                Save Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
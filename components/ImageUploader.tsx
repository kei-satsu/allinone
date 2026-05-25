"use client"

import { CldUploadWidget } from "next-cloudinary"
import { useState } from "react"

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void
}

export default function ImageUploader({ onUploadSuccess }: ImageUploaderProps) {
  const [imageUrl, setImageUrl] = useState<string>("")

  return (
    <div className="space-y-3">
      {/* ပုံ Preview ပြမယ့်နေရာ */}
      {imageUrl && (
        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded Preview" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Cloudinary Widget Button */}
      <CldUploadWidget 
        uploadPreset="for_allinone"
        onSuccess={(result) => {
          if (result?.info && typeof result.info !== "string") {
            const secureUrl = result.info.secure_url
            setImageUrl(secureUrl)
            onUploadSuccess(secureUrl) // Parent Form ဆီ URL လှမ်းပို့ပေးတာ
          }
        }}
        options={{
          multiple: false,
          resourceType: "image",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 5000000, // Max 5MB
          styles: {
            palette: {
              window: "#18181b", // Dark Theme နဲ့ ကိုက်အောင် ညှိပေးထားတာပါ
              sourceBg: "#18181b",
              windowBorder: "#27272a",
              tabIcon: "#f97316",
              inactiveTabIcon: "#71717a",
              menuIcons: "#a1a1aa",
              link: "#f97316",
              action: "#f97316",
              inProgress: "#f97316",
              complete: "#22c55e",
              error: "#ef4444",
              textDark: "#000000",
              textLight: "#ffffff"
            }
          }
        }}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => open()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 border-dashed rounded-xl text-zinc-400 hover:text-white text-sm font-medium transition-all group"
          >
            <svg className="w-5 h-5 text-zinc-500 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {imageUrl ? "Change Voucher Image" : "Upload Voucher Image"}
          </button>
        )}
      </CldUploadWidget>
    </div>
  )
}
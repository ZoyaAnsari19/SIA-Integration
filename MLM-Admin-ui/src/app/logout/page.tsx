"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { removeUserSession } from "@/lib/api/auth"

export default function Logout() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(true)
  }, [])

  const handleCancel = () => {
    setOpen(false)
    router.back()
  }

  const handleConfirm = () => {
    try {
      // Remove user session (clears both localStorage and sessionStorage)
      removeUserSession()
    } catch {}
    setOpen(false)
    router.replace("/login")
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Logout</h1>
            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
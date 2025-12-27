"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useF2FAuth } from "@/hooks/use-f2f-auth"
import { F2F_AUTH_DEFAULT_MESSAGE } from "@/lib/f2f-auth"

export function F2FAuthBanner() {
  const { state } = useF2FAuth()

  if (!state.required) return null

  return (
    <Alert
      variant="destructive"
      className="border-orange-200 bg-orange-50 text-orange-900"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>F2F re-authentication required</AlertTitle>
      <AlertDescription className="flex flex-col gap-1 text-sm">
        <span>{state.message || F2F_AUTH_DEFAULT_MESSAGE}</span>
        <Link
          href="/manager/settings#f2f-cookies"
          className="font-semibold underline underline-offset-4"
        >
          Update F2F cookies
        </Link>
      </AlertDescription>
    </Alert>
  )
}

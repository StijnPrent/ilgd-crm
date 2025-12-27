import { ApiError } from "@/lib/api"

export const F2F_AUTH_ERROR_CODE = "F2F_AUTH_REQUIRED"
export const F2F_AUTH_DEFAULT_MESSAGE =
  "F2F token expired. Update the cookies in settings to resume syncing."

interface F2FAuthError {
  required: boolean
  message?: string
}

export const parseF2FAuthError = (error: unknown): F2FAuthError => {
  const candidate = error instanceof ApiError ? error : (error as any)
  if (!candidate || typeof candidate.status !== "number") {
    return { required: false }
  }

  if (candidate.status !== 401) {
    return { required: false }
  }

  const data = candidate.data
  const code = typeof data === "object" && data ? (data as any).error : undefined

  if (code === F2F_AUTH_ERROR_CODE) {
    const rawMessage =
      (typeof data?.message === "string" && data.message.trim()) ||
      undefined

    return {
      required: true,
      message: rawMessage ?? F2F_AUTH_DEFAULT_MESSAGE,
    }
  }

  return { required: false }
}

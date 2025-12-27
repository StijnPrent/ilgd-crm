"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Loader2, Settings as SettingsIcon } from "lucide-react"
import { BonusAdminPanel } from "@/components/bonus-admin"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogoutButton } from "@/components/logout-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import currenciesData from "@/data/currencies.json"
import timezonesData from "@/data/timezones.json"
import { Pencil } from "lucide-react"
type F2FAccountType = "creator" | "model"
interface F2FEntryForm {
  localId: string
  type: F2FAccountType
  cookies: string
  name?: string
  modelId?: string
  updatedAt?: Date | null
  sessionid: string
  shieldFPC: string
  csrftoken: string
  otherCookies: string
  allowedEarningTypeIds: string[]
  allowedEarningTypes?: string[]
}

interface NormalizedCookiesPayload {
  entries: F2FEntryForm[]
  updatedAt: Date | null
}

interface EarningTypeOption {
  id: string
  code: string
  label: string
}

interface CompanyFormState {
  name: string
  currency: string
  timezone: string
}

interface NormalizedCompanyResponse {
  form: CompanyFormState
  updatedAt: Date | null
}

const DEFAULT_COMPANY_FORM: CompanyFormState = {
  name: "",
  currency: "EUR",
  timezone: "Europe/Amsterdam",
}

const AVAILABLE_CURRENCIES: readonly string[] = currenciesData
const AVAILABLE_TIMEZONES: readonly string[] = timezonesData

function normalizeCompanySettings(value: any): NormalizedCompanyResponse {
  const name =
    (value?.name as string) ??
    (value?.companyName as string) ??
    (value?.businessName as string) ??
    ""
  const currency = (value?.currency as string) ?? (value?.companyCurrency as string) ?? "EUR"
  const timezone =
    (value?.timezone as string) ??
    (value?.timeZone as string) ??
    (value?.tz as string) ??
    "Europe/Amsterdam"
  const rawUpdatedAt = value?.updatedAt ?? value?.lastUpdatedAt ?? value?.updated_at
  let updatedAt: Date | null = null
  if (rawUpdatedAt) {
    const parsed = new Date(rawUpdatedAt)
    if (!Number.isNaN(parsed.getTime())) {
      updatedAt = parsed
    }
  }

  return {
    form: {
      name: name?.trim() ?? "",
      currency: currency?.trim().toUpperCase() ?? "EUR",
      timezone: timezone?.trim() ?? "Europe/Amsterdam",
    },
    updatedAt,
  }
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    const fromNumber = new Date(value)
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
  }
  if (typeof value === "string") {
    const fromString = new Date(value)
    return Number.isNaN(fromString.getTime()) ? null : fromString
  }
  return null
}

const makeLocalId = () => `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`

const parseCookieFields = (raw: string | undefined | null) => {
  const base = { sessionid: "", shieldFPC: "", csrftoken: "", otherCookies: "" }
  if (!raw) return base
  const extras: string[] = []
  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const [keyRaw, ...rest] = part.split("=")
    const key = keyRaw?.trim()?.toLowerCase()
    const value = rest.join("=").trim()
    if (!key) continue
    if (key === "sessionid") {
      base.sessionid = value
      continue
    }
    if (key === "shield_fpc") {
      base.shieldFPC = value
      continue
    }
    if (key === "csrftoken") {
      base.csrftoken = value
      continue
    }
    extras.push(part)
  }
  base.otherCookies = extras.join("; ")
  return base
}

const buildCookieString = (entry: Pick<F2FEntryForm, "sessionid" | "shieldFPC" | "csrftoken" | "otherCookies">) => {
  const parts: string[] = []
  if (entry.sessionid.trim()) parts.push(`sessionid=${entry.sessionid.trim()}`)
  if (entry.shieldFPC.trim()) parts.push(`shield_FPC=${entry.shieldFPC.trim()}`)
  if (entry.csrftoken.trim()) parts.push(`csrftoken=${entry.csrftoken.trim()}`)
  const otherParts = (entry.otherCookies ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
  parts.push(...otherParts)
  return parts.join("; ")
}

const normalizeAllowedEarningTypeIds = (raw: any): string[] => {
  if (!raw) return []
  const source = Array.isArray(raw) ? raw : []
  const normalized = source
    .map((value) => {
      if (value === null || value === undefined) return null
      const stringValue = String(value).trim()
      return stringValue || null
    })
    .filter((value): value is string => !!value)
  const unique = Array.from(new Set(normalized))
  unique.sort()
  return unique
}

const normalizeEntry = (raw: any): F2FEntryForm => {
  const cookies = typeof raw?.cookies === "string" ? raw.cookies.trim() : ""
  const hasModel = raw?.model !== null && raw?.model !== undefined
  const name =
    typeof raw?.name === "string"
      ? raw.name.trim() || undefined
      : typeof raw?.label === "string"
        ? raw.label.trim() || undefined
        : undefined
  const modelIdRaw =
    raw?.modelId ??
    raw?.model_id ??
    (hasModel
      ? raw?.model?.id ??
        raw?.model?.modelId ??
        raw?.model?.model_id
      : undefined)
  const hasModelId = modelIdRaw !== null && modelIdRaw !== undefined
  const type: F2FAccountType = hasModel || hasModelId ? "model" : "creator"
  const modelId = hasModelId ? String(modelIdRaw).trim() : undefined
  const updatedAt = parseDate(raw?.updatedAt ?? raw?.updated_at)
  const allowedEarningTypeIds = normalizeAllowedEarningTypeIds(
    raw?.allowedEarningTypeIds ?? raw?.earningTypeIds ?? raw?.allowedEarningTypesIds,
  )
  const allowedEarningTypes = Array.isArray(raw?.allowedEarningTypes)
    ? raw.allowedEarningTypes
        .map((value: any) => (value === null || value === undefined ? null : String(value).trim()))
        .filter((value: string | null): value is string => !!value)
    : undefined
  const parsedFields = parseCookieFields(cookies)
  const combined = buildCookieString(parsedFields)

  return {
    localId: makeLocalId(),
    type,
    cookies: combined || cookies,
    name,
    modelId,
    updatedAt,
    sessionid: parsedFields.sessionid,
    shieldFPC: parsedFields.shieldFPC,
    csrftoken: parsedFields.csrftoken,
    otherCookies: parsedFields.otherCookies,
    allowedEarningTypeIds,
    allowedEarningTypes,
  }
}

const cloneEntry = (entry: F2FEntryForm): F2FEntryForm => ({
  ...entry,
  localId: makeLocalId(),
})

const createEmptyEntry = (allowedEarningTypeIds: string[] = []): F2FEntryForm => ({
  localId: makeLocalId(),
  type: "creator",
  cookies: "",
  name: "",
  modelId: undefined,
  updatedAt: null,
  sessionid: "",
  shieldFPC: "",
  csrftoken: "",
  otherCookies: "",
  allowedEarningTypeIds,
  allowedEarningTypes: [],
})

const serializeEntriesForCompare = (entries: F2FEntryForm[]) =>
  entries
    .map((e) => {
      const cookies = buildCookieString(e).trim()
      const modelId = e.type === "model" ? (e.modelId ?? "").trim() : ""
      const name = (e.name ?? "").trim()
      const earningTypes = (e.allowedEarningTypeIds ?? []).slice().sort().join(",")
      return `${e.type}|${cookies}|${modelId}|${name}|${earningTypes}`
    })
    .join("__")

const extractEntriesArray = (value: any): any[] => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.entries)) return value.entries
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.rows)) return value.rows
  return []
}

const normalizeEarningTypeOption = (raw: any): EarningTypeOption | null => {
  if (!raw) return null
  if (typeof raw === "string" || typeof raw === "number") {
    const value = String(raw).trim()
    if (!value) return null
    return { id: value, code: value, label: value }
  }
  const idCandidate =
    raw?.id ??
    raw?.value ??
    raw?.typeId ??
    raw?.type_id ??
    raw?.earningTypeId ??
    raw?.earning_type_id ??
    raw?.key ??
    raw?.slug ??
    raw?.code ??
    raw?.type
  const codeCandidate =
    raw?.code ??
    raw?.key ??
    raw?.slug ??
    raw?.type ??
    raw?.name ??
    raw?.label ??
    raw?.earningType ??
    raw?.earning_type
  const id = idCandidate !== undefined && idCandidate !== null ? String(idCandidate).trim() : ""
  const fallbackId = id || (codeCandidate ? String(codeCandidate).trim() : "")
  if (!fallbackId) return null

  const code = (codeCandidate ? String(codeCandidate).trim() : "") || fallbackId
  const label =
    (typeof raw?.label === "string" && raw.label.trim()) ||
    (typeof raw?.name === "string" && raw.name.trim()) ||
    (typeof raw?.description === "string" && raw.description.trim()) ||
    code ||
    fallbackId

  return {
    id: fallbackId,
    code,
    label,
  }
}

const normalizeEarningTypes = (value: any): EarningTypeOption[] => {
  const source = extractEntriesArray(value)
  const seen = new Set<string>()
  const normalized: EarningTypeOption[] = []

  for (const entry of source) {
    const option = normalizeEarningTypeOption(entry)
    if (!option) continue
    if (seen.has(option.id)) continue
    seen.add(option.id)
    normalized.push(option)
  }

  return normalized
}

function normalizeCookiesPayload(payload: any): NormalizedCookiesPayload {
  if (!payload) {
    return { entries: [], updatedAt: null }
  }

  const source = Array.isArray(payload) && payload.length > 0 ? payload : extractEntriesArray(payload)

  const entries: F2FEntryForm[] = extractEntriesArray(source)
    .map(normalizeEntry)
    .filter((e) => !!e.cookies)

  const updatedCandidate = entries.reduce<Date | null>((latest, entry) => {
    if (!entry.updatedAt) return latest
    if (!latest) return entry.updatedAt
    return entry.updatedAt > latest ? entry.updatedAt : latest
  }, null)

  return {
    entries,
    updatedAt: updatedCandidate,
  }
}

export default function ManagerSettingsPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cookieEntries, setCookieEntries] = useState<F2FEntryForm[]>([createEmptyEntry()])
  const [initialCookieEntries, setInitialCookieEntries] = useState<F2FEntryForm[]>([])
  const [initialEntriesKey, setInitialEntriesKey] = useState("")
  const [models, setModels] = useState<
    { id: string; displayName: string; username: string }[]
  >([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [earningTypes, setEarningTypes] = useState<EarningTypeOption[]>([])
  const [earningTypesLoading, setEarningTypesLoading] = useState(false)
  const [earningTypesError, setEarningTypesError] = useState<string | null>(null)
  const [editingNames, setEditingNames] = useState<Record<string, boolean>>({})
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(() => DEFAULT_COMPANY_FORM)
  const [initialCompanyForm, setInitialCompanyForm] = useState<CompanyFormState | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [isCompanySaving, setIsCompanySaving] = useState(false)
  const [companyUpdatedAt, setCompanyUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let isCancelled = false

    const bootstrap = async () => {
      if (typeof window === "undefined") return

      const storedUserStr = localStorage.getItem("user")
      if (!storedUserStr) {
        router.replace("/auth/login")
        return
      }

      try {
        const storedUser = JSON.parse(storedUserStr)
        if (storedUser.role !== "manager") {
          router.replace("/auth/login")
          return
        }
      } catch (error) {
        console.error("[settings] Failed to parse stored user", error)
        localStorage.removeItem("user")
        router.replace("/auth/login")
        return
      }

      if (isCancelled) return

    setIsAuthorized(true)
    setLoading(true)
    setCompanyLoading(true)
    setModelsLoading(true)
    setEarningTypesLoading(true)
    setLoadError(null)
    setCompanyError(null)
    setEarningTypesError(null)

    try {
      const payload = await api.getF2FCookies()
      console.log("Fetched F2F cookies payload:", payload)
      if (isCancelled) return
      const normalized = normalizeCookiesPayload(payload)
      const entries = normalized.entries.length ? normalized.entries : [createEmptyEntry()]

      setCookieEntries(entries.map(cloneEntry))
      setInitialCookieEntries(entries.map(cloneEntry))
      setInitialEntriesKey(serializeEntriesForCompare(entries))
      setLastUpdated(normalized.updatedAt)
    } catch (error) {
      if (isCancelled) return
      console.error("[settings] Failed to load F2F cookies", error)
      const message =
        (error as Error)?.message ?? "Could not fetch saved F2F cookies. Please try again later."
      setLoadError(message)
      toast({
        variant: "destructive",
        title: "Failed to load F2F cookies",
        description: "Check the server or try again later.",
      })
    } finally {
      if (!isCancelled) {
        setLoading(false)
      }
    }

    try {
      const earningTypesResponse = await api.getEarningTypes()
      if (!isCancelled) {
        const normalizedEarningTypes = normalizeEarningTypes(earningTypesResponse)
        setEarningTypes(normalizedEarningTypes)
      }
    } catch (error) {
      if (!isCancelled) {
        console.error("[settings] Failed to load earning types", error)
        setEarningTypesError(
          (error as Error)?.message ?? "Could not load earning types. Defaulting to all.",
        )
      }
    } finally {
      if (!isCancelled) {
        setEarningTypesLoading(false)
      }
    }

    try {
      const modelsResponse = await api.getModels()
      if (!isCancelled) {
        const normalizedModels =
          (modelsResponse || []).map((m: any) => ({
            id: String(m.id),
            displayName: m.displayName ?? m.name ?? m.username ?? `Model ${m.id}`,
            username: m.username ?? "",
          })) ?? []
        setModels(normalizedModels)
      }
    } catch (error) {
      if (!isCancelled) {
        console.error("[settings] Failed to load models", error)
      }
    } finally {
      if (!isCancelled) {
        setModelsLoading(false)
      }
    }

    try {
      const companyPayload = await api.getCompanySettings()
      if (isCancelled) return
      const normalizedCompany = normalizeCompanySettings(companyPayload)
      setCompanyForm(normalizedCompany.form)
      setInitialCompanyForm(normalizedCompany.form)
      setCompanyUpdatedAt(normalizedCompany.updatedAt ?? new Date())
    } catch (error) {
      if (isCancelled) return
      console.error("[settings] Failed to load company settings", error)
      setCompanyError(
        (error as Error)?.message ?? "Unable to load company settings at the moment.",
      )
    } finally {
      if (!isCancelled) {
        setCompanyLoading(false)
      }
    }

    }

    bootstrap()

    return () => {
      isCancelled = true
    }
  }, [router])

  const defaultAllowedEarningTypeIds = useMemo(
    () => earningTypes.map((type) => type.id),
    [earningTypes],
  )

  const entriesKey = useMemo(
    () => serializeEntriesForCompare(cookieEntries),
    [cookieEntries],
  )

  const hasChanges = useMemo(
    () => entriesKey !== initialEntriesKey,
    [entriesKey, initialEntriesKey],
  )

  useEffect(() => {
    if (!defaultAllowedEarningTypeIds.length) return

    setCookieEntries((prev) => {
      let changed = false
      const next = prev.map((entry) => {
        if ((entry.allowedEarningTypeIds ?? []).length > 0) return entry
        changed = true
        return { ...entry, allowedEarningTypeIds: defaultAllowedEarningTypeIds }
      })
      return changed ? next : prev
    })

    setInitialCookieEntries((prev) => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map((entry) => {
        if ((entry.allowedEarningTypeIds ?? []).length > 0) return entry
        changed = true
        return { ...entry, allowedEarningTypeIds: defaultAllowedEarningTypeIds }
      })
      if (changed) {
        setInitialEntriesKey(serializeEntriesForCompare(next))
        return next
      }
      return prev
    })
  }, [defaultAllowedEarningTypeIds])

  const statusMessage = useMemo(() => {
    if (loading) return "Loading current F2F cookies..."
    if (lastUpdated) {
      const relative = formatDistanceToNow(lastUpdated, { addSuffix: true })
      return `Last updated ${relative} (${lastUpdated.toLocaleString()})`
    }
    return "No F2F cookies saved yet."
  }, [lastUpdated, loading])

  const companyStatusMessage = useMemo(() => {
    if (companyLoading) return "Loading company settings..."
    if (companyUpdatedAt) {
      const relative = formatDistanceToNow(companyUpdatedAt, { addSuffix: true })
      return `Last saved ${relative} (${companyUpdatedAt.toLocaleString()})`
    }
    return "Company settings are not configured yet."
  }, [companyLoading, companyUpdatedAt])

  const companyHasChanges = useMemo(() => {
    if (!initialCompanyForm) return false
    return (
      companyForm.name.trim() !== initialCompanyForm.name ||
      companyForm.currency.trim() !== initialCompanyForm.currency ||
      companyForm.timezone.trim() !== initialCompanyForm.timezone
    )
  }, [companyForm, initialCompanyForm])

  const handleReset = () => {
    const resetEntries = initialCookieEntries.length
      ? initialCookieEntries.map(cloneEntry)
      : [createEmptyEntry(defaultAllowedEarningTypeIds)]
    setCookieEntries(resetEntries)
  }

  const handleCompanyReset = () => {
    if (!initialCompanyForm) return
    setCompanyForm(initialCompanyForm)
  }

  const updateEntry = (localId: string, changes: Partial<F2FEntryForm>) => {
    setCookieEntries((prev) =>
      prev.map((entry) =>
        entry.localId === localId
          ? (() => {
              const merged = {
                ...entry,
                ...changes,
                ...(changes.type === "creator" ? { modelId: undefined } : null),
              }
              if ("allowedEarningTypeIds" in changes) {
                merged.allowedEarningTypeIds = normalizeAllowedEarningTypeIds(
                  changes.allowedEarningTypeIds ?? [],
                )
              }
              return { ...merged, cookies: buildCookieString(merged) }
            })()
          : entry,
      ),
    )
  }

  const updateEntryEarningTypes = (
    localId: string,
    updater: (current: string[]) => string[],
  ) => {
    setCookieEntries((prev) =>
      prev.map((entry) => {
        if (entry.localId !== localId) return entry
        const nextIds = normalizeAllowedEarningTypeIds(
          updater(entry.allowedEarningTypeIds ?? []),
        )
        return { ...entry, allowedEarningTypeIds: nextIds }
      }),
    )
  }

  const handleToggleEarningType = (localId: string, earningTypeId: string, enabled: boolean) => {
    updateEntryEarningTypes(localId, (current) => {
      const set = new Set(current)
      if (enabled) {
        set.add(earningTypeId)
      } else {
        set.delete(earningTypeId)
      }
      return Array.from(set)
    })
  }

  const handleSelectAllEarningTypes = (localId: string) => {
    if (!defaultAllowedEarningTypeIds.length) return
    updateEntryEarningTypes(localId, () => defaultAllowedEarningTypeIds)
  }

  const handleClearEarningTypes = (localId: string) => {
    updateEntryEarningTypes(localId, () => [])
  }

  const addEntry = () => {
    setCookieEntries((prev) => [
      ...prev,
      createEmptyEntry(defaultAllowedEarningTypeIds),
    ])
  }

  const removeEntry = (localId: string) => {
    setEditingNames((prev) => {
      const next = { ...prev }
      delete next[localId]
      return next
    })
    setNameDrafts((prev) => {
      const next = { ...prev }
      delete next[localId]
      return next
    })
    setCookieEntries((prev) => {
      if (prev.length === 1) {
        return prev.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                cookies: "",
                modelId: undefined,
                type: "creator",
                name: "",
                sessionid: "",
                shieldFPC: "",
                csrftoken: "",
                otherCookies: "",
                allowedEarningTypeIds: defaultAllowedEarningTypeIds,
              }
            : entry,
        )
      }
      return prev.filter((entry) => entry.localId !== localId)
    })
  }

  const handleCompanySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isCompanySaving || !companyHasChanges) return

    const payload = {
      name: companyForm.name.trim(),
      currency: companyForm.currency.trim().toUpperCase(),
      timezone: companyForm.timezone.trim(),
    }

    setIsCompanySaving(true)
    setCompanyError(null)

    try {
      const response = await api.updateCompanySettings(payload)
      const normalizedCompany = normalizeCompanySettings(response)
      setCompanyForm(normalizedCompany.form)
      setInitialCompanyForm(normalizedCompany.form)
      setCompanyUpdatedAt(normalizedCompany.updatedAt ?? new Date())
      toast({
        title: "Company settings stored",
        description: "Currency, timezone, and contact info were updated.",
      })
    } catch (error) {
      console.error("[settings] Failed to save company settings", error)
      setCompanyError((error as Error)?.message ?? "Unable to save company settings")
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "The company settings could not be saved.",
      })
    } finally {
      setIsCompanySaving(false)
    }
  }

  const navSections = [
    { id: "company-settings", label: "Company settings" },
    { id: "f2f-cookies", label: "F2F cookies" },
    { id: "bonus-rules", label: "Bonus rules" },
  ]
  const [activeSection, setActiveSection] = useState(navSections[0].id)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving || !hasChanges) return

    let modelSelectionMissing = false
    let earningTypeSelectionMissing = false
    const cleanedEntries = cookieEntries
      .map((entry) => {
        const trimmedCookies = buildCookieString(entry).trim()
        if (!trimmedCookies) return null
        const normalized: any = {
          cookies: trimmedCookies,
        }
        if (entry.name && entry.name.trim()) {
          normalized.name = entry.name.trim()
        }
        const normalizedEarningTypes = normalizeAllowedEarningTypeIds(
          entry.allowedEarningTypeIds ?? [],
        )
        if (!normalizedEarningTypes.length && defaultAllowedEarningTypeIds.length > 0) {
          earningTypeSelectionMissing = true
          return null
        }
        if (normalizedEarningTypes.length > 0) {
          normalized.allowedEarningTypeIds = normalizedEarningTypes.map((value) => {
            const numeric = Number(value)
            return Number.isNaN(numeric) ? value : numeric
          })
        }
        if (entry.type === "model") {
          if (!entry.modelId) {
            modelSelectionMissing = true
            return null
          }
          const parsedId = Number(entry.modelId)
          normalized.modelId = Number.isNaN(parsedId) ? entry.modelId : parsedId
        } else {
          normalized.modelId = null
        }
        return normalized
      })
      .filter(Boolean) as any[]

    if (modelSelectionMissing) {
      setLoadError("Select a model for each model account.")
      return
    }
    if (earningTypeSelectionMissing) {
      setLoadError("Select at least one earning type for each account.")
      return
    }

    if (!cleanedEntries.length) {
      setLoadError("At least one cookie entry is required.")
      return
    }

    setIsSaving(true)
    setLoadError(null)

    try {
      const response = await api.updateF2FCookies(cleanedEntries)
      const normalized = normalizeCookiesPayload(response)
      const savedEntries = normalized.entries.length
        ? normalized.entries
        : cleanedEntries.map((entry) => normalizeEntry(entry))

      setCookieEntries(savedEntries.map(cloneEntry))
      setInitialCookieEntries(savedEntries.map(cloneEntry))
      setInitialEntriesKey(serializeEntriesForCompare(savedEntries))
      setLastUpdated(normalized.updatedAt ?? new Date())
      toast({
        title: "F2F cookies saved",
        description: "The F2F tokens were updated for all automations.",
      })
    } catch (error) {
      console.error("[settings] Failed to save F2F cookies", error)
      const message =
        (error as Error)?.message ?? "Failed to save F2F cookies. Please try again."
      setLoadError(message)
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Check your input or try again later.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Checking authentication...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-10 w-10 rounded-full border p-2 text-primary" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">System settings</h1>
                <p className="text-muted-foreground">
                  Manage F2F cookies, bonus rules, and business information from a single control center.
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Manager access
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/manager">Back to dashboard</Link>
              </Button>
              <LogoutButton />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between md:hidden">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Manager access
            </Badge>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/manager">Dashboard</Link>
              </Button>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Breadcrumb className="mb-4 md:mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/manager">Manager</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>System settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-4 lg:hidden">
          <div className="rounded-2xl border border-muted/40 bg-card/70 p-4 text-sm text-foreground">
            <div className="flex flex-wrap gap-2">
              {navSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeSection === section.id
                      ? "border-primary text-foreground"
                      : "border-muted/60 text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-full flex-shrink-0 lg:block lg:w-56">
            <div className="sticky top-24 space-y-3 rounded-2xl border border-muted/40 bg-card/70 p-4 text-sm font-medium text-foreground shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Settings</p>
              <div className="space-y-1">
                {navSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${
                      activeSection === section.id
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/10"
                    }`}
                  >
                    <span>{section.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            {activeSection === "company-settings" && (
              <section id="company-settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Company settings</CardTitle>
                    <CardDescription>{companyStatusMessage}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {companyError ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <AlertTitle>An error occurred</AlertTitle>
                        <AlertDescription>{companyError}</AlertDescription>
                      </Alert>
                    ) : null}

                    {companyLoading ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                        Loading company settings...
                      </div>
                    ) : (
                      <form onSubmit={handleCompanySubmit} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="company-name" className="text-sm font-medium">
                              Company name
                            </Label>
                            <Input
                              id="company-name"
                              value={companyForm.name}
                              onChange={(event) =>
                                setCompanyForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                              placeholder="e.g., WolfMas BV"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company-currency" className="text-sm font-medium">
                              Currency
                            </Label>
                            <select
                              id="company-currency"
                              value={companyForm.currency}
                              onChange={(event) =>
                                setCompanyForm((prev) => ({ ...prev, currency: event.target.value }))
                              }
                              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {AVAILABLE_CURRENCIES.map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company-timezone" className="text-sm font-medium">
                              Timezone
                            </Label>
                            <select
                              id="company-timezone"
                              value={companyForm.timezone}
                              onChange={(event) =>
                                setCompanyForm((prev) => ({ ...prev, timezone: event.target.value }))
                              }
                              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {AVAILABLE_TIMEZONES.map((timezone) => (
                                <option key={timezone} value={timezone}>
                                  {timezone}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={isCompanySaving || !companyHasChanges}>
                          {isCompanySaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
                            </>
                          ) : (
                            "Save company settings"
                          )}
                        </Button>
                          {companyHasChanges ? (
                            <Button type="button" variant="outline" onClick={handleCompanyReset} disabled={isCompanySaving}>
                              Reset
                            </Button>
                          ) : null}
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            {activeSection === "f2f-cookies" && (
              <section id="f2f-cookies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Manage F2F cookies</CardTitle>
                    <CardDescription>{statusMessage}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>Need new F2F tokens?</AlertTitle>
                      <AlertDescription>
                        If the F2F requests stop working, usually only the <span className="font-semibold">Session ID</span> expires.
                        Copy a new Session ID from F2F, paste it below, and save your changes. The remaining cookies typically stay the same.
                      </AlertDescription>
                    </Alert>

                    {loadError && !loading ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>An error occurred</AlertTitle>
                        <AlertDescription>{loadError}</AlertDescription>
                      </Alert>
                    ) : null}

                    {loading ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                        Cookies worden geladen...
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-xl space-y-1 text-sm">
                            <p className="font-medium text-foreground">F2F accounts</p>
                            <p className="text-xs text-muted-foreground">
                              Add a cookie string for each F2F account. Choose <span className="font-semibold">Model account</span> when the cookie belongs to a model login.
                            </p>
                          </div>
                          <Button type="button" variant="outline" onClick={addEntry}>
                            + Add account
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {cookieEntries.map((entry, index) => {
                            const modelLabel =
                              entry.modelId &&
                              models.find((m) => m.id === entry.modelId)?.displayName
                            const canRemove = cookieEntries.length > 1 || entry.cookies.trim().length > 0
                            const displayName = (entry.name ?? "").trim() || `Account ${index + 1}`
                            const isEditingName = !!editingNames[entry.localId]
                            const nameDraft = nameDrafts[entry.localId] ?? entry.name ?? ""
                            return (
                              <div key={entry.localId} className="space-y-4 rounded-lg border border-muted/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    {isEditingName ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={nameDraft}
                                          onChange={(event) =>
                                            setNameDrafts((prev) => ({
                                              ...prev,
                                              [entry.localId]: event.target.value,
                                            }))
                                          }
                                          placeholder={`Account ${index + 1}`}
                                          className="h-8"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => {
                                            const trimmed = (nameDrafts[entry.localId] ?? "").trim()
                                            updateEntry(entry.localId, { name: trimmed })
                                            setEditingNames((prev) => ({ ...prev, [entry.localId]: false }))
                                            setNameDrafts((prev) => {
                                              const next = { ...prev }
                                              delete next[entry.localId]
                                              return next
                                            })
                                          }}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingNames((prev) => ({ ...prev, [entry.localId]: false }))
                                            setNameDrafts((prev) => {
                                              const next = { ...prev }
                                              delete next[entry.localId]
                                              return next
                                            })
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">{displayName}</p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            setEditingNames((prev) => ({ ...prev, [entry.localId]: true }))
                                            setNameDrafts((prev) => ({
                                              ...prev,
                                              [entry.localId]: entry.name ?? "",
                                            }))
                                          }}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                    {modelLabel ? (
                                      <p className="text-xs text-muted-foreground">Model: {modelLabel}</p>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeEntry(entry.localId)}
                                      disabled={!canRemove}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Account type</Label>
                                  <Select
                                    value={entry.type}
                                    onValueChange={(value) =>
                                      updateEntry(entry.localId, { type: value as F2FAccountType })
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="creator">Creator (agency) account</SelectItem>
                                      <SelectItem value="model">Model account</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {entry.type === "model" ? (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Linked model</Label>
                                    <Select
                                      value={entry.modelId ?? ""}
                                      onValueChange={(value) =>
                                        updateEntry(entry.localId, { modelId: value || undefined })
                                      }
                                      disabled={modelsLoading}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select model"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {models.map((model) => (
                                          <SelectItem key={model.id} value={model.id}>
                                            {model.displayName} {model.username ? `(@${model.username})` : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                      Required for model accounts so payouts link to the right model.
                                    </p>
                                  </div>
                                ) : null}

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Allowed earning types</Label>
                                  <div className="space-y-2 rounded-md border border-muted/60 p-3">
                                    {earningTypesLoading ? (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                        Loading earning types...
                                      </div>
                                    ) : null}
                                    {earningTypesError ? (
                                      <p className="text-xs text-destructive">{earningTypesError}</p>
                                    ) : null}
                                    {!earningTypesLoading && earningTypes.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {earningTypes.map((earningType) => {
                                          const checked = (entry.allowedEarningTypeIds ?? []).includes(earningType.id)
                                          return (
                                            <label
                                              key={earningType.id}
                                              className="flex cursor-pointer items-center gap-2 rounded-md border border-muted/50 px-2 py-1 text-xs font-medium hover:border-muted-foreground/40"
                                            >
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={checked}
                                                onChange={(event) =>
                                                  handleToggleEarningType(
                                                    entry.localId,
                                                    earningType.id,
                                                    event.target.checked,
                                                  )
                                                }
                                              />
                                              <span>{earningType.label}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : null}
                                    {!earningTypesLoading && earningTypes.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        No earning types available. Saving will allow all by default.
                                      </p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSelectAllEarningTypes(entry.localId)}
                                        disabled={earningTypes.length === 0}
                                      >
                                        Select all
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleClearEarningTypes(entry.localId)}
                                      >
                                        Clear
                                      </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Choose which earning types F2F may create for this account.
                                    </p>
                                  </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Session ID</Label>
                                    <Input
                                      value={entry.sessionid}
                                      onChange={(event) => updateEntry(entry.localId, { sessionid: event.target.value })}
                                      placeholder="sessionid"
                                      spellCheck={false}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">shield_FPC</Label>
                                    <Input
                                      value={entry.shieldFPC}
                                      onChange={(event) => updateEntry(entry.localId, { shieldFPC: event.target.value })}
                                      placeholder="shield_FPC"
                                      spellCheck={false}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">csrftoken</Label>
                                    <Input
                                      value={entry.csrftoken}
                                      onChange={(event) => updateEntry(entry.localId, { csrftoken: event.target.value })}
                                      placeholder="csrftoken"
                                      spellCheck={false}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Other cookies (optional)</Label>
                                    <Textarea
                                      rows={3}
                                      value={entry.otherCookies}
                                      onChange={(event) => updateEntry(entry.localId, { otherCookies: event.target.value })}
                                      placeholder="splash=true; intercom-session=..."
                                      spellCheck={false}
                                      className="font-mono"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1 rounded-md border border-dashed border-muted/50 p-3">
                                  <p className="text-xs font-medium text-muted-foreground">Cookie header preview</p>
                                  <code className="block whitespace-pre-wrap break-words text-xs font-mono text-foreground">
                                    {buildCookieString(entry) || "sessionid=...; csrftoken=...; shield_FPC=..."}
                                  </code>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          These values are stored in the database and shared with every F2F synchronization.
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                          <Button type="submit" disabled={isSaving || !hasChanges}>
                            {isSaving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
                              </>
                            ) : (
                              "Save cookies"
                            )}
                          </Button>
                          {hasChanges ? (
                            <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
                              Revert changes
                            </Button>
                          ) : null}
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            {activeSection === "bonus-rules" && (
              <section id="bonus-rules" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Bonusregels</CardTitle>
                    <CardDescription>Manage bonus rules, review awards, and monitor progress.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BonusAdminPanel />
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

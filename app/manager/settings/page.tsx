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
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import currenciesData from "@/data/currencies.json"
import timezonesData from "@/data/timezones.json"
const DEFAULT_F2F_COOKIES_STRING =
  "shield_FPC=SCCw3sIA5nuudpQTWSQODJuLw7qlxzBoKg; splash=true; intercom-device-id-r1f7b1gp=aeeb0d35-2f49-492d-848a-e1b7a48c63e3; csrftoken=88vIqGRLyEADnlumGSNq9f32CzsJSy8b; sessionid=bq3qq9gbvbrmh2hjb79grpli6s7fldg4; intercom-session-r1f7b1gp=WEVrT1Z4aHFaOG5lV2tZRExDT3MyTmltcFFwN3Q5MTR1TTdZWE1Fc0RTaDFZMmdkbDNucEtrSlI2Y3YvNGFDQnUyTHN0dGNScmJ4aVAxcVBtS3Zwa1FGbExMNitVNzkzRjc5QzRUYlFlOUE9LS1NYk1YOHNIK1ZTSVFURlFscWZFSHNnPT0=--87dd43f168c18288574dc4725278bf900e6e0307"

interface CookieField {
  key: string
  label: string
  description?: string
  placeholder?: string
}

type CookieValues = Record<string, string>

const COOKIE_FIELDS: CookieField[] = [
  {
    key: "sessionid",
    label: "Session ID",
    description:
      "Dit token verandert het vaakst. Als F2F verzoeken stoppen met werken, ververs dan alleen deze waarde.",
  },
  {
    key: "shield_FPC",
    label: "shield_FPC",
  },
  {
    key: "csrftoken",
    label: "csrftoken",
  },
]

function createEmptyCookieValues(): CookieValues {
  return COOKIE_FIELDS.reduce<CookieValues>((acc, field) => {
    acc[field.key] = ""
    return acc
  }, {})
}

function cloneCookieValues(values: CookieValues): CookieValues {
  return { ...values }
}

function parseCookieString(value: string | null | undefined): ParsedCookies {
  const cookieValues = createEmptyCookieValues()
  const additionalCookies: string[] = []

  if (!value) {
    return { values: cookieValues, extras: additionalCookies }
  }

  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)

  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=")
    const key = rawKey?.trim()
    if (!key) {
      additionalCookies.push(part)
      continue
    }

    const rawValue = rest.join("=")
    const valuePart = rawValue.trim()

    if (Object.prototype.hasOwnProperty.call(cookieValues, key)) {
      cookieValues[key] = valuePart
    } else {
      additionalCookies.push(part)
    }
  }

  return { values: cookieValues, extras: additionalCookies }
}

function formatCookieString(values: CookieValues, extras: string[]): string {
  const normalizedValues = COOKIE_FIELDS.map((field) => {
    const value = values[field.key]?.trim()
    return value ? `${field.key}=${value}` : ""
  }).filter(Boolean)

  const combined = [...normalizedValues, ...extras.filter(Boolean)]

  return combined.join("; ")
}

const DEFAULT_COOKIES_PARSED = parseCookieString(DEFAULT_F2F_COOKIES_STRING)
const DEFAULT_COOKIE_VALUES: Readonly<CookieValues> = Object.freeze(
  cloneCookieValues(DEFAULT_COOKIES_PARSED.values),
)
const DEFAULT_ADDITIONAL_COOKIES: ReadonlyArray<string> = Object.freeze([
  ...(DEFAULT_COOKIES_PARSED.extras ?? []),
])

interface ParsedCookies {
  values: CookieValues
  extras: string[]
}

interface NormalizedCookiesPayload {
  cookies: string
  updatedAt: Date | null
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

function normalizeCookiesPayload(payload: any): NormalizedCookiesPayload {
  if (typeof payload === "string") {
    return { cookies: payload, updatedAt: null }
  }

  if (!payload) {
    return { cookies: "", updatedAt: null }
  }

  if (Array.isArray(payload) && payload.length > 0) {
    return normalizeCookiesPayload(payload[0])
  }

  const source = payload.data ?? payload

  const cookiesValue =
    typeof source?.cookies === "string"
      ? source.cookies
      : typeof source?.cookie === "string"
      ? source.cookie
      : typeof source?.cookieString === "string"
      ? source.cookieString
      : typeof source?.value === "string"
      ? source.value
      : ""

  const updatedCandidate =
    source?.updatedAt ??
    source?.updated_at ??
    source?.lastUpdated ??
    source?.last_updated ??
    source?.updatedOn ??
    source?.updated_on ??
    source?.updated ??
    null

  return {
    cookies: cookiesValue,
    updatedAt: parseDate(updatedCandidate),
  }
}

export default function ManagerSettingsPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cookieValues, setCookieValues] = useState<CookieValues>(() => createEmptyCookieValues())
  const [initialCookieValues, setInitialCookieValues] = useState<CookieValues>(() => createEmptyCookieValues())
  const [additionalCookies, setAdditionalCookies] = useState<string[]>([])
  const [initialAdditionalCookies, setInitialAdditionalCookies] = useState<string[]>([])
  const [initialCookiesString, setInitialCookiesString] = useState("")
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
    setLoadError(null)
    setCompanyError(null)

    try {
      const payload = await api.getF2FCookies()
      if (isCancelled) return
      const normalized = normalizeCookiesPayload(payload)
      const normalizedString = (normalized.cookies ?? "").trim()
      const parsed = parseCookieString(normalizedString)

      setCookieValues(cloneCookieValues(parsed.values))
      setInitialCookieValues(cloneCookieValues(parsed.values))
      setAdditionalCookies(Array.from(parsed.extras))
      setInitialAdditionalCookies(Array.from(parsed.extras))
      setInitialCookiesString(formatCookieString(parsed.values, parsed.extras))
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

  const currentCookieString = useMemo(
    () => formatCookieString(cookieValues, additionalCookies),
    [cookieValues, additionalCookies],
  )

  const hasChanges = useMemo(
    () => currentCookieString.trim() !== initialCookiesString.trim(),
    [currentCookieString, initialCookiesString],
  )

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
    setCookieValues(cloneCookieValues(initialCookieValues))
    setAdditionalCookies(Array.from(initialAdditionalCookies))
  }

  const handleCompanyReset = () => {
    if (!initialCompanyForm) return
    setCompanyForm(initialCompanyForm)
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

    const payload = { cookies: currentCookieString.trim() }

    setIsSaving(true)
    setLoadError(null)

    try {
      const response = await api.updateF2FCookies(payload)
      const normalized = normalizeCookiesPayload(response)
      const savedCookiesString = (normalized.cookies || payload.cookies).trim()
      const parsedSaved = parseCookieString(savedCookiesString)
      const formattedSaved = formatCookieString(parsedSaved.values, parsedSaved.extras)

      setCookieValues(cloneCookieValues(parsedSaved.values))
      setInitialCookieValues(cloneCookieValues(parsedSaved.values))
      setAdditionalCookies(Array.from(parsedSaved.extras))
      setInitialAdditionalCookies(Array.from(parsedSaved.extras))
      setInitialCookiesString(formattedSaved)
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
                      <form onSubmit={handleSubmit} className="space-y-10">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="max-w-xl space-y-1 text-sm">
                            <p className="font-medium text-foreground">F2F cookies</p>
                            <p className="text-xs text-muted-foreground">
                              Fill in each cookie separately. Semicolons are added automatically when you save.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-5">
                          {COOKIE_FIELDS.map((field) => {
                            const fieldId = `cookie-${field.key}`
                            const defaultValue = DEFAULT_COOKIE_VALUES[field.key] ?? ""
                            return (
                              <div key={field.key} className="space-y-2">
                                <Label htmlFor={fieldId} className="text-sm font-medium">
                                  {field.label}
                                </Label>
                                <Input
                                  id={fieldId}
                                  value={cookieValues[field.key] ?? ""}
                                  onChange={(event) =>
                                    setCookieValues((prev) => ({
                                      ...prev,
                                      [field.key]: event.target.value,
                                    }))
                                  }
                                  placeholder={defaultValue}
                                  spellCheck={false}
                                  autoComplete="off"
                                  className="font-mono"
                                />
                                {field.description ? (
                                  <p className="text-xs text-muted-foreground">{field.description}</p>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>

                        {additionalCookies.length > 0 ? (
                          <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 p-3">
                            <p className="text-xs text-muted-foreground">
                              These additional cookies are also stored and sent automatically:
                            </p>
                            <code className="block whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
                              {additionalCookies.join("; ")}
                            </code>
                          </div>
                        ) : null}

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

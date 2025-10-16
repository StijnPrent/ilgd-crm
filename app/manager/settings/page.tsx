"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Loader2, Settings as SettingsIcon } from "lucide-react"

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
      "Dit token verandert het vaakst. Als Face2Face verzoeken stoppen met werken, ververs dan alleen deze waarde.",
  },
  {
    key: "shield_FPC",
    label: "shield_FPC",
  },
  {
    key: "splash",
    label: "splash",
    description: "Laat deze doorgaans op 'true' staan.",
  },
  {
    key: "csrftoken",
    label: "csrftoken",
  },
  {
    key: "intercom-device-id-r1f7b1gp",
    label: "intercom-device-id-r1f7b1gp",
  },
  {
    key: "intercom-session-r1f7b1gp",
    label: "intercom-session-r1f7b1gp",
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
      setLoadError(null)

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
          (error as Error)?.message ?? "Kon de opgeslagen F2F cookies niet ophalen. Probeer het later opnieuw."
        setLoadError(message)
        toast({
          variant: "destructive",
          title: "Kon F2F cookies niet laden",
          description: "Controleer de server of probeer het later opnieuw.",
        })
      } finally {
        if (!isCancelled) {
          setLoading(false)
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
    if (loading) return "De huidige Face2Face cookies worden geladen..."
    if (lastUpdated) {
      const relative = formatDistanceToNow(lastUpdated, { addSuffix: true })
      return `Laatst bijgewerkt ${relative} (${lastUpdated.toLocaleString()})`
    }
    return "Er zijn nog geen Face2Face cookies opgeslagen."
  }, [lastUpdated, loading])

  const handleReset = () => {
    setCookieValues(cloneCookieValues(initialCookieValues))
    setAdditionalCookies(Array.from(initialAdditionalCookies))
  }

  const handleUseExample = () => {
    setCookieValues(cloneCookieValues(DEFAULT_COOKIE_VALUES))
    setAdditionalCookies(Array.from(DEFAULT_ADDITIONAL_COOKIES))
  }

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
        title: "F2F cookies opgeslagen",
        description: "De Face2Face tokens zijn bijgewerkt voor alle automations.",
      })
    } catch (error) {
      console.error("[settings] Failed to save F2F cookies", error)
      const message =
        (error as Error)?.message ?? "Het opslaan van de Face2Face cookies is mislukt. Probeer het opnieuw."
      setLoadError(message)
      toast({
        variant: "destructive",
        title: "Opslaan mislukt",
        description: "Controleer de invoer of probeer het later opnieuw.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Authenticatie wordt gecontroleerd...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center">
              <SettingsIcon className="mr-3 h-10 w-10 rounded-full border p-2 text-primary" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Face2Face instellingen</h1>
                <p className="text-muted-foreground">
                  Beheer hier de cookies die nodig zijn voor de Face2Face automations.
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Manager toegang
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/manager">Terug naar dashboard</Link>
              </Button>
              <LogoutButton />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between md:hidden">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Manager toegang
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
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/manager">Manager</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Face2Face instellingen</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Nieuwe Face2Face tokens nodig?</AlertTitle>
            <AlertDescription>
              Werken de Face2Face verzoeken niet meer? Meestal is alleen de{" "}
              <span className="font-semibold">Session ID</span> verlopen. Kopieer een nieuwe Session ID uit Face2Face, vul dat veld
              hieronder opnieuw in en sla de wijzigingen op. De overige waarden blijven doorgaans gelijk.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>F2F cookies beheren</CardTitle>
              <CardDescription>{statusMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadError && !loading ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Er trad een fout op</AlertTitle>
                  <AlertDescription>{loadError}</AlertDescription>
                </Alert>
              ) : null}

              {loading ? (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  Cookies worden geladen...
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="max-w-xl space-y-1 text-sm">
                      <p className="font-medium text-foreground">Face2Face cookies</p>
                      <p className="text-xs text-muted-foreground">
                        Vul elke cookie afzonderlijk in. Wij voegen de puntkomma&apos;s automatisch toe bij het opslaan.
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={handleUseExample} disabled={isSaving}>
                      Gebruik voorbeeld
                    </Button>
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
                        De volgende extra cookies zijn ook opgeslagen en worden automatisch meegestuurd:
                      </p>
                      <code className="block whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
                        {additionalCookies.join("; ")}
                      </code>
                    </div>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    De waarden worden opgeslagen in de database en gedeeld met alle Face2Face synchronisaties.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={isSaving || !hasChanges}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Opslaan...
                        </>
                      ) : (
                        "Cookies opslaan"
                      )}
                    </Button>
                    {hasChanges ? (
                      <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
                        Wijzigingen terugzetten
                      </Button>
                    ) : null}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

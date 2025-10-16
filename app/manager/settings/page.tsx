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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LogoutButton } from "@/components/logout-button"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"

const DEFAULT_F2F_COOKIES =
  "shield_FPC=SCCw3sIA5nuudpQTWSQODJuLw7qlxzBoKg; splash=true; intercom-device-id-r1f7b1gp=aeeb0d35-2f49-492d-848a-e1b7a48c63e3; csrftoken=88vIqGRLyEADnlumGSNq9f32CzsJSy8b; sessionid=bq3qq9gbvbrmh2hjb79grpli6s7fldg4; intercom-session-r1f7b1gp=WEVrT1Z4aHFaOG5lV2tZRExDT3MyTmltcFFwN3Q5MTR1TTdZWE1Fc0RTaDFZMmdkbDNucEtrSlI2Y3YvNGFDQnUyTHN0dGNScmJ4aVAxcVBtS3Zwa1FGbExMNitVNzkzRjc5QzRUYlFlOUE9LS1NYk1YOHNIK1ZTSVFURlFscWZFSHNnPT0=--87dd43f168c18288574dc4725278bf900e6e0307"

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
  const [cookies, setCookies] = useState("")
  const [initialCookies, setInitialCookies] = useState("")
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
        setCookies(normalized.cookies ?? "")
        setInitialCookies(normalized.cookies ?? "")
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

  const hasChanges = useMemo(() => cookies.trim() !== initialCookies.trim(), [cookies, initialCookies])

  const statusMessage = useMemo(() => {
    if (loading) return "De huidige Face2Face cookies worden geladen..."
    if (lastUpdated) {
      const relative = formatDistanceToNow(lastUpdated, { addSuffix: true })
      return `Laatst bijgewerkt ${relative} (${lastUpdated.toLocaleString()})`
    }
    return "Er zijn nog geen Face2Face cookies opgeslagen."
  }, [lastUpdated, loading])

  const handleReset = () => {
    setCookies(initialCookies)
  }

  const handleUseExample = () => {
    setCookies(DEFAULT_F2F_COOKIES)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving || !hasChanges) return

    const payload = { cookies: cookies.trim() }

    setIsSaving(true)
    setLoadError(null)

    try {
      const response = await api.updateF2FCookies(payload)
      const normalized = normalizeCookiesPayload(response)
      const savedCookies = normalized.cookies || payload.cookies
      setCookies(savedCookies)
      setInitialCookies(savedCookies)
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
              Werken de huidige tokens niet meer? Kopieer dan de nieuwste cookies uit Face2Face, plak ze hieronder en sla ze op
              zodat alle integraties blijven draaien.
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
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="f2fCookies" className="text-sm font-medium">
                        Face2Face cookie string
                      </Label>
                      <Button type="button" variant="ghost" size="sm" onClick={handleUseExample} disabled={isSaving}>
                        Gebruik voorbeeld
                      </Button>
                    </div>
                    <Textarea
                      id="f2fCookies"
                      value={cookies}
                      onChange={(event) => setCookies(event.target.value)}
                      placeholder={DEFAULT_F2F_COOKIES}
                      rows={7}
                      className="font-mono"
                      spellCheck={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      Plak de volledige cookie string exact zoals gekopieerd (inclusief puntkomma&apos;s). Deze waarde wordt
                      opgeslagen in de database en gedeeld met alle Face2Face synchronisaties.
                    </p>
                  </div>

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

"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  History,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Zap,
  X,
} from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { formatUserDateTime } from "@/lib/timezone"
import { useToast } from "@/hooks/use-toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"


type RuleScope = "worker"
type WindowType = "calendar_day" | "calendar_week" | "calendar_month"
type RuleType = "threshold_payout"

interface BonusRule {
  id: string
  name: string
  scope: RuleScope
  windowType: WindowType
  ruleType: RuleType
  priority: number
  active: boolean
  config: {
    metric?: string
    tiers: { minAmountCents: number; bonusCents: number }[]
    includeRefunds?: boolean
    shiftBased?: boolean
    awardOncePerWindow?: boolean
  }
  createdAt?: string
  updatedAt?: string
}

interface RuleFormState {
  id?: string
  name: string
  active: boolean
  priority: string
  windowType: WindowType
  shiftBased: boolean
  includeRefunds: boolean
  awardOncePerWindow: boolean
  tiers: { minAmount: string; bonusAmount: string }[]
}

interface RulePreviewInputs {
  ruleId?: string
  workerId?: string
  asOfIso: string
}

interface RulePreviewResult {
  ruleId?: number
  companyId?: number
  workerId?: number
  totalCents?: number
  stepsNow?: number
  lastObservedSteps?: number
  delta?: number
  stepsAwarded?: number
  expectedAwardCents?: number
  currency?: string
  windowStart?: string
  windowEnd?: string
  reason?: string
}

interface BonusAward {
  id: string
  ruleId?: string
  ruleName?: string
  workerId?: string
  workerName?: string
  workerExternalId?: string
  stepsAwarded?: number
  bonusAmountCents?: number
  bonusCurrency?: string
  awardedAt?: string
  reason?: string
  payload?: Record<string, any>
}

interface BonusProgressRow {
  ruleId?: string
  ruleName?: string
  workerId?: string
  workerName?: string
  lastObservedSteps?: number
  lastComputedAt?: string
  windowStartedAt?: string
  windowEndsAt?: string
}

type FormErrors = Record<string, string[]>

// No rolling/tumbling windows anymore; only calendar day/month

// scope is fixed to worker on backend

const WINDOW_LABELS: Record<WindowType, string> = {
  calendar_day: "Calendar day",
  calendar_week: "Calendar week",
  calendar_month: "Calendar month",
}

const WINDOW_DESCRIPTIONS: Record<WindowType, string> = {
  calendar_day:
    "Totals for a calendar day (or shift-based if enabled).",
  calendar_week:
    "Totals for the calendar week.",
  calendar_month:
    "Totals for the calendar month.",
}

// ruleType is fixed to threshold_payout on backend

const MONEY_LOCALE = "nl-NL"
const DEFAULT_CURRENCY = "EUR"
const CURRENCY_OPTIONS = ["EUR", "USD", "GBP"]

const PAGE_SIZE = 20

const friendlyNowIso = () => new Date().toISOString().slice(0, 16)

// Extract companyId from the stored JWT so we can include it
// for backends that still require it in the payload.
function getCompanyIdFromJwt(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const token = localStorage.getItem("auth_token")
    if (!token) return undefined
    const parts = token.split(".")
    if (parts.length !== 3) return undefined
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    const payload = JSON.parse(json || "{}")
    const cid =
      payload?.companyId ??
      payload?.company_id ??
      payload?.company?.id ??
      payload?.orgId ??
      payload?.organizationId
    return cid ? String(cid) : undefined
  } catch {
    return undefined
  }
}

const formatMoney = (cents?: number, currency = DEFAULT_CURRENCY) => {
  if (!Number.isFinite(cents)) return "-"
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format((cents ?? 0) / 100)
  } catch {
    return `${(cents ?? 0) / 100} ${currency}`
  }
}

const formatSteps = (value?: number) => {
  if (!Number.isFinite(value)) return "-"
  return new Intl.NumberFormat(MONEY_LOCALE).format(value ?? 0)
}

const parseMoneyInput = (value: string) => {
  if (!value) return 0
  // Remove spaces including non-breaking spaces
  let s = value.replace(/[\s\u00A0]+/g, "").trim()
  // If both separators present, decide decimal by the last occurrence
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      // European style: 1.234,56 -> remove dots, comma as decimal
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US style: 1,234.56 -> remove commas
      s = s.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // Only comma present -> treat as decimal
    s = s.replace(',', '.')
  } // only dot or none -> already fine

  // Strip any remaining non-numeric/decimal characters
  s = s.replace(/[^0-9.\-]/g, '')

  const number = Number.parseFloat(s)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100)
}

const formatMoneyInput = (cents?: number) => {
  if (!Number.isFinite(cents)) return ""
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",")
}

const parseInteger = (value: string) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

// no rolling/tumbling durations in the new model

const normalizeRule = (raw: any): BonusRule => {
  if (!raw) {
    return {
      id: "",
      name: "",
      scope: "worker",
      windowType: "calendar_day",
      ruleType: "threshold_payout",
      priority: 0,
      active: false,
      config: { tiers: [], includeRefunds: false, shiftBased: false, awardOncePerWindow: true },
    }
  }

  return {
    id: String(raw.id ?? raw.ruleId ?? ""),
    name: String(raw.name ?? raw.ruleName ?? "Rule"),
    scope: (raw.scope ?? "worker") as RuleScope,
    windowType: (raw.windowType ?? "calendar_day") as WindowType,
    ruleType: (raw.ruleType ?? "threshold_payout") as RuleType,
    priority: Number(raw.priority ?? 0),
    active: Boolean(raw.active ?? raw.isActive ?? raw.enabled ?? false),
    config: {
      metric: raw.ruleConfig?.metric ?? raw.config?.metric,
      tiers: Array.isArray(raw.ruleConfig?.tiers ?? raw.config?.tiers)
        ? (raw.ruleConfig?.tiers ?? raw.config?.tiers)
        : [],
      includeRefunds: Boolean(raw.ruleConfig?.includeRefunds ?? raw.config?.includeRefunds ?? false),
      shiftBased: Boolean(raw.ruleConfig?.shiftBased ?? raw.config?.shiftBased ?? false),
      awardOncePerWindow: Boolean(
        raw.ruleConfig?.awardOncePerWindow ?? raw.config?.awardOncePerWindow ?? true,
      ),
    },
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
  }
}

const makeEmptyRuleForm = (): RuleFormState => ({
  name: "",
  active: true,
  priority: "10",
  windowType: "calendar_day",
  shiftBased: true,
  includeRefunds: false,
  awardOncePerWindow: true,
  tiers: [{ minAmount: "0,00", bonusAmount: "0,00" }],
})

const ruleToFormState = (rule: BonusRule): RuleFormState => {
  const config = rule.config ?? { tiers: [] }
  return {
    id: rule.id,
    name: rule.name ?? "",
    active: Boolean(rule.active),
    priority: String(Number.isFinite(rule.priority) ? rule.priority : 0),
    windowType: rule.windowType ?? "calendar_day",
    shiftBased: Boolean(config.shiftBased ?? false),
    includeRefunds: Boolean(config.includeRefunds ?? false),
    awardOncePerWindow: Boolean(config.awardOncePerWindow ?? true),
    tiers: (config.tiers ?? []).map((t) => ({
      minAmount: formatMoneyInput(t.minAmountCents ?? 0),
      bonusAmount: formatMoneyInput(t.bonusCents ?? 0),
    })),
  }
}

const buildRulePayload = (form: RuleFormState) => {
  const tiers = (form.tiers || [])
    .map((t) => ({
      minAmountCents: parseMoneyInput(t.minAmount || "0"),
      bonusCents: parseMoneyInput(t.bonusAmount || "0"),
    }))
    .filter((t) => (t.minAmountCents ?? 0) >= 0)

  const companyId = getCompanyIdFromJwt()
  return {
    name: form.name.trim(),
    isActive: form.active,
    active: form.active, // for backends that accept either
    priority: Number.parseInt(form.priority || "0", 10) || 0,
    windowType: form.windowType,
    ruleConfig: {
      metric: "earnings.amount_cents",
      tiers,
      includeRefunds: form.includeRefunds,
      shiftBased: form.windowType === "calendar_day" ? form.shiftBased : undefined,
      awardOncePerWindow: form.awardOncePerWindow,
    },
    ...(companyId ? { companyId } : {}),
  }
}

const extractAwards = (response: any): BonusAward[] => {
  if (!response) return []
  const rows =
    (Array.isArray(response) && response) ||
    response.data ||
    response.items ||
    response.results ||
    response.rows ||
    []
  return rows.map((row: any) => ({
    id: String(row.id ?? row.awardId ?? crypto.randomUUID()),
    ruleId: row.ruleId ?? row.rule_id,
    ruleName: row.ruleName ?? row.rule?.name ?? row.rule_name,
    workerId: row.workerId ?? row.worker_id,
    workerName: row.workerName ?? row.worker?.name ?? row.worker_name,
    workerExternalId: row.workerExternalId ?? row.worker_external_id ?? row.worker?.externalId,
    stepsAwarded: row.stepsAwarded ?? row.steps_awarded ?? row.steps,
    bonusAmountCents:
      row.bonusAmountCents ?? row.bonus_amount_cents ?? row.amountCents ?? row.amount_cents,
    bonusCurrency: row.currency ?? row.bonusCurrency ?? row.rule?.currency ?? DEFAULT_CURRENCY,
    awardedAt: row.awardedAt ?? row.awarded_at ?? row.createdAt ?? row.created_at,
    reason: row.reason ?? row.note ?? row.description,
    payload: row.payload ?? {},
  }))
}

const hydrateAwardNames = (
  awards: BonusAward[],
  rules: BonusRule[],
  chatters: any[],
): BonusAward[] => {
  const ruleNameMap = new Map(rules.map((rule) => [String(rule.id), rule.name]))
  const chatterNameMap = new Map(
    (chatters ?? []).map((chatter: any) => {
      const id = String(chatter.id ?? chatter.chatterId ?? chatter.userId ?? chatter.user_id ?? "")
      const name =
        chatter.fullName ||
        chatter.full_name ||
        [chatter.firstName ?? chatter.first_name, chatter.lastName ?? chatter.last_name]
          .filter(Boolean)
          .join(" ") ||
        chatter.name ||
        chatter.nickname ||
        chatter.username ||
        ""
      return [id, name]
    }),
  )

  return awards.map((award) => ({
    ...award,
    ruleName: award.ruleName || ruleNameMap.get(String(award.ruleId)),
    workerName: award.workerName || chatterNameMap.get(String(award.workerId)),
  }))
}

const extractProgress = (response: any): BonusProgressRow[] => {
  if (!response) return []
  const rows =
    (Array.isArray(response) && response) ||
    response.data ||
    response.items ||
    response.results ||
    response.rows ||
    []
  return rows.map((row: any) => ({
    ruleId: row.ruleId ?? row.rule_id,
    ruleName: row.ruleName ?? row.rule?.name ?? row.rule_name,
    workerId: row.workerId ?? row.worker_id,
    workerName: row.workerName ?? row.worker?.name ?? row.worker_name,
    lastObservedSteps: row.lastObservedSteps ?? row.last_observed_steps ?? row.steps,
    lastComputedAt: row.lastComputedAt ?? row.last_computed_at ?? row.updatedAt ?? row.updated_at,
    windowStartedAt: row.windowStartedAt ?? row.window_started_at,
    windowEndsAt: row.windowEndsAt ?? row.window_ends_at,
  }))
}

const extractTotalCount = (response: any) => {
  if (!response) return 0
  const candidates = [
    response.total,
    response.totalCount,
    response.count,
    response.meta?.total,
    response.meta?.totalCount,
    response.pagination?.total,
  ]
  for (const candidate of candidates) {
    const value = Number(candidate)
    if (Number.isFinite(value)) return value
  }
  return 0
}

const extractTotals = (response: any) => {
  const totals = response?.totals ?? response?.meta?.totals ?? response?.summary ?? {}
  const pageTotals = totals.page ?? totals.pageTotals ?? totals.page_totals ?? {}
  const filteredTotals = totals.filtered ?? totals.filteredTotals ?? totals.filtered_totals ?? {}
  return {
    page: pageTotals,
    filtered: filteredTotals,
  }
}

const normalizeErrorMap = (error: unknown): FormErrors => {
  if (error instanceof ApiError) {
    const data = error.data
    if (data?.errors && typeof data.errors === "object") {
      const entries = Object.entries(data.errors).map(([key, value]) => {
        const arr = Array.isArray(value) ? value : [String(value)]
        return [key, arr.map((item) => String(item))]
      })
      return Object.fromEntries(entries)
    }
    if (data?.error && typeof data.error === "object") {
      const entries = Object.entries(data.error).map(([key, value]) => {
        const arr = Array.isArray(value) ? value : [String(value)]
        return [key, arr.map((item) => String(item))]
      })
      return Object.fromEntries(entries)
    }
    if (typeof data === "string") {
      return { base: [data] }
    }
  }
  if (error instanceof Error) {
    return { base: [error.message] }
  }
  if (typeof error === "string") {
    return { base: [error] }
  }
  return { base: ["Unexpected error occurred"] }
}

const defaultPreviewState = (): RulePreviewInputs => ({
  ruleId: undefined,
  workerId: undefined,
  asOfIso: friendlyNowIso(),
})

export function BonusAdminPanel() {
  const { toast } = useToast()

  const [section, setSection] = useState<"rules" | "awards" | "progress">("rules")

  const [rules, setRules] = useState<BonusRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [rulesSearch, setRulesSearch] = useState("")
  const [ruleStatusFilter, setRuleStatusFilter] = useState<"all" | "active" | "inactive">("all")
  // ruleType is fixed; no filter for it anymore

  const [ruleForm, setRuleForm] = useState<RuleFormState>(() => makeEmptyRuleForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formBusy, setFormBusy] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)

  const [rulesRefreshToken, setRulesRefreshToken] = useState(0)

  const [chatters, setChatters] = useState<any[]>([])
  const [chattersLoading, setChattersLoading] = useState(false)

  const [previewInputs, setPreviewInputs] = useState<RulePreviewInputs>(() => defaultPreviewState())
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewResult, setPreviewResult] = useState<RulePreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [awards, setAwards] = useState<BonusAward[]>([])
  const [awardsLoading, setAwardsLoading] = useState(false)
  const [awardsError, setAwardsError] = useState<string | null>(null)
  const [awardsPage, setAwardsPage] = useState(1)
  const [awardsTotalCount, setAwardsTotalCount] = useState(0)
  const [awardsTotals, setAwardsTotals] = useState<{ page?: any; filtered?: any }>({})
  const [awardsFilters, setAwardsFilters] = useState({
    from: "",
    to: "",
    workerId: "",
    ruleId: "",
    minAmount: "",
    maxAmount: "",
  })

  const [progressRows, setProgressRows] = useState<BonusProgressRow[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressFilters, setProgressFilters] = useState({
    workerId: "",
    ruleId: "",
  })

  const workerOptions = useMemo(() => {
    return (chatters ?? []).map((chatter: any) => ({
      id: String(chatter.id ?? chatter.chatterId ?? ""),
      name: chatter.fullName ?? chatter.full_name ?? chatter.nickname ?? chatter.username ?? "Worker",
    }))
  }, [chatters])

  const ruleOptions = useMemo(() => {
    return rules.map((rule) => ({ id: rule.id, name: rule.name }))
  }, [rules])

const loadChatters = async () => {
  setChattersLoading(true)
  try {
    const [chattersResponse, usersResponse] = await Promise.all([
      api.getChatters(),
      // Some backends expose user names separately; ignore failures.
      api.getUsers?.().catch(() => []),
    ])

    const chattersRaw =
      (Array.isArray(chattersResponse) && chattersResponse) ||
      chattersResponse?.data ||
      chattersResponse?.items ||
      chattersResponse?.results ||
      chattersResponse?.rows ||
      []

    const usersRaw =
      (Array.isArray(usersResponse) && usersResponse) ||
      usersResponse?.data ||
      usersResponse?.items ||
      usersResponse?.results ||
      usersResponse?.rows ||
      []

    const userNameMap = new Map<string, string>()
    usersRaw.forEach((user: any) => {
      const id = String(user.id ?? user.userId ?? "")
      if (!id) return
      const name =
        user.fullName ||
        user.full_name ||
        [user.firstName ?? user.first_name, user.lastName ?? user.last_name].filter(Boolean).join(" ") ||
        user.name
      if (name) {
        userNameMap.set(id, String(name))
      }
    })

    const list = chattersRaw.map((chatter: any) => {
      const id = String(chatter.id ?? chatter.chatterId ?? chatter.userId ?? chatter.user_id ?? "")
      const resolvedName =
        chatter.fullName ||
        chatter.full_name ||
        userNameMap.get(id) ||
        userNameMap.get(String(chatter.userId ?? chatter.user_id ?? "")) ||
        chatter.name ||
        chatter.nickname ||
        chatter.username ||
        "Worker"
      return {
        ...chatter,
        id,
        fullName: resolvedName,
        full_name: resolvedName,
      }
    })

    setChatters(list)
  } catch (error) {
    console.error("[bonus] failed to load chatters", error)
  } finally {
    setChattersLoading(false)
  }
}

const loadRules = async () => {
  setRulesLoading(true)
  setRulesError(null)
  try {
    const response = await api.getBonusRules({
      search: rulesSearch.trim() || undefined,
      active: ruleStatusFilter === "all" ? undefined : ruleStatusFilter === "active",
      limit: 100,
    })
    const list = (
      (Array.isArray(response) && response) ||
      response?.data ||
      response?.items ||
      response?.results ||
      response?.rows ||
      []
    ).map((item: any) => normalizeRule(item))
    setRules(list)
  } catch (error) {
    console.error("[bonus] failed to load rules", error)
    setRulesError(error instanceof Error ? error.message : "Failed to load bonus rules")
  } finally {
    setRulesLoading(false)
  }
}

const loadAwards = async (page: number) => {
  setAwardsLoading(true)
  setAwardsError(null)
  try {
    const response = await api.getBonusAwards({
      workerId: awardsFilters.workerId || undefined,
      ruleId: awardsFilters.ruleId || undefined,
      minAmountCents: awardsFilters.minAmount ? parseMoneyInput(awardsFilters.minAmount) : undefined,
      maxAmountCents: awardsFilters.maxAmount ? parseMoneyInput(awardsFilters.maxAmount) : undefined,
      from: awardsFilters.from || undefined,
      to: awardsFilters.to || undefined,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
    setAwards(extractAwards(response))
    setAwardsTotalCount(extractTotalCount(response))
    setAwardsTotals(extractTotals(response))
  } catch (error) {
    console.error("[bonus] awards load failed", error)
    setAwardsError(error instanceof Error ? error.message : "Failed to load awards")
  } finally {
    setAwardsLoading(false)
  }
}

const loadProgress = async () => {
  setProgressLoading(true)
  setProgressError(null)
  try {
    const response = await api.getBonusProgress({
      workerId: progressFilters.workerId || undefined,
      ruleId: progressFilters.ruleId || undefined,
      limit: 200,
    })
    setProgressRows(extractProgress(response))
  } catch (error) {
    console.error("[bonus] progress load failed", error)
    setProgressError(error instanceof Error ? error.message : "Failed to load progress")
  } finally {
    setProgressLoading(false)
  }
}

  useEffect(() => {
    loadChatters()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadRules()
    }, 250)
    return () => clearTimeout(timeout)
  }, [rulesSearch, ruleStatusFilter, rulesRefreshToken])

  // Default the preview rule to the first available one so preview works without extra clicks.
  useEffect(() => {
    if (rulesLoading || !rules.length) return
    setPreviewInputs((prev) => (prev.ruleId ? prev : { ...prev, ruleId: rules[0].id }))
  }, [rules, rulesLoading])

  useEffect(() => {
    if (section !== "awards") return
    loadAwards(awardsPage)
  }, [section, awardsPage, awardsFilters])

  useEffect(() => {
    if (section !== "progress") return
    loadProgress()
  }, [section, progressFilters])

  const handleRuleSelect = (rule: BonusRule, options?: { clone?: boolean }) => {
    const formState = ruleToFormState(rule)
    if (options?.clone) {
      delete formState.id
      formState.name = `${formState.name} (copy)`
      formState.active = false
      setIsEditing(false)
    } else {
      setIsEditing(true)
    }
    setRuleForm(formState)
    setFormErrors({})
    setPreviewResult(null)
    setPreviewError(null)
    setPreviewInputs((prev) => ({
      ...prev,
      ruleId: options?.clone ? undefined : rule.id,
    }))
    setShowRuleModal(true)
  }

  const handleCreateRule = () => {
    setRuleForm(makeEmptyRuleForm())
    setFormErrors({})
    setIsEditing(false)
    setPreviewResult(null)
    setPreviewError(null)
    setPreviewInputs((prev) => ({
      ...prev,
      ruleId: undefined,
    }))
    setShowRuleModal(true)
  }

  const handleRuleFormChange = <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) => {
    setRuleForm((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  const handleRuleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormBusy(true)
    setFormErrors({})
    try {
      const payload = buildRulePayload(ruleForm)
      const result = ruleForm.id
        ? await api.updateBonusRule(ruleForm.id, payload)
        : await api.createBonusRule(payload)

      toast({
        title: ruleForm.id ? "Rule updated" : "Rule created",
        description: "Bonus rule saved successfully.",
      })

      const savedRule = normalizeRule(result ?? {})
      setRuleForm(ruleToFormState(savedRule))
      setIsEditing(true)
      setPreviewInputs((prev) => ({
        ...prev,
        ruleId: savedRule.id,
      }))
      setRulesRefreshToken((token) => token + 1)
      setShowRuleModal(false)
    } catch (error) {
      const normalized = normalizeErrorMap(error)
      setFormErrors(normalized)
      toast({
        title: "Save failed",
        description:
          normalized.base?.[0] ?? "Could not save rule. Please check your input.",
        variant: "destructive",
      })
    } finally {
      setFormBusy(false)
    }
  }

  const handleToggleActive = async (rule: BonusRule) => {
    try {
      await api.setBonusRuleActive(rule.id, !rule.active)
      toast({
        title: !rule.active ? "Rule activated" : "Rule deactivated",
        description: rule.name,
      })
      setRulesRefreshToken((token) => token + 1)
    } catch (error) {
      toast({
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "Could not update status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePreview = async () => {
    if (!previewInputs.ruleId) {
      setPreviewError("Save the rule first to run a preview.")
      return
    }
    setPreviewBusy(true)
    setPreviewError(null)
    setPreviewResult(null)
    try {
      const response = await api.testBonusRule(previewInputs.ruleId, {
        workerId: previewInputs.workerId || undefined,
        asOf: previewInputs.asOfIso ? new Date(previewInputs.asOfIso).toISOString() : undefined,
      })
      setPreviewResult(response ?? {})
      toast({
        title: "Preview completed",
        description: "See the expected result below.",
      })
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.data?.message ?? error.message
          : error instanceof Error
            ? error.message
            : "Preview failed"
      setPreviewError(message)
      toast({
        title: "Preview failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleRunEngine = async () => {
    if (!previewInputs.workerId) {
      toast({
        title: "Worker required",
        description: "Select a worker to run bonuses.",
        variant: "destructive",
      })
      return
    }
    console.log("Running bonus engine...")
    try {
      toast({
        title: "Bonus engine",
        description: "Running a bonus evaluation now...",
      })
      const response = await api.runBonusEngine({
        workerId: previewInputs.workerId || undefined,
      })
      const summary =
        response?.summary ??
        response?.message ??
        `Evaluated ${response?.evaluatedRules ?? 0} rules`
      toast({
        title: "Bonus run completed",
        description: summary,
      })
      setAwardsPage(1)
      setRulesRefreshToken((token) => token + 1)
    } catch (error) {
      toast({
        title: "Run failed",
        description:
          error instanceof Error ? error.message : "Could not run the bonus engine. Please try again.",
        variant: "destructive",
      })
    }
  }

  const pageCount = useMemo(() => {
    if (!awardsTotalCount) return 1
    return Math.max(1, Math.ceil(awardsTotalCount / PAGE_SIZE))
  }, [awardsTotalCount])

  const renderFieldError = (field: string) => {
    if (!formErrors[field]) return null
    return (
      <p className="text-xs text-destructive" role="alert">
        {formErrors[field]?.join(", ")}
      </p>
    )
  }

  const disableSaveRule =
    formBusy ||
    !ruleForm.name.trim() ||
    !ruleForm.priority.trim() ||
    ruleForm.tiers.length === 0 ||
    !ruleForm.tiers.every((tier) => tier.minAmount.trim() !== "" && tier.bonusAmount.trim() !== "")

  return (
    <div className="space-y-6">
      <Tabs value={section} onValueChange={(value) => setSection(value as typeof section)}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="rules" className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="awards" className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Awards
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            Progress
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="mt-6 space-y-8">
          <Card className="shadow-sm border border-muted/40">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>Rules</CardTitle>
                      <CardDescription>
                        Overview of all bonus rules for this organization.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadRules()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                      <Button size="sm" onClick={handleCreateRule}>
                        <Plus className="mr-2 h-4 w-4" />
                        New rule
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-1">
                      <Label htmlFor="rule-search">Search</Label>
                      <Input
                        id="rule-search"
                        placeholder="Rule name"
                        value={rulesSearch}
                        onChange={(event) => setRulesSearch(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={ruleStatusFilter}
                        onValueChange={(value: "all" | "active" | "inactive") =>
                          setRuleStatusFilter(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-card shadow-sm">
                    <Table>
                      <TableCaption>Bonus rules linked to the selected company.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1">
                                  Window
                                  <ChevronDown className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">
                                  Day or month scope for threshold bonuses.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead className="text-right">Priority</TableHead>
                          <TableHead className="text-right">Active</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!rulesLoading &&
                          rules.map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">{rule.name}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>{WINDOW_LABELS[rule.windowType] ?? rule.windowType}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{rule.priority}</TableCell>
                              <TableCell className="text-right">
                                {rule.active ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-700">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                    Inactive
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRuleSelect(rule)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRuleSelect(rule, { clone: true })}
                                >
                                  <Copy className="mr-1 h-3 w-3" />
                                  Clone
                                </Button>
                                <Button
                                  variant={rule.active ? "outline" : "secondary"}
                                  size="sm"
                                  onClick={() => handleToggleActive(rule)}
                                >
                                  {rule.active ? "Deactivate" : "Activate"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        {rulesLoading && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading rules...
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {!rulesLoading && rules.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <div className="flex flex-col items-center gap-4 py-10 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted p-4 text-muted-foreground">
                                  <Award className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">No bonus rules yet.</p>
                                  <p className="text-sm">Create your first rule to get started.</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleCreateRule}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Create rule
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {rulesError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Could not load bonus rules</AlertTitle>
                      <AlertDescription>Please refresh the page or try again later.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
          </Card>
          <Card className="mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Rule preview
              </CardTitle>
              <CardDescription>Simuleer een directe run om te zien wat er nu zou worden uitgekeerd.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="preview-rule">Rule</Label>
                  <Select
                    value={previewInputs.ruleId || "none"}
                    onValueChange={(value) =>
                      setPreviewInputs((prev) => ({ ...prev, ruleId: value === "none" ? "" : value }))
                    }
                    disabled={rulesLoading || rules.length === 0}
                  >
                    <SelectTrigger id="preview-rule">
                      <SelectValue placeholder="Select rule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select rule</SelectItem>
                      {rules.map((rule) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {rule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preview-worker">Worker (optional)</Label>
                  <Select
                    value={previewInputs.workerId || "all"}
                    onValueChange={(value) =>
                      setPreviewInputs((prev) => ({ ...prev, workerId: value === "all" ? "" : value }))
                    }
                    disabled={chattersLoading}
                  >
                    <SelectTrigger id="preview-worker">
                      <SelectValue placeholder="All workers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All workers</SelectItem>
                      {workerOptions.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="preview-asof">As of</Label>
                  <Input
                    id="preview-asof"
                    type="datetime-local"
                    value={previewInputs.asOfIso}
                    onChange={(event) =>
                      setPreviewInputs((prev) => ({ ...prev, asOfIso: event.target.value }))
                    }
                  />
                </div>
              </div>
              <Button onClick={handlePreview} disabled={previewBusy}>
                {previewBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview payout now
              </Button>
              {previewError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{previewError}</span>
                </div>
              )}
              {previewResult && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Total earnings in window</p>
                    <p className="text-lg font-semibold">{formatMoney(previewResult.totalCents)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Steps now</p>
                    <p className="text-lg font-semibold">{formatSteps(previewResult.stepsNow)}</p>
                    <p className="text-xs text-muted-foreground">
                      ? {formatSteps(previewResult.delta)} vs. last run
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Expected award</p>
                    <p className="text-lg font-semibold">{formatMoney(previewResult.expectedAwardCents)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Steps awarded</p>
                    <p className="text-lg font-semibold">{formatSteps(previewResult.stepsAwarded)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 md:col-span-2">
                    <p className="text-xs text-muted-foreground">Window</p>
                    <p className="font-medium">
                      {previewResult.windowStart ? formatUserDateTime(previewResult.windowStart) : "-"}
                      {" "} - {" "}
                      {previewResult.windowEnd ? formatUserDateTime(previewResult.windowEnd) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 md:col-span-3">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="font-medium">{previewResult.reason ?? "-"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="awards" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Awards</CardTitle>
                <CardDescription>
                  View awarded bonuses and filter by worker, rule, or period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="awards-from">From</Label>
                    <Input
                      id="awards-from"
                      type="date"
                      value={awardsFilters.from}
                      onChange={(event) =>
                        setAwardsFilters((prev) => ({ ...prev, from: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awards-to">To</Label>
                    <Input
                      id="awards-to"
                      type="date"
                      value={awardsFilters.to}
                      onChange={(event) =>
                        setAwardsFilters((prev) => ({ ...prev, to: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Worker</Label>
                    <Select
                      value={awardsFilters.workerId || "all"}
                      onValueChange={(value) => {
                        setAwardsPage(1)
                        setAwardsFilters((prev) => ({ ...prev, workerId: value === "all" ? "" : value }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All workers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All workers</SelectItem>
                        {workerOptions.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>
                            {worker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rule</Label>
                    <Select
                      value={awardsFilters.ruleId || "all"}
                      onValueChange={(value) => {
                        setAwardsPage(1)
                        setAwardsFilters((prev) => ({ ...prev, ruleId: value === "all" ? "" : value }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All rules" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All rules</SelectItem>
                        {ruleOptions.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min amount</Label>
                    <Input
                      inputMode="decimal"
                      value={awardsFilters.minAmount}
                      onChange={(event) =>
                        setAwardsFilters((prev) => ({ ...prev, minAmount: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max amount</Label>
                    <Input
                      inputMode="decimal"
                      value={awardsFilters.maxAmount}
                      onChange={(event) =>
                        setAwardsFilters((prev) => ({ ...prev, maxAmount: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Granted</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead>Worker</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                        <TableHead className="text-right">Bonus</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!awardsLoading &&
                        awards.map((award) => (
                          <TableRow key={award.id}>
                            <TableCell>
                                {award.awardedAt ? formatUserDateTime(award.awardedAt) : "-"}
                            </TableCell>
                            <TableCell>{award.ruleName ?? "-"}</TableCell>
                            <TableCell>{award.workerName ?? "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatSteps(award.stepsAwarded)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(award.bonusAmountCents, award.bonusCurrency)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {award.reason ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      {awardsLoading && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading awards...
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {!awardsLoading && awards.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="py-10 text-center text-muted-foreground">
                              <p className="font-medium">No awards yet.</p>
                              <p className="text-sm">
                                Run the bonus engine or wait for the next run.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {awardsTotals?.page && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Page totals</p>
                    <p>
                      Bonus: {formatMoney(
                        awardsTotals.page.bonusAmountCents ??
                          awardsTotals.page.totalCents ??
                          awardsTotals.page.amountCents,
                      )}
                    </p>
                  </div>
                )}
                {awardsTotals?.filtered && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Filtered totals</p>
                    <p>
                      Bonus: {formatMoney(
                        awardsTotals.filtered.bonusAmountCents ??
                          awardsTotals.filtered.totalCents ??
                          awardsTotals.filtered.amountCents,
                      )}
                    </p>
                  </div>
                )}
                {awardsError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{awardsError}</span>
                  </div>
                )}
                {awardsTotalCount > PAGE_SIZE && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            setAwardsPage((prev) => Math.max(1, prev - 1))
                          }}
                        />
                      </PaginationItem>
                      {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={awardsPage === page}
                            onClick={(event) => {
                              event.preventDefault()
                              setAwardsPage(page)
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            setAwardsPage((prev) => Math.min(pageCount, prev + 1))
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="progress" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>
                  Use this table to understand why rules do or do not award.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Worker</Label>
                    <Select
                      value={progressFilters.workerId || "all"}
                      onValueChange={(value) =>
                        setProgressFilters((prev) => ({ ...prev, workerId: value === "all" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All workers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All workers</SelectItem>
                        {workerOptions.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>
                            {worker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rule</Label>
                    <Select
                      value={progressFilters.ruleId || "all"}
                      onValueChange={(value) =>
                        setProgressFilters((prev) => ({ ...prev, ruleId: value === "all" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All rules" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All rules</SelectItem>
                        {ruleOptions.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule</TableHead>
                        <TableHead>Worker</TableHead>
                        <TableHead className="text-right">Steps observed</TableHead>
                        <TableHead>Last computed</TableHead>
                        <TableHead>Window</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!progressLoading &&
                        progressRows.map((row, index) => (
                          <TableRow key={`${row.ruleId}-${row.workerId}-${index}`}>
                            <TableCell>{row.ruleName ?? "-"}</TableCell>
                            <TableCell>{row.workerName ?? "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatSteps(row.lastObservedSteps)}
                            </TableCell>
                            <TableCell>
                              {row.lastComputedAt ? formatUserDateTime(row.lastComputedAt) : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs text-muted-foreground">
                                {row.windowStartedAt && (
                                  <span>
                                    Start: {formatUserDateTime(row.windowStartedAt)}
                                  </span>
                                )}
                                {row.windowEndsAt && (
                                  <span>End: {formatUserDateTime(row.windowEndsAt)}</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {progressLoading && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading progress...
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {!progressLoading && progressRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="py-10 text-center text-muted-foreground">
                              <p className="font-medium">No progress tracked yet.</p>
                              <p className="text-sm">
                                Run the bonus engine or wait for earnings to arrive.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {progressError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{progressError}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      <Dialog open={showRuleModal} onOpenChange={setShowRuleModal}>
        <DialogContent className="max-w-3xl md:max-w-4xl">
          <DialogHeader className="pb-2">
            <DialogTitle>{isEditing ? "Edit rule" : "Create rule"}</DialogTitle>
            <DialogDescription>Set the rule parameters and save.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            <form className="space-y-6" onSubmit={handleRuleSubmit}>
              <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Rule basics</p>
                    <p className="text-xs text-muted-foreground">Start with a clear name, status, and ordering.</p>
                  </div>
                  <Badge variant="outline">{isEditing ? "Editing existing" : "New rule"}</Badge>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Name</Label>
                    <Input
                      id="rule-name"
                      value={ruleForm.name}
                      required
                      placeholder="Peak hours bonus"
                      onChange={(event) => handleRuleFormChange("name", event.target.value)}
                    />
                    {renderFieldError("name")}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1.2fr,1fr]">
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Active</p>
                        <p className="text-xs text-muted-foreground">
                          Determines whether the engine currently evaluates this rule.
                        </p>
                      </div>
                      <Switch checked={ruleForm.active} onCheckedChange={(checked) => handleRuleFormChange("active", checked)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-priority">Priority</Label>
                      <Input
                        id="rule-priority"
                        type="number"
                        inputMode="numeric"
                        placeholder="10"
                        value={ruleForm.priority}
                        onChange={(event) => handleRuleFormChange("priority", event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Lower numbers run earlier. Use this when rules overlap.</p>
                      {renderFieldError("priority")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Window</p>
                  <p className="text-xs text-muted-foreground">Defines the evaluation period.</p>
                </div>
                <Select value={ruleForm.windowType} onValueChange={(value) => handleRuleFormChange("windowType", value as WindowType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a window" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WINDOW_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-2 flex items-start justify-between gap-4 rounded-lg border border-slate-200/80 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Shift-based totals</p>
                    <p className="text-xs text-muted-foreground">Sum earnings within the day's shifts instead of 00:00-23:59 (UTC).</p>
                  </div>
                  <Switch checked={ruleForm.shiftBased} onCheckedChange={(checked) => handleRuleFormChange("shiftBased", checked)} />
                </div>
              </div>

              <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Threshold tiers</p>
                  <p className="text-xs text-muted-foreground">Define earnings thresholds and bonuses for this rule.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric">Metric</Label>
                  <Input id="metric" value="earnings.amount_cents" disabled />
                </div>
                <div className="space-y-4">
                  {ruleForm.tiers.map((tier, index) => (
                    <div key={index} className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/60 p-4">
                      <div className="grid items-start gap-3 md:grid-cols-[1fr,1fr,auto]">
                        <div className="space-y-2">
                          <Label>Min amount</Label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                              €
                            </span>
                            <Input
                              inputMode="decimal"
                              className="pl-7"
                              placeholder="0,00"
                              value={tier.minAmount}
                              onChange={(event) => {
                                const value = event.target.value
                                setRuleForm((prev) => ({
                                  ...prev,
                                  tiers: prev.tiers.map((t, i) => (i === index ? { ...t, minAmount: value } : t)),
                                }))
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Bonus</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0,00"
                            value={tier.bonusAmount}
                            onChange={(event) => {
                              const value = event.target.value
                              setRuleForm((prev) => ({
                                ...prev,
                                tiers: prev.tiers.map((t, i) => (i === index ? { ...t, bonusAmount: value } : t)),
                              }))
                            }}
                          />
                        </div>
                        <div className="flex justify-end pt-6 md:pt-0">
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove tier"
                              onClick={() =>
                                setRuleForm((prev) => ({
                                  ...prev,
                                  tiers: prev.tiers.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Bonus awarded when earnings in window &gt;= Min amount.</p>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() =>
                      setRuleForm((prev) => ({
                        ...prev,
                        tiers: [...prev.tiers, { minAmount: "0,00", bonusAmount: "0,00" }],
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add tier
                  </Button>
                </div>
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200/80 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Include refunds</p>
                      <p className="text-xs text-muted-foreground">
                        Include negative adjustments (refunds) when calculating totals.
                      </p>
                    </div>
                    <Switch checked={ruleForm.includeRefunds} onCheckedChange={(checked) => handleRuleFormChange("includeRefunds", checked)} />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200/80 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Award once per window</p>
                      <p className="text-xs text-muted-foreground">
                        Ensure at most one bonus per period, even if multiple tiers are met.
                      </p>
                    </div>
                    <Switch
                      checked={ruleForm.awardOncePerWindow}
                      onCheckedChange={(checked) => handleRuleFormChange("awardOncePerWindow", checked)}
                    />
                  </div>
                </div>
              </div>

              {formErrors.base && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{formErrors.base.join(", ")}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCreateRule} disabled={formBusy}>
                  Reset
                </Button>
                <Button type="submit" disabled={disableSaveRule}>
                  {formBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save rule
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

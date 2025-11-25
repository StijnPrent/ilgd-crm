// Frontend API client for connecting to the Express backend
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"

type PaginatedArrayResponse<T> =
  | T[]
  | {
      data?: T[]
      items?: T[]
      results?: T[]
      rows?: T[]
    }

const extractArrayFromResponse = <T>(response: PaginatedArrayResponse<T> | null | undefined): T[] => {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.items)) return response.items
  if (Array.isArray(response.results)) return response.results
  if (Array.isArray(response.rows)) return response.rows
  return []
}

const buildEntryKey = (entry: unknown): string => {
  if (!entry || typeof entry !== "object") {
    return JSON.stringify(entry)
  }

  const candidate = entry as { id?: string | number }
  if (candidate.id !== undefined && candidate.id !== null) {
    return `id:${String(candidate.id)}`
  }

  try {
    return JSON.stringify(entry)
  } catch {
    return String(entry)
  }
}

async function fetchAllPages<T>(
  loader: (options: { limit: number; offset: number }) => Promise<PaginatedArrayResponse<T> | null | undefined>,
  { pageSize = 50, maxPages = 100 }: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const limit = Math.max(1, Math.min(pageSize, 500))
  const seenKeys = new Set<string>()
  const results: T[] = []
  let offset = 0

  for (let page = 0; page < maxPages; page++) {
    const response = await loader({ limit, offset })
    const entries = extractArrayFromResponse<T>(response)
    if (entries.length === 0) {
      break
    }

    let added = 0
    for (const entry of entries) {
      const key = buildEntryKey(entry)
      if (seenKeys.has(key)) {
        continue
      }
      seenKeys.add(key)
      results.push(entry as T)
      added += 1
    }

    if (added === 0) {
      break
    }

    offset += entries.length
  }

  return results
}

export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

class ApiClient {
  // In-flight request registry and short-lived response cache
  private inFlight = new Map<string, Promise<any>>()
  private responseCache = new Map<string, { ts: number; data: any }>()

  private buildKey(url: string, method: string, token?: string) {
    return `${method.toUpperCase()}:${url}:${token ?? ""}`
  }

  private getAuthHeaders(): Record<any, any> {
    if (typeof window === "undefined") return {}
    const token = localStorage.getItem("auth_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async request(
    endpoint: string,
    options: RequestInit & { cacheTtlMs?: number; dedupe?: boolean } = {},
  ) {
    const url = `${API_BASE_URL}${endpoint}`
    const authHeaders = this.getAuthHeaders()
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    }

    const method = (config.method || "GET").toString().toUpperCase()
    const isGet = method === "GET"
    const enableDedupe = options.dedupe !== false && isGet
    const cacheTtl = isGet ? Math.max(0, options.cacheTtlMs ?? 5000) : 0
    const token = typeof authHeaders["Authorization"] === "string" ? authHeaders["Authorization"] : undefined
    const key = this.buildKey(url, method, token)

    // Fast path: fresh cached response
    if (cacheTtl > 0) {
      const cached = this.responseCache.get(key)
      if (cached && Date.now() - cached.ts < cacheTtl) {
        return cached.data
      }
    }

    // De-duplicate concurrent GETs
    if (enableDedupe) {
      const existing = this.inFlight.get(key)
      if (existing) return existing
    }

    const doFetch = (async () => {
      const response = await fetch(url, config)
      if (!response.ok) {
        let errorData: any = null
        try {
          const text = await response.text()
          try {
            errorData = text ? JSON.parse(text) : null
          } catch {
            errorData = text
          }
        } catch {
          errorData = null
        }
        const message =
          (typeof errorData === "string" && errorData) ||
          (errorData?.message as string) ||
          `API Error: ${response.status} ${response.statusText}`
        throw new ApiError(message, response.status, errorData)
      }
      if (response.status === 204) return null
      const data = await response.json()
      if (isGet && cacheTtl > 0) {
        this.responseCache.set(key, { ts: Date.now(), data })
      }
      return data
    })()

    if (enableDedupe) {
      this.inFlight.set(key, doFetch)
      try {
        const data = await doFetch
        return data
      } finally {
        this.inFlight.delete(key)
      }
    }

    return doFetch
  }

  /* ---------- Auth ---------- */
  async login(username: string, password: string) {
    const data = await this.request("/users/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })

    if (data.token) {
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
    }

    return data
  }

  logout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user")
  }

  /* ---------- Users ---------- */
  getUsers() {
    return this.request("/users")
  }

  getUser(id: string) {
    return this.request(`/users/${id}`)
  }

  createUser(userData: any) {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  updateUser(id: string, userData: any) {
    return this.request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    })
  }

  deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: "DELETE" })
  }

  getModelsWithEarnings(params?: { from?: string; to?: string }) {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/models/earnings${query}`)
  }

  createModel(modelData: any) {
    return this.request("/models", {
      method: "POST",
      body: JSON.stringify(modelData),
    })
  }

  updateModel(id: string, modelData: any) {
    return this.request(`/models/${id}`, {
      method: "PUT",
      body: JSON.stringify(modelData),
    })
  }

  deleteModel(id: string) {
    return this.request(`/models/${id}`, { method: "DELETE" })
  }

  /* ---------- Chatters ---------- */
  getChatters() {
    return this.request("/chatters")
  }

  getChatter(id: string) {
    return this.request(`/chatters/${id}`)
  }

  getOnlineChatters() {
    return this.request("/chatters/online")
  }

  createChatter(chatterData: any) {
    return this.request("/chatters", {
      method: "POST",
      body: JSON.stringify(chatterData),
    })
  }

  updateChatter(id: string, chatterData: any) {
    return this.request(`/chatters/${id}`, {
      method: "PUT",
      body: JSON.stringify(chatterData),
    })
  }

  deleteChatter(id: string) {
    return this.request(`/chatters/${id}`, { method: "DELETE" })
  }

  /* ---------- Models ---------- */
  getModels() {
    return this.request("/models")
  }

  getModel(id: string) {
    return this.request(`/models/${id}`)
  }

  /* ---------- Shift Requests ---------- */
  getShiftRequests(params?: { status?: string; chatterId?: string; includeResolved?: boolean }) {
    const search = new URLSearchParams()
    if (params?.status) search.set("status", params.status)
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    if (params?.includeResolved) search.set("includeResolved", "true")
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/shift-requests${query}`)
  }

  createShiftRequest(payload: {
    shiftId: string
    chatterId: string
    type: string
    note?: string
  }) {
    return this.request("/shift-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  updateShiftRequest(
    id: string,
    payload: {
      status: string
      managerNote?: string
    },
  ) {
    return this.request(`/shift-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  }

  /* ---------- Employee Earnings ---------- */
  getEmployeeEarnings(params?: {
    limit?: number
    offset?: number
    chatterId?: string
    type?: string
    types?: string[]
    modelId?: string
    shiftId?: string
    date?: string
    from?: string
    to?: string
  }) {
    const search = new URLSearchParams()
    if (params?.limit !== undefined) search.set("limit", String(params.limit))
    if (params?.offset !== undefined) search.set("offset", String(params.offset))
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    if (params?.types?.length) {
      params.types.forEach((type) => search.append("type", type))
    } else if (params?.type) {
      search.set("type", params.type)
    }
    if (params?.modelId) search.set("modelId", params.modelId)
    if (params?.shiftId) search.set("shiftId", params.shiftId)
    if (params?.date) search.set("date", params.date)
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    console.log(params?.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/employee-earnings${query}`)
  }

  async getEmployeeEarningsPaginated(params: {
    limit: number
    offset: number
    chatterId?: string
    type?: string
    types?: string[]
    modelId?: string
    shiftId?: string
    date?: string
    from?: string
    to?: string
  }) {
    const search = new URLSearchParams()
    search.set("limit", String(params.limit))
    search.set("offset", String(params.offset))
    if (params.chatterId) search.set("chatterId", params.chatterId)
    if (params.types?.length) {
      params.types.forEach((type) => search.append("type", type))
    } else if (params.type) {
      search.set("type", params.type)
    }
    if (params.modelId) search.set("modelId", params.modelId)
    if (params.shiftId) search.set("shiftId", params.shiftId)
    if (params.date) search.set("date", params.date)
    if (params.from) search.set("from", params.from)
    if (params.to) search.set("to", params.to)
    const query = `?${search.toString()}`

    const response = await fetch(`${API_BASE_URL}/employee-earnings${query}`, {
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data
  }

  async getAllEmployeeEarnings(params?: {
    pageSize?: number
    chatterId?: string
    type?: string
    types?: string[]
    modelId?: string
    shiftId?: string
    date?: string
    from?: string
    to?: string
  }) {
    const { pageSize, ...rest } = params ?? {}
    return fetchAllPages<any>(
      ({ limit, offset }) =>
        this.getEmployeeEarningsPaginated({
          limit,
          offset,
          ...rest,
        }),
      { pageSize },
    )
  }

  getEmployeeEarningsByChatter(id: string) {
    return this.request(`/employee-earnings/chatter/${id}`)
  }

  getEmployeeEarningsLeaderboard(params?: { from?: string; to?: string }) {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    console.log("Params:", params)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/employee-earnings/leaderboard${query}`)
  }

  getEmployeeEarning(id: string) {
    return this.request(`/employee-earnings/${id}`)
  }

  getTotalCount(params?: {
    chatterId?: string
    type?: string
    types?: string[]
    modelId?: string
    shiftId?: string
    date?: string
    from?: string
    to?: string
  }) {
    const search = new URLSearchParams()
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    if (params?.types?.length) {
      params.types.forEach((type) => search.append("type", type))
    } else if (params?.type) {
      search.set("type", params.type)
    }
    if (params?.modelId) search.set("modelId", params.modelId)
    if (params?.shiftId) search.set("shiftId", params.shiftId)
    if (params?.date) search.set("date", params.date)
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/employee-earnings/totalCount${query}`)
  }

  addEmployeeEarning(data: any) {
    return this.request("/employee-earnings", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  updateEmployeeEarning(id: string, data: any) {
    return this.request(`/employee-earnings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  deleteEmployeeEarning(id: string) {
    return this.request(`/employee-earnings/${id}`, { method: "DELETE" })
  }

  syncEarnings(from: string | Date, to: string | Date) {
    const payload = {
      from: typeof from === "string" ? from : from.toISOString(),
      to: typeof to === "string" ? to : to.toISOString(),
    }
    return this.request(`/employee-earnings/sync`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  /* ---------- Revenue ---------- */
  getRevenueEarnings(params?: { from?: string; to?: string; limit?: number; offset?: number }) {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    if (params?.limit !== undefined) search.set("limit", String(params.limit))
    if (params?.offset !== undefined) search.set("offset", String(params.offset))
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/revenue/earnings${query}`)
  }

  async getAllRevenueEarnings(params?: { from?: string; to?: string; pageSize?: number }) {
    const { pageSize, ...rest } = params ?? {}
    return fetchAllPages<any>(
      ({ limit, offset }) =>
        this.getRevenueEarnings({
          ...rest,
          limit,
          offset,
        }),
      { pageSize },
    )
  }

  getRevenueStats(params?: { from?: string; to?: string }) {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/revenue/stats${query}`)
  }

  /* ---------- Commissions ---------- */
  getCommissions(params?: {
    chatterId?: string
    limit?: number
    offset?: number
    date?: string
    from?: string
    to?: string
  }) {
    const search = new URLSearchParams()
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    if (params?.limit !== undefined) search.set("limit", String(params.limit))
    if (params?.offset !== undefined) search.set("offset", String(params.offset))
    if (params?.date) search.set("date", params.date)
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/commissions${query}`)
  }

  getCommissionsTotalCount(params?: {
    chatterId?: string
    date?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }) {
    const search = new URLSearchParams()
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    if (params?.date) search.set("date", params.date)
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/commissions/totalCount${query}`)
  }

  createCommission(data: any) {
    return this.request("/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  updateCommission(id: string, data: any) {
    return this.request(`/commissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  deleteCommission(id: string) {
    return this.request(`/commissions/${id}`, { method: "DELETE" })
  }

  getShifts(params?: { from?: string; to?: string; chatterId?: string }) {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    if (params?.chatterId) search.set("chatterId", params.chatterId)
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/shifts${query}`)
  }

  getShift(id: string) {
    return this.request(`/shifts/${id}`)
  }

  createShift(shiftData: any) {
    return this.request("/shifts", {
      method: "POST",
      body: JSON.stringify(shiftData),
    })
  }

  updateShift(id: string, shiftData: any) {
    return this.request(`/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(shiftData),
    })
  }

  clockIn(id: string) {
    return this.request(`/shifts/clock-in`, {
      method: "POST",
        body: JSON.stringify({ chatterId: id }),
    })
  }

  clockOut(id: string) {
    return this.request(`/shifts/${id}/clock-out`, {
      method: "POST",
    })
  }

  deleteShift(id: string) {
    return this.request(`/shifts/${id}`, { method: "DELETE" })
  }

  /* ---------- Time Tracking ---------- */
  getActiveTimeEntry(chatterId: string) {
    return this.request(`/shifts/time-entry/active/${chatterId}`)
  }

  /* ---------- Face2Face Automation Settings ---------- */
  getF2FCookies() {
    return this.request(`/settings/f2f-cookies`)
  }

  updateF2FCookies(data: { cookies: string }) {
    return this.request(`/settings/f2f-cookies`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  /* ---------- Company Settings ---------- */
  getCompanySettings() {
    return this.request("/settings/company")
  }

  updateCompanySettings(payload: {
    name?: string
    currency?: string
    timezone?: string
    timeZone?: string
    email?: string
    [key: string]: any
  }) {
    return this.request("/settings/company", {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  }

  /* ---------- Bonus Rules ---------- */
  getBonusRules(params?: {
    active?: boolean
    ruleType?: string
    search?: string
    limit?: number
    offset?: number
  }) {
    const search = new URLSearchParams()
    if (params?.active !== undefined) {
      search.set("active", params.active ? "true" : "false")
    }
    if (params?.ruleType) {
      search.set("ruleType", params.ruleType)
    }
    if (params?.search) {
      search.set("search", params.search)
    }
    if (params?.limit !== undefined) search.set("limit", String(params.limit))
    if (params?.offset !== undefined) search.set("offset", String(params.offset))
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/bonus/rules${query}`, { cacheTtlMs: 0 })
  }

  getBonusRule(ruleId: string) {
    return this.request(`/bonus/rules/${ruleId}`, { cacheTtlMs: 0 })
  }

  createBonusRule(payload: any) {
    return this.request("/bonus/rules", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  updateBonusRule(ruleId: string, payload: any) {
    return this.request(`/bonus/rules/${ruleId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  }

  deleteBonusRule(ruleId: string) {
    return this.request(`/bonus/rules/${ruleId}`, {
      method: "DELETE",
    })
  }

  setBonusRuleActive(
    ruleId: string,
    active: boolean,
    payload?: { keepWindowState?: boolean },
  ) {
    const body: Record<string, any> = { active, isActive: active }
    if (payload?.keepWindowState !== undefined) {
      body.keepWindowState = payload.keepWindowState
    }
    return this.request(`/bonus/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  }

  testBonusRule(ruleId: string, payload: { workerId?: string; asOf?: string }) {
    return this.request(`/bonus/rules/${ruleId}/test`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  getBonusAwards(params: {
    workerId?: string
    ruleId?: string
    minAmountCents?: number
    maxAmountCents?: number
    from?: string
    to?: string
    offset?: number
    limit?: number
  }) {
    const search = new URLSearchParams()
    if (params.workerId) search.set("workerId", params.workerId)
    if (params.ruleId) search.set("ruleId", params.ruleId)
    if (params.minAmountCents !== undefined) {
      search.set("minAmountCents", String(params.minAmountCents))
    }
    if (params.maxAmountCents !== undefined) {
      search.set("maxAmountCents", String(params.maxAmountCents))
    }
    if (params.from) search.set("from", params.from)
    if (params.to) search.set("to", params.to)
    if (params.offset !== undefined) search.set("offset", String(params.offset))
    if (params.limit !== undefined) search.set("limit", String(params.limit))
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/bonus/awards${query}`, { cacheTtlMs: 0 })
  }

  getBonusProgress(params: {
    workerId?: string
    ruleId?: string
    offset?: number
    limit?: number
  }) {
    const search = new URLSearchParams()
    if (params.workerId) search.set("workerId", params.workerId)
    if (params.ruleId) search.set("ruleId", params.ruleId)
    if (params.offset !== undefined) search.set("offset", String(params.offset))
    if (params.limit !== undefined) search.set("limit", String(params.limit))
    const query = search.toString() ? `?${search.toString()}` : ""
    return this.request(`/bonus/progress${query}`, { cacheTtlMs: 0 })
  }

  runBonusEngine(payload: { workerId?: string }) {
    return this.request("/bonus/run", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }
}

export const api = new ApiClient()

// Frontend API client for connecting to the Express backend
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"

class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {}
    const token = localStorage.getItem("auth_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    if (response.status === 204) return null
    return response.json()
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

  /* ---------- Chatters ---------- */
  getChatters() {
    return this.request("/chatters")
  }

  getChatter(id: string) {
    return this.request(`/chatters/${id}`)
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

  /* ---------- Employee Earnings ---------- */
  getEmployeeEarnings() {
    return this.request("/employee-earnings")
  }

  getEmployeeEarning(id: string) {
    return this.request(`/employee-earnings/${id}`)
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

  /* ---------- Commissions ---------- */
  getCommissions() {
    return this.request("/commissions")
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

  getShifts() {
    return this.request("/shifts")
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
}

export const api = new ApiClient()

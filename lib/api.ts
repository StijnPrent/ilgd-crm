// Frontend API client for connecting to your Express backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"

class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("auth_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async request(endpoint: string, options: RequestInit = {}) {
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

    return response.json()
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })

    if (data.token) {
      localStorage.setItem("auth_token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
    }

    return data
  }

  async logout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user")
    // Optionally call backend logout endpoint
    // await this.request('/auth/logout', { method: 'POST' })
  }

  // Employee endpoints
  async getProfile() {
    return this.request("/employee/profile")
  }

  async clockIn() {
    return this.request("/employee/clock-in", { method: "POST" })
  }

  async clockOut() {
    return this.request("/employee/clock-out", { method: "POST" })
  }

  async getTimeEntries(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append("start_date", startDate)
    if (endDate) params.append("end_date", endDate)

    return this.request(`/employee/time-entries?${params}`)
  }

  async addEarnings(amount: number, description: string, date: string) {
    return this.request("/employee/earnings", {
      method: "POST",
      body: JSON.stringify({ amount, description, date }),
    })
  }

  async getEarnings(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append("start_date", startDate)
    if (endDate) params.append("end_date", endDate)

    return this.request(`/employee/earnings?${params}`)
  }

  // Manager endpoints
  async getEmployees() {
    return this.request("/manager/employees")
  }

  async createEmployee(employeeData: any) {
    return this.request("/manager/employees", {
      method: "POST",
      body: JSON.stringify(employeeData),
    })
  }

  async updateEmployee(id: string, employeeData: any) {
    return this.request(`/manager/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(employeeData),
    })
  }

  async deleteEmployee(id: string) {
    return this.request(`/manager/employees/${id}`, {
      method: "DELETE",
    })
  }

  async getManagerStats() {
    return this.request("/manager/stats")
  }

  async getAllTimeEntries() {
    return this.request("/manager/time-entries")
  }

  async getAllEarnings() {
    return this.request("/manager/earnings")
  }
}

export const api = new ApiClient()

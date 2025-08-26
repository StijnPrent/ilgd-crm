"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    console.log("[v0] Login attempt started")
    console.log("[v0] Username:", username)
    console.log("[v0] Password length:", password.length)

    try {
      if (username === "admin" && password === "wolf123") {
        console.log("[v0] Admin credentials match, storing session")
        localStorage.setItem(
          "user",
          JSON.stringify({
            username: "admin",
            role: "manager",
            id: "1",
          }),
        )

        document.cookie = "user-session=logged-in; path=/; max-age=86400"
        console.log("[v0] Cookie set for middleware authentication")

        console.log("[v0] Session stored, attempting redirect to /manager")
        window.location.href = "/manager"
        console.log("[v0] Hard redirect called")
      } else {
        const managerCredentials = JSON.parse(localStorage.getItem("manager_credentials") || "{}")
        const managerData = managerCredentials[username]

        if (managerData && managerData.password === password) {
          console.log("[v0] Manager credentials match, storing session")
          localStorage.setItem(
            "user",
            JSON.stringify({
              username: username,
              role: "manager",
              id: Date.now().toString(),
              fullName: managerData.fullName,
            }),
          )

          document.cookie = "user-session=logged-in; path=/; max-age=86400"
          console.log("[v0] Cookie set for middleware authentication")

          console.log("[v0] Session stored, attempting redirect to /manager")
          window.location.href = "/manager"
          console.log("[v0] Hard redirect called")
        } else {
          // Check for chatter login using email as username
          const chatterCredentials = JSON.parse(localStorage.getItem("chatter_credentials") || "{}")
          const chatterData = chatterCredentials[username] // username is actually email for chatters

          console.log("[v0] Checking chatter credentials for:", username)
          console.log("[v0] Available chatter emails:", Object.keys(chatterCredentials))
          console.log("[v0] Full chatter credentials object:", chatterCredentials)
          console.log("[v0] Chatter data found:", chatterData)
          console.log("[v0] Password match:", chatterData ? chatterData.password === password : "No chatter data")

          if (chatterData && chatterData.password === password) {
            console.log("[v0] Chatter credentials match, storing session")
            localStorage.setItem(
              "user",
              JSON.stringify({
                username: username,
                role: "chatter",
                id: chatterData.id,
              }),
            )

            document.cookie = "user-session=logged-in; path=/; max-age=86400"
            console.log("[v0] Cookie set for middleware authentication")

            console.log("[v0] Session stored, attempting redirect to /dashboard")
            window.location.href = "/dashboard"
            console.log("[v0] Hard redirect called")
          } else {
            console.log("[v0] Invalid credentials - no matching chatter found or password mismatch")
            throw new Error("Invalid login credentials")
          }
        }
      }
    } catch (error: unknown) {
      console.log("[v0] Login error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
      console.log("[v0] Login process completed")
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Employee Dashboard</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Chatters: gebruik je email adres als gebruikersnaam</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    api.logout()
    router.push("/auth/login")
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      <LogOut className="h-4 w-4 mr-2" />
      Logout
    </Button>
  )
}

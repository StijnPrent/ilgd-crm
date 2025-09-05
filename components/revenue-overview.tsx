"use client"

import {useState} from "react"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {useEmployeeEarnings} from "@/hooks/use-employee-earnings"
import {DollarSign} from "lucide-react"

export function RevenueOverview() {
  const { earnings, loading } = useEmployeeEarnings()
  const [platformFee, setPlatformFee] = useState(20)
  const [splitRate, setSplitRate] = useState(50)
  const [deduction, setDeduction] = useState(0)

  const total = (earnings || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const platformFeeAmount = total * (platformFee / 100)
  const afterPlatform = total - platformFeeAmount
  const modelPayout = afterPlatform * (splitRate / 100)
  const companyRevenue = afterPlatform - modelPayout
  const finalRevenue = companyRevenue - deduction

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount)

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue After Split
        </CardTitle>
        <CardDescription>
          View total revenue after platform fees and model split.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="platform-fee">Platform fee (%)</Label>
            <Input
              id="platform-fee"
              type="number"
              value={platformFee}
              onChange={(e) => setPlatformFee(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-rate">Model split (%)</Label>
            <Input
              id="split-rate"
              type="number"
              value={splitRate}
              onChange={(e) => setSplitRate(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deduction">Additional deductions (€)</Label>
            <Input
              id="deduction"
              type="number"
              value={deduction}
              onChange={(e) => setDeduction(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total earnings</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform fee ({platformFee}%)</span>
            <span>-{formatCurrency(platformFeeAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>After platform</span>
            <span>{formatCurrency(afterPlatform)}</span>
          </div>
          <div className="flex justify-between">
            <span>Model split ({splitRate}%)</span>
            <span>-{formatCurrency(modelPayout)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Company revenue</span>
            <span>{formatCurrency(companyRevenue)}</span>
          </div>
          {deduction !== 0 && (
            <div className="flex justify-between">
              <span>Other deductions</span>
              <span>-{formatCurrency(deduction)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Final revenue</span>
            <span>{formatCurrency(finalRevenue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


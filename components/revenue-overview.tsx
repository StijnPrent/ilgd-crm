"use client"

import {useEffect, useState} from "react"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Button} from "@/components/ui/button"
import {useEmployeeEarnings} from "@/hooks/use-employee-earnings"
import {DollarSign, X} from "lucide-react"
import {api} from "@/lib/api"

export function RevenueOverview() {
  const { earnings, loading } = useEmployeeEarnings()
  const [platformFee, setPlatformFee] = useState(20)
  const [modelsMap, setModelsMap] = useState<Map<string, number>>(new Map())
  const [chattersMap, setChattersMap] = useState<Map<string, number>>(new Map())
  const [adjustments, setAdjustments] = useState<number[]>([])
  const [commissionLoading, setCommissionLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelsData, chattersData] = await Promise.all([
          api.getModels(),
          api.getChatters(),
        ])
        setModelsMap(new Map((modelsData || []).map((m: any) => [String(m.id), m.commissionRate || 0])))
        setChattersMap(new Map((chattersData || []).map((c: any) => [String(c.id), c.commissionRate || c.commission_rate || 0])))
      } catch (err) {
        console.error("Failed to load commission data:", err)
      } finally {
        setCommissionLoading(false)
      }
    }
    fetchData()
  }, [])

  const total = (earnings || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const platformFeeAmount = total * (platformFee / 100)
  const afterPlatform = total - platformFeeAmount

  let modelCommission = 0
  let chatterCommission = 0
  ;(earnings || []).forEach((e: any) => {
    const amount = e.amount || 0
    const net = amount * (1 - platformFee / 100)
    const mRate = modelsMap.get(String(e.modelId ?? e.model_id)) || 0
    const cRate = chattersMap.get(String(e.chatterId ?? e.chatter_id)) || 0
    modelCommission += net * (mRate / 100)
    chatterCommission += net * (cRate / 100)
  })

  const companyRevenue = afterPlatform - modelCommission - chatterCommission
  const adjustmentsTotal = adjustments.reduce((sum, val) => sum + (val || 0), 0)
  const finalRevenue = companyRevenue + adjustmentsTotal

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount)

  const addAdjustment = () => setAdjustments([...adjustments, 0])
  const updateAdjustment = (index: number, value: number) => {
    const newAdjustments = [...adjustments]
    newAdjustments[index] = value
    setAdjustments(newAdjustments)
  }
  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index))
  }

  if (loading || commissionLoading) {
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
          Revenue Overview
        </CardTitle>
        <CardDescription>
          Total revenue after platform, model and chatter commissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
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
            <Label>Manual adjustments (negative = cost)</Label>
            {adjustments.map((adj, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={adj}
                  onChange={(e) => updateAdjustment(idx, Number(e.target.value) || 0)}
                />
                <Button variant="outline" size="icon" onClick={() => removeAdjustment(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addAdjustment} className="w-full">
              Add adjustment
            </Button>
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
            <span>Model commissions</span>
            <span>-{formatCurrency(modelCommission)}</span>
          </div>
          <div className="flex justify-between">
            <span>Chatter commissions</span>
            <span>-{formatCurrency(chatterCommission)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Company revenue</span>
            <span>{formatCurrency(companyRevenue)}</span>
          </div>
          {adjustmentsTotal !== 0 && (
            <div className="flex justify-between">
              <span>Adjustments</span>
              <span>{adjustmentsTotal >= 0 ? "+" : ""}{formatCurrency(adjustmentsTotal)}</span>
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


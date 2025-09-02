"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"

interface Model {
  id: string
  displayName: string
  username: string
  commissionRate: number
  createdAt: string
}

export function ModelsList() {
  const [models, setModels] = useState<Model[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newModel, setNewModel] = useState({
    displayName: "",
    username: "",
    commissionRate: "",
  })

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const data = await api.getModels()
      setModels(
        (data || []).map((m: any) => ({
          id: String(m.id),
          displayName: m.displayName,
          username: m.username,
          commissionRate: m.commissionRate,
          createdAt: m.createdAt,
        }))
      )
    } catch (err) {
      console.error("Error fetching models:", err)
    }
  }

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createModel({
        displayName: newModel.displayName,
        username: newModel.username,
        commissionRate: parseFloat(newModel.commissionRate) || 0,
      })
      setNewModel({ displayName: "", username: "", commissionRate: "" })
      setIsAddOpen(false)
      fetchModels()
    } catch (err) {
      console.error("Error creating model:", err)
    }
  }

  const handleDeleteModel = async (id: string) => {
    try {
      await api.deleteModel(id)
      setModels((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error("Error deleting model:", err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Models</CardTitle>
            <CardDescription>Manage models</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Model</DialogTitle>
                <DialogDescription>Create a new model</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddModel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={newModel.displayName}
                    onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newModel.username}
                    onChange={(e) => setNewModel({ ...newModel, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">Commission Rate</Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    step="0.01"
                    value={newModel.commissionRate}
                    onChange={(e) => setNewModel({ ...newModel, commissionRate: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Model
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">{model.displayName}</TableCell>
                <TableCell>{model.username}</TableCell>
                <TableCell>{model.commissionRate}%</TableCell>
                <TableCell>{new Date(model.createdAt).toLocaleDateString("nl-NL")}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Model</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {model.displayName}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteModel(model.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {models.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No models added yet.</div>
        )}
      </CardContent>
    </Card>
  )
}


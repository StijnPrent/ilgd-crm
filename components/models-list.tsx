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
import { Plus, Trash2, Pencil } from "lucide-react"
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
  const [editingModel, setEditingModel] = useState<{
    id: string
    displayName: string
    username: string
    commissionRate: string
  } | null>(null)

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

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingModel) return
    try {
      await api.updateModel(editingModel.id, {
        displayName: editingModel.displayName,
        username: editingModel.username,
        commissionRate: parseFloat(editingModel.commissionRate) || 0,
      })
      setEditingModel(null)
      fetchModels()
    } catch (err) {
      console.error("Error updating model:", err)
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
    <>
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
              <TableHead className="hidden md:block">Username</TableHead>
              <TableHead className="hidden md:block">Commission</TableHead>
              <TableHead className="hidden md:block">Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">{model.displayName}</TableCell>
                <TableCell className="hidden md:block">{model.username}</TableCell>
                <TableCell className="hidden md:block">{model.commissionRate}%</TableCell>
                <TableCell className="hidden md:block">{new Date(model.createdAt).toLocaleDateString("nl-NL")}</TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditingModel({
                        id: model.id,
                        displayName: model.displayName,
                        username: model.username,
                        commissionRate: String(model.commissionRate),
                      })
                    }
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
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
      <Dialog open={!!editingModel} onOpenChange={(open) => !open && setEditingModel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>Update model details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateModel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                value={editingModel?.displayName || ""}
                onChange={(e) =>
                  setEditingModel((prev) =>
                    prev ? { ...prev, displayName: e.target.value } : prev,
                  )
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editingModel?.username || ""}
                onChange={(e) =>
                  setEditingModel((prev) =>
                    prev ? { ...prev, username: e.target.value } : prev,
                  )
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-commissionRate">Commission Rate</Label>
              <Input
                id="edit-commissionRate"
                type="number"
                step="0.01"
                value={editingModel?.commissionRate || ""}
                onChange={(e) =>
                  setEditingModel((prev) =>
                    prev ? { ...prev, commissionRate: e.target.value } : prev,
                  )
                }
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Update Model
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}


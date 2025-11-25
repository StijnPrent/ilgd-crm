"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Inbox,
  RefreshCcw,
  RotateCcw,
  ArrowLeftRight,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatUserDate, formatUserDateTime, formatUserTime } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";

type ShiftAction = "cancel" | "trade";

type ShiftRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "resolved";

type StatusFilter = "pending" | "all";

interface chatter {
  id: string;
  name: string;
}

interface ShiftRequestItem {
  id: string;
  chatter: chatter;
  shiftId: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  type: ShiftAction;
  status: ShiftRequestStatus;
  note?: string | null;
  managerNote?: string | null;
  createdAt?: string | null;
}

const statusOptions: { value: ShiftRequestStatus; label: string }[] = [
  { value: "pending", label: "In behandeling" },
  { value: "approved", label: "Goedgekeurd" },
  { value: "declined", label: "Afgewezen" },
  { value: "cancelled", label: "Ingetrokken" },
  { value: "resolved", label: "Afgerond" },
];

const statusDescriptions: Record<
  ShiftRequestStatus,
  { title: string; description: string }
> = {
  pending: {
    title: "Verzoek opnieuw in behandeling",
    description: "De chatter ziet het verzoek weer als openstaand.",
  },
  approved: {
    title: "Verzoek goedgekeurd",
    description: "Het verzoek is verwerkt en gemarkeerd als goedgekeurd.",
  },
  declined: {
    title: "Verzoek afgewezen",
    description:
      "Het verzoek is geweigerd. Licht de chatter eventueel apart in.",
  },
  cancelled: {
    title: "Verzoek ingetrokken",
    description: "Het verzoek is gesloten zonder verdere actie.",
  },
  resolved: {
    title: "Verzoek afgerond",
    description: "Het verzoek is afgehandeld en gesloten.",
  },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Onbekend";
  try {
    return formatUserDateTime(value, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return value;
  }
};

const renderTypeBadge = (type: ShiftAction) => {
  if (type === "cancel") {
    return (
      <Badge className="bg-red-50 text-red-700" variant="outline">
        <RotateCcw className="mr-1 h-3 w-3" /> Annuleren
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-50 text-blue-700" variant="outline">
      <ArrowLeftRight className="mr-1 h-3 w-3" /> Ruilen
    </Badge>
  );
};

const renderStatusBadge = (status: ShiftRequestStatus) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800" variant="outline">
          Goedgekeurd
        </Badge>
      );
    case "declined":
      return <Badge variant="outline">Afgewezen</Badge>;
    case "cancelled":
      return <Badge variant="outline">Ingetrokken</Badge>;
    case "resolved":
      return <Badge variant="secondary">Afgerond</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary">In behandeling</Badge>;
  }
};

const getChatterDisplayName = (request: Pick<ShiftRequestItem, "chatterName">) => {
  const name = request.chatter.name.trim();
  return name && name.length > 0 ? name : "Onbekende chatter";
};

const formatShiftRange = (request: ShiftRequestItem) => {
  if (!request.shiftStart && !request.shiftEnd) {
    return "Shiftgegevens onbekend";
  }

  const startDate = request.shiftStart ? new Date(request.shiftStart) : null;
  const endDate = request.shiftEnd ? new Date(request.shiftEnd) : null;

  const dayLine = startDate
    ? formatUserDate(startDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;

  const timeLine =
    startDate && endDate
      ? `${formatUserTime(startDate, {
          hour: "2-digit",
          minute: "2-digit",
        })} – ${formatUserTime(endDate, {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : null;

  if (dayLine && timeLine) return `${dayLine}\n${timeLine}`;
  if (dayLine) return dayLine;

  return "Shiftgegevens onbekend";
};

const normalizeShiftRequest = (raw: any): ShiftRequestItem | null => {
  if (!raw) return null;

  const id = raw.id ?? raw.requestId;
  const typeValue = (raw.type ?? raw.action)?.toString().toLowerCase();
  if (!id || (typeValue !== "cancel" && typeValue !== "trade")) return null;

  const type = typeValue as ShiftAction;

  const statusValue = (raw.status ?? "pending").toString().toLowerCase();
  const status: ShiftRequestStatus = [
    "pending",
    "approved",
    "declined",
    "cancelled",
    "resolved",
  ].includes(statusValue)
    ? (statusValue as ShiftRequestStatus)
    : "pending";

  const shift = raw.shift ?? raw.shift_details ?? {};
  const shiftStart =
    shift.startTime ||
    shift.start_time ||
    shift.start ||
    raw.shiftStart ||
    raw.startTime ||
    null;
  const shiftEnd =
    shift.endTime ||
    shift.end_time ||
    shift.end ||
    raw.shiftEnd ||
    raw.endTime ||
    null;

  const chatter = raw.chatter ?? raw.user ?? {};

  const chatterId = String(
    raw.chatterId ?? raw.chatter_id ?? chatter.id ?? chatter.chatterId ?? "",
  );
  if (!chatterId) return null;

  return {
    id: String(id),
    chatter: {
        id: chatter.id,
        name: String(chatter.name ?? chatter.fullName ?? ""),
    },
    shiftId: String(raw.shiftId ?? raw.shift_id ?? shift.id ?? ""),
    shiftStart,
    shiftEnd,
    type,
    status,
    note: raw.note ?? raw.message ?? null,
    managerNote: raw.managerNote ?? raw.response ?? null,
    createdAt:
      raw.createdAt ??
      raw.created_at ??
      raw.updatedAt ??
      raw.updated_at ??
      null,
  };
};

export function ShiftRequestInbox() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [requests, setRequests] = useState<ShiftRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedStatus, setSelectedStatus] =
    useState<ShiftRequestStatus>("pending");
  const [replyNote, setReplyNote] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const loadRequests = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      try {
        const params =
          statusFilter === "pending"
            ? { status: "pending" }
            : { includeResolved: true };
        const data = await api.getShiftRequests(params);
        const normalized = (data || [])
          .map((item: any) => normalizeShiftRequest(item))
          .filter((value): value is ShiftRequestItem => Boolean(value));

        setRequests(normalized);
      } catch (error) {
        console.error("Error loading shift requests:", error);
        toast({
          title: "Kan shiftverzoeken niet laden",
      description: "Please try again later.",
          variant: "destructive",
        });
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [statusFilter, toast],
  );

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [requests]);

  useEffect(() => {
    if (!selectedRequestId) return;

    const stillExists = sortedRequests.some(
      (request) => request.id === selectedRequestId,
    );

    if (!stillExists) {
      setSelectedRequestId(null);
      setIsDialogOpen(false);
    }
  }, [selectedRequestId, sortedRequests]);

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    return sortedRequests.find((request) => request.id === selectedRequestId) ?? null;
  }, [selectedRequestId, sortedRequests]);

  useEffect(() => {
    if (!selectedRequest) {
      setReplyNote("");
      setSelectedStatus("pending");
      return;
    }

    setSelectedStatus(selectedRequest.status);
    setReplyNote(selectedRequest.managerNote ?? "");
  }, [selectedRequest]);

  const handleSave = useCallback(async () => {
    if (!selectedRequest) return;

    const trimmedNote = replyNote.trim();
    const currentNote = selectedRequest.managerNote?.trim() ?? "";

    if (
      selectedRequest.status === selectedStatus &&
      currentNote === trimmedNote
    ) {
      toast({
        title: "Geen wijzigingen",
        description: "Pas de status of notitie aan om op te slaan.",
      });
      return;
    }

    setUpdatingId(selectedRequest.id);
    try {
      await api.updateShiftRequest(selectedRequest.id, {
        status: selectedStatus,
        managerNote: trimmedNote || undefined,
      });

      const message = statusDescriptions[selectedStatus];
      toast({
        title: message.title,
        description: message.description,
      });

      await loadRequests({ silent: true });
    } catch (error) {
      console.error("Error updating shift request:", error);
      toast({
    title: "Update failed",
        description:
      "The status or note could not be saved. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  }, [loadRequests, replyNote, selectedRequest, selectedStatus, toast]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setSelectedRequestId(null);
        }
      }}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Shiftverzoeken
            </CardTitle>
            <CardDescription>
              {statusFilter === "pending"
                ? "Beheer de openstaande verzoeken van chatters."
              : "View all recent shift requests, including resolved items."}
            </CardDescription>
          </div>
          <div className="flex w-full max-w-[240px] flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRequests()}
              disabled={loading}
              className="w-full"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Vernieuwen
            </Button>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value === "all" ? "all" : "pending")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toon" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="pending">Alleen openstaand</SelectItem>
                <SelectItem value="all">Alles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p>
                {statusFilter === "pending"
                  ? "Geen openstaande shiftverzoeken."
                  : "Geen shiftverzoeken gevonden."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Verzoek</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRequests.map((request) => {
                      const isSelected = selectedRequestId === request.id;

                      return (
                        <TableRow
                          key={request.id}
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            setIsDialogOpen(true);
                          }}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            isSelected ? "bg-muted/50" : ""
                          }`}
                        >
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-2">
                              <span className="text-sm font-medium">
                                {getChatterDisplayName(request)}
                              </span>
                              <div>{renderTypeBadge(request.type)}</div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-pre-line align-top text-sm">
                            <div className="font-medium">
                              {formatShiftRange(request)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            {renderStatusBadge(request.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRequest ? (
        <DialogContent className="max-h-[90vh] w-full pt-10 overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="text-left">
                <DialogTitle className="text-xl">
                  {getChatterDisplayName(selectedRequest)}
                </DialogTitle>
                <DialogDescription>
                  Aangemaakt: {formatDateTime(selectedRequest.createdAt)}
                </DialogDescription>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                {renderTypeBadge(selectedRequest.type)}
                {renderStatusBadge(selectedRequest.status)}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Shift
                </h4>
                <p className="whitespace-pre-line text-sm font-medium">
                  {formatShiftRange(selectedRequest)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Shift ID: {selectedRequest.shiftId}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Chatter
                </h4>
                <p className="text-sm font-medium">
                  {getChatterDisplayName(selectedRequest)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID: {selectedRequest.chatter.id}
                </p>
                {selectedRequest.createdAt ? (
                  <p className="text-xs text-muted-foreground">
                    Laatst bijgewerkt: {formatDateTime(selectedRequest.createdAt)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Bericht van chatter</h4>
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                {selectedRequest.note || "Geen bericht toegevoegd."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply-note">Reactie / nieuwe notitie</Label>
              <Textarea
                id="reply-note"
                placeholder="Laat een reactie achter voor de chatter"
                value={replyNote}
                onChange={(event) => setReplyNote(event.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex w-full max-w-[240px] flex-col gap-2">
                <Label className="text-sm text-muted-foreground" htmlFor="status-select">
                  Status
                </Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) =>
                    setSelectedStatus(value as ShiftRequestStatus)
                  }
                >
                  <SelectTrigger id="status-select" className="w-full">
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="sm:justify-end">
                <Button
                  onClick={handleSave}
                  disabled={updatingId === selectedRequest.id}
                >
                  {updatingId === selectedRequest.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

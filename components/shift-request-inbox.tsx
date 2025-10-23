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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Inbox,
  RefreshCcw,
  RotateCcw,
  ArrowLeftRight,
} from "lucide-react";

import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type ShiftAction = "cancel" | "trade";

type ShiftRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "resolved";

type StatusFilter = "pending" | "all";

interface ShiftRequestItem {
  id: string;
  shiftId: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  type: ShiftAction;
  status: ShiftRequestStatus;
  chatterId: string;
  chatterName?: string | null;
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
    return new Date(value).toLocaleString("nl-NL", {
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

const formatShiftRange = (request: ShiftRequestItem) => {
  if (!request.shiftStart && !request.shiftEnd) {
    return "Shiftgegevens onbekend";
  }

  const start = request.shiftStart
    ? new Date(request.shiftStart).toLocaleString("nl-NL", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const end = request.shiftEnd
    ? new Date(request.shiftEnd).toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (start && end) {
    return `${start} – ${end}`;
  }

  if (start) return start;

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
    shiftId: String(raw.shiftId ?? raw.shift_id ?? shift.id ?? ""),
    shiftStart,
    shiftEnd,
    type,
    status,
    chatterId,
    chatterName:
      chatter.full_name ||
      chatter.fullName ||
      raw.chatterName ||
      raw.employeeName ||
      null,
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
          description: "Probeer het later opnieuw.",
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

  const updateStatus = useCallback(
    async (request: ShiftRequestItem, status: ShiftRequestStatus) => {
      if (request.status === status) return;

      setUpdatingId(request.id);
      try {
        await api.updateShiftRequest(request.id, { status });
        const message = statusDescriptions[status];
        toast({
          title: message.title,
          description: message.description,
        });
        await loadRequests({ silent: true });
      } catch (error) {
        console.error("Error updating shift request:", error);
        toast({
          title: "Bijwerken mislukt",
          description:
            "De status kon niet worden opgeslagen. Probeer het opnieuw.",
          variant: "destructive",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [loadRequests, toast],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Shiftverzoeken
          </CardTitle>
          <CardDescription>
            {statusFilter === "pending"
              ? "Beheer de openstaande verzoeken van chatters."
              : "Bekijk alle recente shiftverzoeken, inclusief afgehandelde items."}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value === "all" ? "all" : "pending")
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toon" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="pending">Alleen openstaand</SelectItem>
              <SelectItem value="all">Alles</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRequests()}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Vernieuwen
          </Button>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chatter</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {renderTypeBadge(request.type)}
                          <span>
                            {request.chatterName ||
                              `Chatter ${request.chatterId}`}
                          </span>
                        </div>
                        {request.note ? (
                          <p className="text-xs text-muted-foreground">
                            Bericht: {request.note}
                          </p>
                        ) : null}
                        {request.managerNote ? (
                          <p className="text-xs text-muted-foreground">
                            Manager notitie: {request.managerNote}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {formatShiftRange(request)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Shift ID: {request.shiftId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {renderStatusBadge(request.status)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="text-sm">
                          {formatDateTime(request.createdAt)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === request.id}
                          >
                            Status aanpassen
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              disabled={request.status === option.value}
                              onSelect={(event) => {
                                event.preventDefault();
                                updateStatus(request, option.value);
                              }}
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

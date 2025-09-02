"use client"

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DollarSign, User } from "lucide-react";
import { api } from "@/lib/api";

interface UnlockRow {
  creator: string;
  chatId: string;
  username: string;
  datetime: string;
  price: number;
}

interface Shift {
  id: string;
  chatterId: string;
  startTime: string;
  endTime: string;
}

export function UnlocksByChatter() {
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [unlockRes, shiftsData, chattersData, usersData] = await Promise.all([
          fetch("/api/f2f/unlocks").then((r) => r.json()),
          api.getShifts(),
          api.getChatters(),
          api.getUsers(),
        ]);

        const userMap = new Map((usersData || []).map((u: any) => [String(u.id), u.fullName || ""]));
        const chatterNameMap = new Map(
          (chattersData || []).map((c: any) => [String(c.id), userMap.get(String(c.id)) || ""]),
        );

        const shifts: Shift[] = (shiftsData || []).map((s: any) => ({
          id: String(s.id),
          chatterId: String(s.chatterId),
          startTime: s.startTime,
          endTime: s.endTime,
        }));

        const totalsByChatter: Record<string, number> = {};

        (unlockRes.rows || []).forEach((u: UnlockRow) => {
          const dt = new Date(u.datetime);
          const shift = shifts.find(
            (sh) => dt >= new Date(sh.startTime) && dt <= new Date(sh.endTime),
          );
          if (shift?.chatterId) {
            totalsByChatter[shift.chatterId] = (totalsByChatter[shift.chatterId] || 0) + u.price;
          }
        });

        setTotals(totalsByChatter);
        const nameMap: Record<string, string> = {};
        chatterNameMap.forEach((n, id) => {
          nameMap[id] = n;
        });
        setNames(nameMap);
      } catch (err) {
        console.error("Error loading unlocks", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Unlocks per Chatter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chatter</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(totals).map(([chatterId, amount]) => (
              <TableRow key={chatterId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {names[chatterId] || chatterId}
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {Object.keys(totals).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No unlocks found for the selected period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


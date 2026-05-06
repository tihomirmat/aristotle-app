import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  lost: "bg-red-100 text-red-600 border-red-200",
  reactivated: "bg-violet-100 text-violet-600 border-violet-200",
};

export default function CustomerTable({ customers = [], onSelect, selectedIds = [] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lapsedDays, setLapsedDays] = useState("all");

  const filtered = useMemo(() => {
    const now = new Date();
    return customers.filter((c) => {
      const matchSearch =
        !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search);

      const matchStatus = statusFilter === "all" || c.status === statusFilter;

      let matchLapsed = true;
      if (lapsedDays !== "all" && c.last_visit_date) {
        const days = differenceInDays(now, new Date(c.last_visit_date));
        matchLapsed = days >= parseInt(lapsedDays);
      }

      return matchSearch && matchStatus && matchLapsed;
    });
  }, [customers, search, statusFilter, lapsedDays]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Customer Database
          <Badge variant="secondary" className="ml-2 font-normal">
            {filtered.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="reactivated">Reactivated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={lapsedDays} onValueChange={setLapsedDays}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Last Visit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Visits</SelectItem>
              <SelectItem value="30">30+ days ago</SelectItem>
              <SelectItem value="60">60+ days ago</SelectItem>
              <SelectItem value="90">90+ days ago</SelectItem>
              <SelectItem value="180">180+ days ago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {onSelect && <TableHead className="w-10" />}
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onSelect ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No customers found. Import a CSV to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 50).map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    {onSelect && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => onSelect(c.id)}
                          className="rounded border-border"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                    <TableCell className="text-sm">{c.email || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {c.last_visit_date ? format(new Date(c.last_visit_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[c.status] || statusColors.active} border text-xs`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 50 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Showing 50 of {filtered.length} results
          </p>
        )}
      </CardContent>
    </Card>
  );
}
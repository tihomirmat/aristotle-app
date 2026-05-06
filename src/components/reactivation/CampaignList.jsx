import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import { format } from "date-fns";

const statusBadge = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-blue-100 text-blue-600 border-blue-200",
  sending: "bg-amber-100 text-amber-600 border-amber-200",
  sent: "bg-emerald-100 text-emerald-600 border-emerald-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
};

export default function CampaignList({ campaigns = [] }) {
  if (campaigns.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Campaign Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Sent</TableHead>
                <TableHead className="text-center">Replied</TableHead>
                <TableHead className="text-center">Came Back</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.scheduled_date), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{c.type}</TableCell>
                  <TableCell>
                    <Badge className={`${statusBadge[c.status] || statusBadge.draft} border text-xs`}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{c.sent_count || 0}</TableCell>
                  <TableCell className="text-center text-sm">{c.replied_count || 0}</TableCell>
                  <TableCell className="text-center text-sm">{c.came_back_count || 0}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    ${(c.revenue_recovered || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
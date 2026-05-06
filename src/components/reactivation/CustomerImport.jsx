import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CustomerImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      rows.push(row);
    }
    return rows;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const text = await file.text();
    const rows = parseCSV(text);

    let success = 0;
    let failed = 0;

    const batch = rows.map((row) => ({
      name: row.name || row.full_name || "Unknown",
      phone: row.phone || row.phone_number || "",
      email: row.email || "",
      last_visit_date: row.last_visit_date || row.last_visit || null,
      tags: row.tags ? row.tags.split(";").map((t) => t.trim()) : [],
      status: row.status || "active",
      revenue: parseFloat(row.revenue) || 0,
    }));

    const chunkSize = 25;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      try {
        await base44.entities.Customer.bulkCreate(chunk);
        success += chunk.length;
      } catch {
        failed += chunk.length;
      }
    }

    setResult({ success, failed, total: rows.length });
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    toast({
      title: "Import complete",
      description: `${success} customers imported, ${failed} failed.`,
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Import Customers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
          />
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-sm">Click to upload CSV</p>
          <p className="text-xs text-muted-foreground mt-1">
            Columns: name, phone, email, last_visit_date, tags, status
          </p>
        </div>

        {importing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Importing customers...
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-start gap-3">
            {result.failed === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {result.success} of {result.total} imported successfully
              </p>
              {result.failed > 0 && (
                <p className="text-xs text-muted-foreground">{result.failed} records failed</p>
              )}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          <Upload className="w-4 h-4 mr-2" />
          {importing ? "Importing..." : "Choose File"}
        </Button>
      </CardContent>
    </Card>
  );
}
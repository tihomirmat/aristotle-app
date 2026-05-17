import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { useQueryClient } from "@tanstack/react-query";

export default function CustomerImportModal({ open, onOpenChange }) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
              },
            },
          },
        },
      },
    });
    const rows = extracted?.output?.rows || [];
    let created = 0;
    for (const row of rows) {
      if (!row.name) continue;
      await base44.entities.Lead.create({ ...row, business_id: business.id, source: "import" });
      created++;
    }
    queryClient.invalidateQueries({ queryKey: ["leads", business?.id] });
    setLoading(false);
    setResult(created);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Uvozi stranke iz CSV</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Naložite CSV datoteko s stolpci: <strong>name, email, phone</strong>.</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Uvažam...
            </div>
          ) : result !== null ? (
            <p className="text-sm text-emerald-600 font-medium">✓ Uvoženo {result} strank.</p>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Kliknite za izbiro datoteke</span>
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFile} />
            </label>
          )}
          {result !== null && (
            <Button className="w-full" onClick={() => onOpenChange(false)}>Zapri</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
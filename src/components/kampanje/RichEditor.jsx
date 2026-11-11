import React, { useMemo, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Urejevalnik besedila za e-pošto: krepko, ležeče, podčrtano, povezava, seznam, poravnava, slika (naloži se na strežnik, ne v sporočilo).
// `fields` = gumbi za vstavljanje polj (npr. {ime}).
export const textToHtml = (t) => String(t || "").trim().split(/\n{2,}/).map((b) => `<p>${b.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("");
export const htmlToText = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

export default function RichEditor({ value, onChange, fields = [], minHeight = 160, placeholder }) {
  const ref = useRef(null);
  const modules = useMemo(() => ({
    toolbar: {
      container: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], [{ align: [] }], ["link", "image"], ["clean"]],
      handlers: {
        image: () => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = "image/png,image/jpeg,image/gif,image/webp";
          input.onchange = async () => {
            const file = input.files?.[0]; if (!file) return;
            if (file.size > 3_000_000) { toast.error("Slika je prevelika (največ 3 MB)."); return; }
            const t = toast.loading("Nalagam sliko …");
            try {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              const q = ref.current?.getEditor(); const range = q.getSelection(true);
              q.insertEmbed(range ? range.index : q.getLength(), "image", file_url, "user");
              toast.success("Slika dodana.", { id: t });
            } catch (e) { toast.error("Slike ni bilo mogoče naložiti.", { id: t }); }
          };
          input.click();
        },
      },
    },
    clipboard: { matchVisual: false },
  }), []);
  const insert = (txt) => { const q = ref.current?.getEditor(); if (!q) return; const r = q.getSelection(true); q.insertText(r ? r.index : q.getLength() - 1, txt, "user"); };
  return (
    <div className="rich-editor">
      <style>{`.rich-editor .ql-toolbar{border-radius:10px 10px 0 0;border-color:hsl(var(--border))}.rich-editor .ql-container{border-radius:0 0 10px 10px;border-color:hsl(var(--border));font-family:inherit;font-size:14px}.rich-editor .ql-editor{min-height:${minHeight}px}.rich-editor .ql-editor img{max-width:100%}`}</style>
      <ReactQuill ref={ref} theme="snow" value={value || ""} onChange={(html) => onChange(html === "<p><br></p>" ? "" : html)} modules={modules} placeholder={placeholder} />
      {fields.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <span className="text-[11px] text-muted-foreground">Vstavi:</span>
          {fields.map(([label, token]) => <button key={token} type="button" onClick={() => insert(token)} className="text-[11px] px-2 py-0.5 rounded-full border hover:bg-muted">{label}</button>)}
        </div>
      )}
    </div>
  );
}

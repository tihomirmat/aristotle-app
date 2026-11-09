import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { INDUSTRIES, templateFor } from "@/lib/industries";

// Izbira dejavnosti z iskanjem. Če je ni na seznamu, jo stranka vpiše sama.
// onChange({ industry, industry_template })
export default function IndustryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pick = (label) => { onChange({ industry: label, industry_template: templateFor(label) }); setOpen(false); setQuery(""); };
  const exact = INDUSTRIES.some((i) => i.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full h-11 rounded-md border bg-background px-3 text-left text-sm flex items-center justify-between hover:border-primary/40">
          <span className={value ? "" : "text-muted-foreground"}>{value || "Izberite ali poiščite dejavnost"}</span>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command>
          <CommandInput placeholder="Iščite, npr. frizer, gradbeništvo …" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-72">
            <CommandEmpty>Ni zadetkov.</CommandEmpty>
            {query.trim() && !exact && (
              <CommandGroup>
                <CommandItem value={`__custom ${query}`} onSelect={() => pick(query.trim())}><Plus className="w-4 h-4 mr-2" />Uporabi »{query.trim()}«</CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {INDUSTRIES.map((i) => (
                <CommandItem key={i.label} value={i.label} onSelect={() => pick(i.label)}>
                  <Check className={`w-4 h-4 mr-2 ${value === i.label ? "opacity-100 text-primary" : "opacity-0"}`} />{i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

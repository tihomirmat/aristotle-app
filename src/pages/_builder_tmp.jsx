const RichEditor = React.lazy(() => import("@/components/kampanje/RichEditor"));
const toHtml = (t) => String(t || "").trim().split(/\n{2,}/).map((b) => `<p>${b.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("");
const toText = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
const FIELDS_LIST = [["Ime", "{ime}"], ["Podjetje", "{podjetje}"], ["Spletna stran", "{spletna_stran}"]];

function StepAttachments({ step, onChange, first, isList }) {
  const ref = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const list = step.attachments || [];
  const add = async (files) => {
    const arr = Array.from(files || []); if (!arr.length) return;
    if (list.length + arr.length > 3) { toast.error("Največ 3 priponke na sporočilo."); return; }
    setBusy(true);
    try {
      const out = [...list];
      for (const f of arr) {
        if (f.size > 5_000_000) { toast.error(`${f.name}: največ 5 MB.`); continue; }
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        out.push({ name: f.name, url: file_url });
      }
      onChange(out);
    } catch (e) { toast.error("Priponke ni bilo mogoče naložiti."); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {list.map((a, j) => (
        <span key={a.url} className="text-xs inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1"><Paperclip className="w-3 h-3" />{a.name}<button onClick={() => onChange(list.filter((_, k) => k !== j))} className="text-muted-foreground hover:text-red-600"><X className="w-3 h-3" /></button></span>
      ))}
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}Dodaj priponko</button>
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      {first && isList && list.length > 0 && <span className="text-[11px] text-amber-700 w-full">Priponka v prvem sporočilu neznanim naslovom poveča možnost, da sporočilo pristane med neželeno pošto. Raje jo pošljite v nadaljevanju ali kot povezavo.</span>}
    </div>
  );
}

function Builder({ open, onOpenChange, campaign, leads, lists, contacts, mailboxes, onLaunch, onMailboxesChanged }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [goal, setGoal] = useState("reactivation");
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sigFor, setSigFor] = useState(null);
  const okMailboxes = mailboxes.filter((m) => m.status !== "error");
  const withHtml = (steps) => (steps || []).map((s) => ({ ...s, body_html: s.body_html || toHtml(s.body) }));
  const init = (tpl, g) => {
    const source = tpl.source || "leads";
    return { ...structuredClone(tpl), steps: withHtml(tpl.steps), goal: g, source, list_ids: source === "list" ? lists.map((l) => l.id) : [], mailbox_ids: okMailboxes.map((m) => m.id), auto_send: false };
  };
  React.useEffect(() => {
    if (!open) return;
    if (campaign?.id) { setGoal(campaign.goal); setC({ ...campaign, source: campaign.source || "leads", list_ids: campaign.list_ids || [], mailbox_ids: campaign.mailbox_ids || [], audience: { ...TEMPLATES[campaign.goal]?.audience, ...(campaign.audience || {}) }, steps: withHtml(campaign.steps) }); }
    else { const g = campaign?.goal || "reactivation"; setGoal(g); setC(init(TEMPLATES[g], g)); }
  }, [open, campaign?.id, campaign?.goal]);
  if (!c) return null;

  const isList = c.source === "list";
  const setA = (patch) => setC({ ...c, audience: { ...c.audience, ...patch } });
  const toggleIn = (key, v) => { const arr = c.audience[key] || []; setA({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }); };
  const toggleArr = (key, v) => setC({ ...c, [key]: (c[key] || []).includes(v) ? c[key].filter((x) => x !== v) : [...(c[key] || []), v] });
  const setStep = (i, patch) => setC({ ...c, steps: c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const reach = isList ? listReach(c.list_ids || [], contacts, leads) : leads.filter((l) => matchAudience(l, c.audience)).length;
  const reviewLink = business?.google_review_link ? `: ${business.google_review_link}` : "";
  const selMailboxes = mailboxes.filter((m) => (c.mailbox_ids || []).includes(m.id));
  const perDay = selMailboxes.reduce((s, m) => s + dailyLimit(m), 0);
  const unit = isList ? W.naslov : W.stranka;
  // Izbira naslova: en meni (vsi izmenično / posamezen / glavni naslov pri strankah)
  const mbChoice = !selMailboxes.length ? "__main" : selMailboxes.length > 1 ? "__all" : selMailboxes[0].id;
  const pickMailbox = (v) => setC({ ...c, mailbox_ids: v === "__all" ? okMailboxes.map((m) => m.id) : v === "__main" ? [] : [v] });
  const sigMb = selMailboxes[0] || null;
  const sigHtml = sigMb?.signature_html || (business?.email_signature ? toHtml(business.email_signature) : "");
  const mainAddress = business?.smtp_from_email || business?.imap_user || "vaš glavni naslov";

  const save = async (launch) => {
    const steps = c.steps.map((s) => ({ ...s, text: toText(s.body_html) }));
    if (!c.name?.trim() || !steps.length || steps.some((s) => !String(s.subject || "").trim() || !s.text)) { toast.error("Izpolnite ime ter zadevo in besedilo vsakega sporočila."); return; }
    if (launch && steps.some((s) => PLACEHOLDER.test(s.text) || PLACEHOLDER.test(s.subject))) { toast.error("V besedilu je še oznaka v oglatih oklepajih [ … ]. Zamenjajte jo s svojim besedilom."); return; }
    if (isList && !(c.list_ids || []).length) { toast.error("Izberite vsaj en seznam naslovov."); return; }
    if (isList && !(c.mailbox_ids || []).length) { toast.error("Najprej povežite naslov, s katerega se pošilja."); return; }
    if (launch && selMailboxes.length && !selMailboxes.every((m) => m.signature_html) && !business?.email_signature) { toast.error("Dodajte podpis (gumb »Uredi podpis« pod sporočili)."); return; }
    setSaving(true);
    try {
      const data = {
        name: c.name.trim(), goal, description: CAMPAIGN_GOALS[goal].hint, audience: c.audience, auto_send: isList ? true : !!c.auto_send,
        source: c.source, list_ids: isList ? c.list_ids : [], mailbox_ids: c.mailbox_ids || [],
        steps: steps.map((s, i) => ({ order: i + 1, delay_days: Number(s.delay_days) || 0, subject: s.subject, body: s.text.replace("{povezava}", reviewLink), body_html: String(s.body_html || "").replace("{povezava}", reviewLink), attachments: s.attachments || [], ai_personalize: isList ? false : !!s.ai_personalize })),
      };
      let saved;
      if (campaign?.id) saved = await base44.entities.Campaign.update(campaign.id, data);
      else saved = await base44.entities.Campaign.create({ ...data, business_id: business.id, owner_email: business.owner_email || business.created_by, status: "draft", stats: {} });
      const id = campaign?.id || saved.id;
      if (launch) await onLaunch({ ...saved, ...data, id });
      invalidate(); onOpenChange(false);
      if (!launch) toast.success("Kampanja shranjena.");
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const GoalIcon = GOAL_ICON[goal] || Megaphone;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">{campaign?.id ? "Uredi e-poštno kampanjo" : "Nova e-poštna kampanja"}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5"><GoalIcon className="w-4 h-4 text-primary" />{CAMPAIGN_GOALS[goal]?.label}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-5">
          <div className="space-y-1.5"><Label>Ime kampanje</Label><Input value={c.name || ""} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">1. Komu?</Label><span className="text-sm font-semibold text-primary inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{cnt(reach, unit)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[["list", ListChecks, "Naslovom s seznama", "Uvožen Excel/CSV z e-naslovi"], ["leads", Users, "Vašim strankam", "Iz Stranke, po fazi in viru"]].map(([k, I, l, h]) => (
                <button key={k} disabled={!!campaign?.id && campaign.status !== "draft" && k !== c.source} onClick={() => setC({ ...c, source: k, list_ids: k === "list" && !(c.list_ids || []).length ? lists.map((x) => x.id) : c.list_ids, mailbox_ids: k === "list" && !(c.mailbox_ids || []).length ? okMailboxes.map((m) => m.id) : c.mailbox_ids })} className={`text-left rounded-xl border p-3 disabled:opacity-40 ${c.source === k ? "border-primary ring-2 ring-primary/20 bg-accent/40" : "hover:border-primary/40"}`}>
                  <p className="text-sm font-semibold flex items-center gap-2"><I className="w-4 h-4 text-primary" />{l}</p><p className="text-xs text-muted-foreground mt-0.5">{h}</p>
                </button>
              ))}
            </div>
            {isList ? (
              lists.length === 0 ? <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Še nimate seznama. Zaprite to okno in desno pri »Seznami naslovov« kliknite »Uredi« → »Uvozi seznam«.</p> : (
                <div className="space-y-1.5">
                  {lists.map((l) => { const ok = contacts.filter((x) => x.list_id === l.id && x.status === "ok").length; return (
                    <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={(c.list_ids || []).includes(l.id)} onChange={() => toggleArr("list_ids", l.id)} />{l.name}<span className="text-xs text-muted-foreground">(v redu: {ok})</span></label>
                  ); })}
                  <p className="text-[11px] text-muted-foreground">Ne pišemo naslovom, ki so neveljavni, so se že vrnili, so se odjavili ali so že med vašimi strankami.</p>
                </div>
              )
            ) : (
              <>
                <div><p className="text-xs mb-1.5">Faza</p><div className="flex flex-wrap gap-1.5">{STAGES.map((s) => <button key={s.key} onClick={() => toggleIn("stages", s.key)} className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${c.audience.stages?.includes(s.key) ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</button>)}</div></div>
                <div><p className="text-xs mb-1.5">Vir (prazno = vsi)</p><div className="flex flex-wrap gap-1.5">{Object.entries(SOURCES).map(([k, s]) => <button key={k} onClick={() => toggleIn("sources", k)} className={`text-xs px-2.5 py-1 rounded-full border ${c.audience.sources?.includes(k) ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{s.label}</button>)}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs mb-1.5">Brez stika vsaj (dni)</p><Input type="number" min={0} value={c.audience.inactive_days ?? 0} onChange={(e) => setA({ inactive_days: Number(e.target.value) || 0 })} className="h-8" /></div>
                  <div><p className="text-xs mb-1.5">Vrsta stranke</p>
                    <select className="w-full h-8 rounded-md border bg-background px-2 text-sm" value={c.audience.has_company || "any"} onChange={(e) => setA({ has_company: e.target.value })}>
                      <option value="any">Vse</option><option value="yes">Samo podjetja</option><option value="no">Samo zasebne osebe</option>
                    </select></div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm"><span>Samodejno dodaj tudi nove stranke, ki ustrezajo pogojem</span><Switch checked={!!c.audience.auto_enroll} onCheckedChange={(v) => setA({ auto_enroll: v })} /></label>
              </>
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">2. S katerega naslova se pošilja?</Label>
            {mailboxes.length === 0 ? (
              <p className="text-sm">{isList ? <span className="text-amber-800">Najprej povežite naslov za kampanje: zaprite to okno in desno pri »Naslov za pošiljanje« kliknite »Poveži«.</span> : <>Z vašega glavnega naslova <strong>{mainAddress}</strong>.</>}</p>
            ) : okMailboxes.length === 1 && isList ? (
              <p className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><strong>{okMailboxes[0].email}</strong><span className="text-xs text-muted-foreground">(največ {dailyLimit(okMailboxes[0])} na dan)</span></p>
            ) : (
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={mbChoice} onChange={(e) => pickMailbox(e.target.value)}>
                {okMailboxes.length > 1 && <option value="__all">Z vseh naslovov izmenično ({okMailboxes.length}) — skupaj do {okMailboxes.reduce((s, m) => s + dailyLimit(m), 0)} na dan</option>}
                {okMailboxes.map((m) => <option key={m.id} value={m.id}>{m.email} — do {dailyLimit(m)} na dan</option>)}
                {!isList && <option value="__main">Z glavnega naslova ({mainAddress})</option>}
              </select>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">3. Sekvenca (sporočila po vrsti)</Label>
            {c.steps.map((s, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2 relative">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{i === 0 ? "Pošlji" : "Če ne odgovori, čez"}</span>
                  <Input type="number" min={0} value={s.delay_days} onChange={(e) => setStep(i, { delay_days: e.target.value })} className="h-7 w-16 text-xs" />
                  <span className="text-xs text-muted-foreground">{i === 0 ? "dni po začetku" : "dni"}</span>
                  {c.steps.length > 1 && <button onClick={() => setC({ ...c, steps: c.steps.filter((_, j) => j !== i) })} className="ml-auto text-muted-foreground hover:text-red-600" title="Odstrani sporočilo"><X className="w-4 h-4" /></button>}
                </div>
                <Input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Zadeva" />
                <React.Suspense fallback={<div className="h-44 rounded-lg border animate-pulse" />}>
                  <RichEditor value={s.body_html} onChange={(html) => setStep(i, { body_html: html })} fields={isList ? FIELDS_LIST : []} />
                </React.Suspense>
                {PLACEHOLDER.test(toText(s.body_html)) && <p className="text-xs text-amber-700">Zamenjajte besedilo v oglatih oklepajih [ … ] s svojim.</p>}
                <StepAttachments step={s} first={i === 0} isList={isList} onChange={(attachments) => setStep(i, { attachments })} />
                {!isList && <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!s.ai_personalize} onChange={(e) => setStep(i, { ai_personalize: e.target.checked })} /><Sparkles className="w-3.5 h-3.5 text-primary" />AI prilagodi besedilo vsaki stranki (oblikovanje in slike se pri tem ne ohranijo)</label>}
              </div>
            ))}
            {c.steps.length < 6 && <Button variant="outline" size="sm" onClick={() => setC({ ...c, steps: [...c.steps, { delay_days: 4, subject: "", body_html: "<p>Spoštovani,</p><p><br></p>", attachments: [], ai_personalize: false }] })}><Plus className="w-4 h-4 mr-1" />Dodaj sporočilo</Button>}
            {isList && <p className="text-[11px] text-muted-foreground">»Spoštovani,« zamenjamo z »Pozdravljeni, Ime,«, če ime poznamo. Povezavo za odjavo doda sistem sam.</p>}

            <div className="rounded-xl bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Podpis (doda se na konec vsakega sporočila{selMailboxes.length > 1 ? "; vsak naslov ima svojega" : ""})</p>
                {sigMb ? <Button size="sm" variant="outline" className="h-7" onClick={() => setSigFor(sigMb)}><PenLine className="w-3.5 h-3.5 mr-1.5" />{sigMb.signature_html ? "Uredi podpis" : "Dodaj podpis"}</Button>
                  : <Link to="/nastavitve?tab=glas" className="text-xs text-primary hover:underline">Uredi v Nastavitvah</Link>}
              </div>
              {sigHtml ? <div className="text-sm bg-background rounded-lg border p-3 [&_img]:max-w-[220px] [&_p]:m-0" dangerouslySetInnerHTML={{ __html: sigHtml }} />
                : <p className="text-sm text-amber-800">Podpis še ni nastavljen. Brez podpisa kampanje ne morete zagnati.</p>}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            {isList ? (
              <div><p className="text-sm font-medium">Pošilja se samo</p><p className="text-xs text-muted-foreground mt-0.5">Od ponedeljka do petka med 8. in 17. uro, enakomerno čez dan{perDay ? `, skupaj največ ${perDay} sporočil na dan` : ""}. Če se vrnejo 3 sporočila (naslov ne obstaja) ali več kot 3 %, kampanjo ustavimo in vas obvestimo.</p></div>
            ) : (
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div><p className="text-sm font-medium">Pošlji brez moje odobritve</p><p className="text-xs text-muted-foreground mt-0.5">{c.auto_send ? "Sporočila se pošljejo sama (samo tista, ki jih AI oceni kot dobra)." : "Vsako sporočilo najprej počaka v Stranke → Čaka na vaš odgovor."}</p></div>
                <Switch checked={!!c.auto_send} onCheckedChange={(v) => setC({ ...c, auto_send: v })} />
              </label>
            )}
          </div>

          <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Shrani kot osnutek</Button>
            <Button className="btn-brand flex-1" onClick={() => save(true)} disabled={saving || !reach || (isList && !(c.mailbox_ids || []).length)}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}{campaign?.status === "active" ? "Shrani" : `Zaženi za ${cnt(reach, isList ? ["naslov", "naslova", "naslove", "naslovov"] : ["stranko", "stranki", "stranke", "strank"])}`}</Button>
          </div>
        </div>
        {sigFor && <SignatureDialog mb={sigFor} business={business} open={!!sigFor} onOpenChange={(o) => !o && setSigFor(null)} onSaved={onMailboxesChanged} />}
      </SheetContent>
    </Sheet>
  );
}


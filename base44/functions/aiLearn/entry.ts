import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// Učenje iz popravkov: ko lastnik popravi ali zavrne AI sporočilo (ali označi primer), AI iz razlike
// izlušči splošno pravilo in ga shrani v AiLesson. Ista napaka → obstoječemu pravilu poveča times_seen
// (ne podvaja). generateDraft in chatbotRespond ta pravila vedno upoštevata.

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Grobo merilo spremembe (0..1) — majhni tipkarski popravki niso lekcija.
function changeRatio(a, b) {
  const A = norm(a).split(' '), B = norm(b).split(' ');
  const setA = new Set(A), setB = new Set(B);
  let same = 0; setB.forEach((w) => { if (setA.has(w)) same++; });
  return 1 - same / Math.max(setA.size, setB.size, 1);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole.entities;
    const business = body.business_id ? (await sr.Business.filter({ id: body.business_id }))[0] : null;
    if (!business) return Response.json({ error: 'Podjetje ni najdeno.' });
    if (!internal && !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa.' });

    const kind = body.kind || 'edit';
    const orig = { subject: norm(body.original?.subject), body: String(body.original?.body || '').trim() };
    const fin = { subject: norm(body.final?.subject), body: String(body.final?.body || '').trim() };
    const reason = norm(body.reason).slice(0, 500);
    const owner = business.owner_email || business.created_by;

    // Ročno dodano pravilo: shrani kot je
    if (kind === 'manual') {
      if (!reason) return Response.json({ error: 'Pravilo je prazno.' });
      const l = await sr.AiLesson.create({ business_id: business.id, rule: reason, applies_to: body.applies_to || 'all', source: 'manual', active: true, times_seen: 1, last_seen_at: new Date().toISOString(), owner_email: owner, created_by: owner });
      return Response.json({ success: true, learned: [l.rule] });
    }

    if (kind === 'edit') {
      const ratio = changeRatio(`${orig.subject} ${orig.body}`, `${fin.subject} ${fin.body}`);
      if (ratio < 0.08) return Response.json({ success: true, learned: [], skipped: 'majhen popravek' });
    }
    if (kind === 'skip' && !reason) return Response.json({ success: true, learned: [], skipped: 'brez razloga' });

    const existing = (await sr.AiLesson.filter({ business_id: business.id })).filter((l) => l.active !== false);
    const existingList = existing.map((l) => `[${l.id}] ${l.rule}`).join('\n') || '(še ni pravil)';

    const situation = {
      edit: `AI je napisal ORIGINAL, lastnik ga je pred pošiljanjem popravil v KONČNO različico. Ugotovi, KAJ je lastnik sistematično spremenil (ton, dolžina, nagovor, obljube, cene, podpis, struktura, besede, ki jih ne mara ...).`,
      skip: `Lastnik AI sporočila NI poslal. Razlog lastnika: "${reason}".`,
      bad_example: `Lastnik je sporočilo označil kot SLABO. Razlog: "${reason || 'ni naveden'}".`,
      good_example: `Lastnik je sporočilo označil kot DOBRO. Kaj mu je všeč: "${reason || 'ni navedeno'}". Izlušči le, kar je jasno posebnost tega podjetja (npr. struktura, ton), sicer nič.`,
      chat_correction: `Lastnik je popravil odgovor spletnega klepeta. Razlog/popravek: "${reason}".`,
    }[kind] || '';

    const sys = `Si sistem, ki se uči pisanja za slovensko podjetje "${business.name}". ${situation}
Iz tega izlušči NAJVEČ 2 kratki, splošni pravili (velelnik, slovensko, do 20 besed), ki bodo veljala za VSA prihodnja sporočila tega podjetja.
- Ne zapisuj podatkov o posamezni stranki (imena, datumi, ta konkretni projekt).
- Dejstva o podjetju (npr. "Vzdrževanje je prvo leto vključeno v ceno", "Ne navajaj cen v prvem odgovoru") SO dobra pravila.
- Če je to isto kot obstoječe pravilo, vrni njegov id v "same_as" (ne podvajaj).
- Če ni nič splošnega (le tipkarska napaka ali posebnost te stranke), vrni prazen seznam.
OBSTOJEČA PRAVILA:
${existingList}
Vrni ZGOLJ JSON: {"rules":[{"rule":"...","applies_to":"all|emails|chat","same_as":null}]}`;
    const userMsg = kind === 'edit'
      ? `ORIGINAL:\nZadeva: ${orig.subject}\n${orig.body.slice(0, 3000)}\n\nKONČNO (lastnik):\nZadeva: ${fin.subject}\n${fin.body.slice(0, 3000)}`
      : `SPOROČILO:\nZadeva: ${orig.subject || fin.subject}\n${(orig.body || fin.body).slice(0, 3000)}`;

    const res = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 500, system: sys, messages: [{ role: 'user', content: userMsg }] });
    const raw = (res.content?.[0]?.text || '{}').trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    let parsed = { rules: [] };
    try { parsed = JSON.parse(raw); } catch { parsed = { rules: [] }; }

    const learned = [], reinforced = [];
    const now = new Date().toISOString();
    for (const r of (parsed.rules || []).slice(0, 2)) {
      const rule = norm(r.rule).slice(0, 240);
      if (!rule) continue;
      const same = r.same_as && existing.find((l) => l.id === r.same_as);
      if (same) {
        await sr.AiLesson.update(same.id, { times_seen: (same.times_seen || 1) + 1, last_seen_at: now });
        reinforced.push(same.rule);
      } else {
        await sr.AiLesson.create({ business_id: business.id, rule, applies_to: ['all', 'emails', 'chat'].includes(r.applies_to) ? r.applies_to : 'all', source: kind, evidence: (reason || `${orig.subject} → ${fin.subject}`).slice(0, 300), times_seen: 1, active: true, last_seen_at: now, owner_email: owner, created_by: owner });
        learned.push(rule);
      }
    }

    sr.UsageLog.create({ business_id: business.id, date: now.slice(0, 10), pillar: 'learning', feature: 'ai_learn', model: 'claude-haiku-4-5', input_tokens: res.usage?.input_tokens || 0, output_tokens: res.usage?.output_tokens || 0, cost_eur: ((res.usage?.input_tokens || 0) * 0.92 + (res.usage?.output_tokens || 0) * 4.6) / 1e6, is_demo: false }).catch(() => {});
    return Response.json({ success: true, learned, reinforced });
  } catch (error) {
    return Response.json({ error: 'Učenje ni uspelo: ' + (error?.message || String(error)) });
  }
});

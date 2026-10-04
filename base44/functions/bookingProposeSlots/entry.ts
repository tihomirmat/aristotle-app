import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { freeBusy, listEvents } from '../../shared/googleCalendar.js';

// Predlagaj termine na podlagi Google Koledarja (freeBusy) + booking_* nastavitev.
// Upošteva booking_excluded_keywords (naslovi dogodkov, npr. "Dopust", "Bolniška") in booking_blackout_periods.

const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function formatLabel(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'numeric' });
  const t = (d) => d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${t(s)}–${t(e)}`;
}

// Generira kandidatske termine glede na delovni čas, zasedenost, blokirana obdobja in ključne besede.
function generateSlots(opts) {
  const {
    now, rangeEnd, hoursStart, hoursEnd, daysOfWeek, duration, buffer, minAdvanceH,
    busy, excludedBusy, blackoutPeriods, proposalsCount,
  } = opts;
  const [hStart, mStart] = hoursStart.split(':').map(Number);
  const [hEnd, mEnd] = hoursEnd.split(':').map(Number);
  const slotMs = duration * 60 * 1000;
  const bufferMs = buffer * 60 * 1000;
  const minAdvanceMs = minAdvanceH * 60 * 60 * 1000;
  const allBusy = [...busy, ...excludedBusy];
  const slots = [];
  const cursor = new Date(Math.max(now.getTime() + minAdvanceMs, now.getTime()));

  for (let d = new Date(cursor); d <= rangeEnd && slots.length < proposalsCount; d.setDate(d.getDate() + 1)) {
    const dayKey = DAY_KEYS[d.getDay()];
    if (!daysOfWeek.includes(dayKey)) continue;
    // preveri blackout obdobja
    const inBlackout = (blackoutPeriods || []).some((bp) => {
      if (!bp.start_date || !bp.end_date) return false;
      const bs = new Date(bp.start_date + 'T00:00:00');
      const be = new Date(bp.end_date + 'T23:59:59');
      return d >= bs && d <= be;
    });
    if (inBlackout) continue;

    const dayStart = new Date(d);
    dayStart.setHours(hStart, mStart, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(hEnd, mEnd, 0, 0);

    for (let s = new Date(dayStart); s.getTime() + slotMs <= dayEnd.getTime(); s = new Date(s.getTime() + 30 * 60 * 1000)) {
      const e = new Date(s.getTime() + slotMs);
      if (e > dayEnd) break;
      // preveri zasedenost (z bufferjem)
      const isBusy = allBusy.some((b) => {
        const bs = new Date(b.start).getTime() - bufferMs;
        const be = new Date(b.end).getTime() + bufferMs;
        return overlaps(s, e, new Date(bs), new Date(be));
      });
      if (isBusy) continue;
      slots.push({ start: s.toISOString(), end: e.toISOString(), label: formatLabel(s, e) });
      if (slots.length >= proposalsCount) break;
    }
  }
  return slots;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, service_duration, lead_id, service_requested } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const business = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (!business.google_calendar_connected) {
      return Response.json({ error: 'Google Koledar ni povezan. Povežite ga v Nastavitvah → Termini.', code: 'GCALENDAR_NOT_CONNECTED' }, { status: 400 });
    }
    if (!business.booking_enabled) {
      return Response.json({ error: 'Rezervacije niso aktivirane. Vklopite jih v Nastavitvah → Termini.' }, { status: 400 });
    }

    const duration = service_duration || business.booking_default_duration_minutes || 60;
    const proposalsCount = business.booking_proposals_count || 3;
    const buffer = business.booking_buffer_minutes || 15;
    const minAdvanceH = business.booking_min_advance_hours || 4;
    const maxAdvanceD = business.booking_max_advance_days || 30;
    const hoursStart = business.booking_hours_start || '09:00';
    const hoursEnd = business.booking_hours_end || '17:00';
    const daysOfWeek = business.booking_days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri'];
    const excludedKeywords = business.booking_excluded_keywords || [];
    const blackoutPeriods = business.booking_blackout_periods || [];

    const now = new Date();
    const rangeEnd = new Date(now.getTime() + maxAdvanceD * 24 * 60 * 60 * 1000);

    const [fb, ev] = await Promise.all([
      freeBusy(base44, business, now.toISOString(), rangeEnd.toISOString()),
      excludedKeywords.length > 0
        ? listEvents(base44, business, now.toISOString(), rangeEnd.toISOString())
        : Promise.resolve(null),
    ]);

    if (fb.error) {
      return Response.json({ error: fb.error, code: fb.needsReconnect ? 'GCALENDAR_RECONNECT' : 'GCALENDAR_ERROR' }, { status: 400 });
    }
    if (ev?.error) {
      return Response.json({ error: ev.error, code: ev.needsReconnect ? 'GCALENDAR_RECONNECT' : 'GCALENDAR_ERROR' }, { status: 400 });
    }

    // Dogodki z excluded_keywords v naslovu → obravnavaj kot zasedeno (tudi "transparent" dogodki)
    const excludedBusy = [];
    if (ev?.events) {
      for (const e of ev.events) {
        const summary = (e.summary || '').toLowerCase();
        if (excludedKeywords.some((kw) => summary.includes(String(kw).toLowerCase()))) {
          const start = e.start?.dateTime || e.start?.date;
          const end = e.end?.dateTime || e.end?.date;
          if (start && end) excludedBusy.push({ start, end });
        }
      }
    }

    const slots = generateSlots({
      now, rangeEnd, hoursStart, hoursEnd, daysOfWeek, duration, buffer, minAdvanceH,
      busy: fb.busy || [], excludedBusy, blackoutPeriods, proposalsCount,
    });

    if (slots.length === 0) {
      return Response.json({ error: 'V izbranem obdobju ni prostih terminov. Razširite delovni čas ali skrajšajte rok.', code: 'NO_SLOTS' }, { status: 404 });
    }

    const proposal = await base44.asServiceRole.entities.BookingProposal.create({
      business_id,
      lead_id: lead_id || null,
      proposed_slots: slots.map((s) => ({ start_datetime: s.start, end_datetime: s.end, label: s.label })),
      service_requested: service_requested || null,
      duration_minutes: duration,
      status: 'pending',
      expires_at: new Date(now.getTime() + (business.booking_response_window_hours || 24) * 60 * 60 * 1000).toISOString(),
      created_by: business.created_by,
      owner_email: business.owner_email || business.created_by,
    });

    return Response.json({ success: true, proposal, slots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
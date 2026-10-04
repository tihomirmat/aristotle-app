import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createCalendarEvent } from '../../shared/googleCalendar.js';

// Potrdi termin: ustvari dogodek v Google Koledarju (booking_calendar_id, privzeto "primary"),
// shrani google_event_id na ConfirmedBooking in posodobi BookingProposal.

const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, proposal_id, selected_slot, summary, notes } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });
    if (!proposal_id && !selected_slot) return Response.json({ error: 'proposal_id ali selected_slot je obvezan' }, { status: 400 });

    const business = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (!business.google_calendar_connected) {
      return Response.json({ error: 'Google Koledar ni povezan. Povežite ga v Nastavitvah → Termini.', code: 'GCALENDAR_NOT_CONNECTED' }, { status: 400 });
    }

    let slot = selected_slot;
    let leadId = null;
    let serviceRequested = summary || null;
    let duration = business.booking_default_duration_minutes || 60;

    if (proposal_id) {
      const proposal = (await base44.asServiceRole.entities.BookingProposal.filter({ id: proposal_id }))[0];
      if (!proposal || proposal.business_id !== business_id) {
        return Response.json({ error: 'Predlog termina ni najden' }, { status: 404 });
      }
      if (proposal.status !== 'pending') {
        return Response.json({ error: 'Predlog termina je že obravnavan' }, { status: 400 });
      }
      slot = slot || proposal.selected_slot || proposal.proposed_slots?.[0];
      leadId = proposal.lead_id;
      serviceRequested = serviceRequested || proposal.service_requested || 'Termin';
      duration = proposal.duration_minutes || duration;
    }

    if (!slot || !slot.start_datetime || !slot.end_datetime) {
      return Response.json({ error: 'Manjka izbran termin (start_datetime, end_datetime)' }, { status: 400 });
    }

    const event = {
      summary: serviceRequested,
      description: notes || '',
      start: { dateTime: slot.start_datetime, timeZone: 'Europe/Ljubljana' },
      end: { dateTime: slot.end_datetime, timeZone: 'Europe/Ljubljana' },
    };

    const created = await createCalendarEvent(base44, business, event);
    if (created.error) {
      return Response.json({ error: created.error, code: created.needsReconnect ? 'GCALENDAR_RECONNECT' : 'GCALENDAR_ERROR' }, { status: 400 });
    }

    const booking = await base44.asServiceRole.entities.ConfirmedBooking.create({
      business_id,
      lead_id: leadId,
      booking_proposal_id: proposal_id || null,
      booked_at: slot.start_datetime,
      duration_minutes: duration,
      google_event_id: created.id,
      notes: notes || serviceRequested,
      status: 'confirmed',
      created_by: business.created_by,
      owner_email: business.owner_email || business.created_by,
    });

    if (proposal_id) {
      await base44.asServiceRole.entities.BookingProposal.update(proposal_id, {
        status: 'accepted',
        selected_slot: slot,
        lead_response_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, booking, event_id: created.id, html_link: created.htmlLink });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
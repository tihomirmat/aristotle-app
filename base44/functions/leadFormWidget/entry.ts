// Serves the embeddable lead form widget as a JavaScript file
// GET /leadFormWidget?business_id=XXX
// Also works via: <script src="..." data-business-id="XXX" data-color="#hex" defer></script>

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const qsBusinessId = url.searchParams.get("business_id") || "";

  // Use APP_URL if set, otherwise derive from request host
  const appBaseUrl = Deno.env.get("APP_URL") || (url.protocol + "//" + url.host);
  const configEndpoint = appBaseUrl + "/api/functions/getLeadFormConfig";
  const submitEndpoint = appBaseUrl + "/api/functions/leadWebhook";

  // Build the widget JS as plain string concatenation — NO template literals
  // so Deno never tries to interpolate embedded JS expressions.
  var js = "(function() {\n";
  js += "  'use strict';\n";
  js += "  var CONFIG_URL = '" + configEndpoint + "';\n";
  js += "  var SUBMIT_URL = '" + submitEndpoint + "';\n";
  js += "  var QS_BUSINESS_ID = '" + qsBusinessId.replace(/'/g, "") + "';\n";
  js += "\n";
  js += "  // Prefer data-business-id on the script tag, fallback to query-string value baked in\n";
  js += "  var scriptTag = document.currentScript;\n";
  js += "  var businessId = (scriptTag && scriptTag.dataset.businessId) || QS_BUSINESS_ID;\n";
  js += "  var colorOverride = scriptTag && scriptTag.dataset.color;\n";
  js += "\n";
  js += "  if (!businessId) {\n";
  js += "    console.error('[Aristotle widget] Missing business_id. Set data-business-id on the script tag or pass ?business_id= in the URL.');\n";
  js += "    return;\n";
  js += "  }\n";
  js += "\n";
  js += "  var container = document.getElementById('aristotle-lead-form');\n";
  js += "  if (!container) {\n";
  js += "    console.warn('[Aristotle widget] No <div id=\"aristotle-lead-form\"> found on page.');\n";
  js += "    return;\n";
  js += "  }\n";
  js += "\n";
  js += "  function hexToRgb(hex) {\n";
  js += "    if (!hex || hex.length < 7) return '16,185,129';\n";
  js += "    return parseInt(hex.slice(1,3),16) + ',' + parseInt(hex.slice(3,5),16) + ',' + parseInt(hex.slice(5,7),16);\n";
  js += "  }\n";
  js += "\n";
  js += "  function escHtml(s) {\n";
  js += "    if (!s) return '';\n";
  js += "    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');\n";
  js += "  }\n";
  js += "\n";
  js += "  function renderForm(config) {\n";
  js += "    var primaryColor = colorOverride || config.lead_form_primary_color || '#10b981';\n";
  js += "    var rgb = hexToRgb(primaryColor);\n";
  js += "\n";
  js += "    var css = '#alf-wrap{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#fff;border-radius:12px;padding:24px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e5e7eb;box-sizing:border-box}';\n";
  js += "    css += '#alf-wrap *{box-sizing:border-box}';\n";
  js += "    css += '#alf-wrap h2{margin:0 0 16px;font-size:1.2rem;font-weight:700;color:#111827}';\n";
  js += "    css += '#alf-wrap .alf-field{margin-bottom:14px}';\n";
  js += "    css += '#alf-wrap .alf-label{display:block;font-size:0.8125rem;font-weight:500;color:#374151;margin-bottom:5px}';\n";
  js += "    css += '#alf-wrap .alf-input{display:block;width:100%;padding:9px 12px;font-size:0.9375rem;border:1.5px solid #d1d5db;border-radius:8px;outline:none;color:#111827;background:#fff;transition:border-color .15s,box-shadow .15s}';\n";
  js += "    css += '#alf-wrap .alf-input:focus{border-color:' + primaryColor + ';box-shadow:0 0 0 3px rgba(' + rgb + ',0.15)}';\n";
  js += "    css += '#alf-wrap .alf-input::placeholder{color:#9ca3af}';\n";
  js += "    css += '#alf-wrap textarea.alf-input{resize:vertical;min-height:80px}';\n";
  js += "    css += '#alf-wrap .alf-consent{display:flex;align-items:flex-start;gap:8px;margin-bottom:16px}';\n";
  js += "    css += '#alf-wrap .alf-consent input[type=checkbox]{margin-top:3px;width:15px;height:15px;accent-color:' + primaryColor + ';flex-shrink:0}';\n";
  js += "    css += '#alf-wrap .alf-consent label{font-size:0.8125rem;color:#6b7280;line-height:1.4;cursor:pointer}';\n";
  js += "    css += '#alf-wrap .alf-btn{display:block;width:100%;padding:11px 16px;background:' + primaryColor + ';color:#fff;font-size:0.9375rem;font-weight:600;border:none;border-radius:8px;cursor:pointer;transition:opacity .15s}';\n";
  js += "    css += '#alf-wrap .alf-btn:hover{opacity:0.88}';\n";
  js += "    css += '#alf-wrap .alf-btn:disabled{opacity:0.55;cursor:not-allowed}';\n";
  js += "    css += '#alf-wrap .alf-error{font-size:0.8125rem;color:#dc2626;margin-top:-8px;margin-bottom:10px}';\n";
  js += "    css += '#alf-wrap .alf-success{text-align:center;padding:20px 0}';\n";
  js += "    css += '#alf-wrap .alf-success .alf-check{width:48px;height:48px;border-radius:50%;background:rgba(' + rgb + ',0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 12px}';\n";
  js += "    css += '#alf-wrap .alf-success p{margin:0;font-size:1rem;font-weight:600;color:#111827}';\n";
  js += "\n";
  js += "    var styleEl = document.createElement('style');\n";
  js += "    styleEl.textContent = css;\n";
  js += "    document.head.appendChild(styleEl);\n";
  js += "\n";
  js += "    var h = '<div id=\"alf-wrap\">';\n";
  js += "    h += '<h2>' + escHtml(config.lead_form_title) + '</h2>';\n";
  js += "    h += '<form id=\"alf-form\" novalidate>';\n";
  js += "    h += '<div class=\"alf-field\"><label class=\"alf-label\" for=\"alf-name\">Ime in priimek <span style=\"color:#ef4444\">*</span></label>';\n";
  js += "    h += '<input class=\"alf-input\" id=\"alf-name\" type=\"text\" placeholder=\"Janez Novak\" autocomplete=\"name\"></div>';\n";
  js += "    h += '<div class=\"alf-field\"><label class=\"alf-label\" for=\"alf-email\">E-pošta <span style=\"color:#ef4444\">*</span></label>';\n";
  js += "    h += '<input class=\"alf-input\" id=\"alf-email\" type=\"email\" placeholder=\"janez@primer.si\" autocomplete=\"email\"></div>';\n";
  js += "    if (config.lead_form_show_phone) {\n";
  js += "      h += '<div class=\"alf-field\"><label class=\"alf-label\" for=\"alf-phone\">Telefon</label>';\n";
  js += "      h += '<input class=\"alf-input\" id=\"alf-phone\" type=\"tel\" placeholder=\"+386 40 123 456\" autocomplete=\"tel\"></div>';\n";
  js += "    }\n";
  js += "    if (config.lead_form_show_service) {\n";
  js += "      h += '<div class=\"alf-field\"><label class=\"alf-label\" for=\"alf-message\">Sporočilo / storitev</label>';\n";
  js += "      h += '<textarea class=\"alf-input\" id=\"alf-message\" rows=\"3\" placeholder=\"Opišite povpraševanje...\"></textarea></div>';\n";
  js += "    }\n";
  js += "    if (config.lead_form_consent_text) {\n";
  js += "      h += '<div class=\"alf-consent\"><input type=\"checkbox\" id=\"alf-consent\"><label for=\"alf-consent\">' + escHtml(config.lead_form_consent_text) + '</label></div>';\n";
  js += "    }\n";
  js += "    h += '<div id=\"alf-error\" class=\"alf-error\" style=\"display:none\"></div>';\n";
  js += "    h += '<button type=\"submit\" class=\"alf-btn\" id=\"alf-submit\">' + escHtml(config.lead_form_button_text) + '</button>';\n";
  js += "    h += '</form></div>';\n";
  js += "    container.innerHTML = h;\n";
  js += "\n";
  js += "    var btnText = config.lead_form_button_text;\n";
  js += "    var successMsg = config.lead_form_success_message;\n";
  js += "\n";
  js += "    document.getElementById('alf-form').addEventListener('submit', function(e) {\n";
  js += "      e.preventDefault();\n";
  js += "      var errEl = document.getElementById('alf-error');\n";
  js += "      errEl.style.display = 'none';\n";
  js += "      var nameVal = document.getElementById('alf-name').value.trim();\n";
  js += "      var emailVal = document.getElementById('alf-email').value.trim();\n";
  js += "      var phoneEl = document.getElementById('alf-phone');\n";
  js += "      var msgEl = document.getElementById('alf-message');\n";
  js += "      var consentEl = document.getElementById('alf-consent');\n";
  js += "      if (!nameVal) { errEl.textContent = 'Ime je obvezno.'; errEl.style.display = 'block'; return; }\n";
  js += "      if (!emailVal || emailVal.indexOf('@') < 1) { errEl.textContent = 'Vnesite veljaven e-poštni naslov.'; errEl.style.display = 'block'; return; }\n";
  js += "      var btn = document.getElementById('alf-submit');\n";
  js += "      btn.disabled = true; btn.textContent = '...';\n";
  js += "      var payload = { business_id: businessId, name: nameVal, email: emailVal, source: 'form', consent_email: consentEl ? consentEl.checked : true };\n";
  js += "      if (phoneEl) payload.phone = phoneEl.value.trim();\n";
  js += "      if (msgEl) payload.message = msgEl.value.trim();\n";
  js += "      fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })\n";
  js += "        .then(function(r) { return r.json(); })\n";
  js += "        .then(function(d) {\n";
  js += "          if (d.error) { errEl.textContent = d.error; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = btnText; return; }\n";
  js += "          document.getElementById('alf-wrap').innerHTML = '<div class=\"alf-success\"><div class=\"alf-check\"><svg width=\"24\" height=\"24\" fill=\"none\" stroke=\"' + primaryColor + '\" stroke-width=\"2.5\" viewBox=\"0 0 24 24\"><polyline points=\"20 6 9 17 4 12\"/></svg></div><p>' + escHtml(successMsg) + '</p></div>';\n";
  js += "        })\n";
  js += "        .catch(function() { errEl.textContent = 'Prišlo je do napake. Poskusite znova.'; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = btnText; });\n";
  js += "    });\n";
  js += "  }\n";
  js += "\n";
  js += "  fetch(CONFIG_URL + '?business_id=' + encodeURIComponent(businessId))\n";
  js += "    .then(function(r) { return r.json(); })\n";
  js += "    .then(function(config) { renderForm(config); })\n";
  js += "    .catch(function(err) { console.error('[Aristotle widget] Failed to load config:', err); container.innerHTML = '<p style=\"color:#6b7280;font-size:0.875rem\">Obrazec trenutno ni na voljo.</p>'; });\n";
  js += "})();\n";

  return new Response(js, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
// Serves the embeddable lead form widget as a JS file
// GET /leadFormWidget
// Usage: <script src="https://aristotle-smart-growth.base44.app/leadFormWidget" data-business-id="XXX" data-color="#hex" defer></script>

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const appBaseUrl = Deno.env.get("APP_URL") || "https://aristotle-smart-growth.base44.app";
  const configEndpoint = `${appBaseUrl}/api/functions/getLeadFormConfig`;
  const submitEndpoint = `${appBaseUrl}/api/functions/leadWebhook`;

  const widgetJs = `
(function() {
  'use strict';

  var CONFIG_URL = '${configEndpoint}';
  var SUBMIT_URL = '${submitEndpoint}';

  // Find our own script tag
  var scripts = document.querySelectorAll('script[data-business-id]');
  var scriptTag = scripts[scripts.length - 1];
  if (!scriptTag) return;

  var businessId = scriptTag.getAttribute('data-business-id');
  var colorOverride = scriptTag.getAttribute('data-color');
  if (!businessId) return;

  // Find the container
  var container = document.getElementById('aristotle-lead-form');
  if (!container) return;

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }

  function renderForm(config) {
    var primaryColor = colorOverride || config.lead_form_primary_color || '#10b981';
    var rgbColor = hexToRgb(primaryColor) || '16,185,129';

    var css = [
      '#alf-wrap *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '#alf-wrap{background:#fff;border-radius:12px;padding:24px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e5e7eb}',
      '#alf-wrap h2{margin:0 0 4px;font-size:1.25rem;font-weight:700;color:#111827}',
      '#alf-wrap .alf-subtitle{margin:0 0 20px;font-size:0.875rem;color:#6b7280}',
      '#alf-wrap .alf-field{margin-bottom:14px}',
      '#alf-wrap .alf-label{display:block;font-size:0.8125rem;font-weight:500;color:#374151;margin-bottom:5px}',
      '#alf-wrap .alf-input{display:block;width:100%;padding:9px 12px;font-size:0.9375rem;border:1.5px solid #d1d5db;border-radius:8px;outline:none;transition:border-color .15s,box-shadow .15s;color:#111827;background:#fff}',
      '#alf-wrap .alf-input:focus{border-color:' + primaryColor + ';box-shadow:0 0 0 3px rgba(' + rgbColor + ',0.15)}',
      '#alf-wrap .alf-input::placeholder{color:#9ca3af}',
      '#alf-wrap .alf-consent{display:flex;align-items:flex-start;gap:8px;margin-bottom:16px}',
      '#alf-wrap .alf-consent input[type=checkbox]{margin-top:3px;width:15px;height:15px;accent-color:' + primaryColor + ';flex-shrink:0}',
      '#alf-wrap .alf-consent label{font-size:0.8125rem;color:#6b7280;line-height:1.4;cursor:pointer}',
      '#alf-wrap .alf-btn{display:block;width:100%;padding:11px 16px;background:' + primaryColor + ';color:#fff;font-size:0.9375rem;font-weight:600;border:none;border-radius:8px;cursor:pointer;transition:opacity .15s,transform .1s;letter-spacing:0.01em}',
      '#alf-wrap .alf-btn:hover{opacity:0.9}',
      '#alf-wrap .alf-btn:active{transform:scale(0.98)}',
      '#alf-wrap .alf-btn:disabled{opacity:0.6;cursor:not-allowed}',
      '#alf-wrap .alf-success{text-align:center;padding:28px 16px}',
      '#alf-wrap .alf-success .alf-check{width:48px;height:48px;border-radius:50%;background:rgba(' + rgbColor + ',0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 12px}',
      '#alf-wrap .alf-success .alf-check svg{display:block}',
      '#alf-wrap .alf-success p{margin:0;font-size:1rem;font-weight:600;color:#111827}',
      '#alf-wrap .alf-error{font-size:0.8125rem;color:#dc2626;margin-top:6px}',
    ].join('\\n');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var html = '<div id="alf-wrap">';
    html += '<h2>' + escHtml(config.lead_form_title) + '</h2>';
    html += '<form id="alf-form" novalidate>';

    html += '<div class="alf-field"><label class="alf-label" for="alf-name">Ime in priimek <span style="color:#ef4444">*</span></label>';
    html += '<input class="alf-input" id="alf-name" type="text" name="name" placeholder="Janez Novak" required autocomplete="name"></div>';

    html += '<div class="alf-field"><label class="alf-label" for="alf-email">E-pošta <span style="color:#ef4444">*</span></label>';
    html += '<input class="alf-input" id="alf-email" type="email" name="email" placeholder="janez@primer.si" required autocomplete="email"></div>';

    if (config.lead_form_show_phone) {
      html += '<div class="alf-field"><label class="alf-label" for="alf-phone">Telefon</label>';
      html += '<input class="alf-input" id="alf-phone" type="tel" name="phone" placeholder="+386 40 123 456" autocomplete="tel"></div>';
    }

    if (config.lead_form_show_service) {
      html += '<div class="alf-field"><label class="alf-label" for="alf-message">Sporočilo / storitev</label>';
      html += '<textarea class="alf-input" id="alf-message" name="message" placeholder="Opišite povpraševanje..." rows="3" style="resize:vertical"></textarea></div>';
    }

    if (config.lead_form_consent_text) {
      html += '<div class="alf-consent"><input type="checkbox" id="alf-consent" name="consent"><label for="alf-consent">' + escHtml(config.lead_form_consent_text) + '</label></div>';
    }

    html += '<div id="alf-form-error" class="alf-error" style="display:none"></div>';
    html += '<button type="submit" class="alf-btn" id="alf-submit">' + escHtml(config.lead_form_button_text) + '</button>';
    html += '</form></div>';

    container.innerHTML = html;

    var form = document.getElementById('alf-form');
    var submitBtn = document.getElementById('alf-submit');
    var errorEl = document.getElementById('alf-form-error');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      errorEl.style.display = 'none';

      var nameVal = document.getElementById('alf-name').value.trim();
      var emailVal = document.getElementById('alf-email').value.trim();
      var phoneEl = document.getElementById('alf-phone');
      var messageEl = document.getElementById('alf-message');
      var consentEl = document.getElementById('alf-consent');

      if (!nameVal) { showError('Ime je obvezno.'); return; }
      if (!emailVal || !emailVal.includes('@')) { showError('Vnesite veljaven e-poštni naslov.'); return; }

      var payload = {
        business_id: businessId,
        name: nameVal,
        email: emailVal,
        source: 'form',
        consent_email: consentEl ? consentEl.checked : true,
      };
      if (phoneEl) payload.phone = phoneEl.value.trim();
      if (messageEl) payload.message = messageEl.value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = '…';

      fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) { showError(data.error); submitBtn.disabled = false; submitBtn.textContent = '${config.lead_form_button_text}'; return; }
        showSuccess(config.lead_form_success_message, primaryColor, rgbColor);
      })
      .catch(function() {
        showError('Prišlo je do napake. Prosimo, poskusite znova.');
        submitBtn.disabled = false;
      });
    });

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }

    function showSuccess(msg, color, rgb) {
      document.getElementById('alf-wrap').innerHTML =
        '<div class="alf-success">' +
        '<div class="alf-check"><svg width="24" height="24" fill="none" stroke="' + color + '" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>' +
        '<p>' + escHtml(msg) + '</p>' +
        '</div>';
    }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Fetch config then render
  fetch(CONFIG_URL + '?business_id=' + encodeURIComponent(businessId))
    .then(function(r) { return r.json(); })
    .then(function(config) { renderForm(config); })
    .catch(function() {
      container.innerHTML = '<p style="color:#6b7280;font-size:0.875rem">Obrazec trenutno ni na voljo.</p>';
    });
})();
`;

  return new Response(widgetJs, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
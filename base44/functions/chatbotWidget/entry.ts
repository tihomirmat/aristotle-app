// Serves the embeddable chatbot widget as a JavaScript file.
// GET /api/functions/chatbotWidget  (optionally ?business_id=XXX)
// Usage on a customer's site:
//   <script>window.ARISTOTLE_CONFIG = { businessId: "...", primaryColor: "#10b981", title: "...", welcomeMessage: "...", position: "bottom-right" };</script>
//   <script src="https://aristotle-smart-growth.base44.app/api/functions/chatbotWidget" defer></script>
// The widget talks to the public backend function `chatbotRespond` (CORS enabled).

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const qsBusinessId = (url.searchParams.get("business_id") || "").replace(/[^a-zA-Z0-9]/g, "");

  // Plain string concatenation (no template literals) so nothing gets interpolated server-side.
  var js = "(function(){\n";
  js += "  'use strict';\n";
  js += "  if (window.__aristotleChatLoaded) return; window.__aristotleChatLoaded = true;\n";
  js += "  var s = document.currentScript;\n";
  js += "  var BASE_URL = (s && s.src) ? (function(){ var u = new URL(s.src); return u.protocol + '//' + u.host; })() : 'https://aristotle-smart-growth.base44.app';\n";
  js += "  var API_URL = BASE_URL + '/api/functions/chatbotRespond';\n";
  js += "  var cfg = window.ARISTOTLE_CONFIG || {};\n";
  js += "  var businessId = cfg.businessId || (s && s.dataset.businessId) || '" + qsBusinessId + "';\n";
  js += "  if (!businessId) { console.error('[Aristotle chat] Missing businessId in window.ARISTOTLE_CONFIG.'); return; }\n";
  js += "  var color = cfg.primaryColor || '#10b981';\n";
  js += "  var title = cfg.title || 'Pomočnik';\n";
  js += "  var welcome = cfg.welcomeMessage || 'Pozdravljeni! Kako vam lahko pomagam?';\n";
  js += "  var left = (cfg.position === 'bottom-left');\n";
  js += "  var storeKey = 'aristotle_chat_' + businessId;\n";
  js += "  var state = { open: false, conversationId: null, visitorId: null, busy: false };\n";
  js += "  try { var saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); state.conversationId = saved.conversationId || null; state.visitorId = saved.visitorId || null; } catch (e) {}\n";
  js += "  if (!state.visitorId) { state.visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }\n";
  js += "  function persist(){ try { localStorage.setItem(storeKey, JSON.stringify({ conversationId: state.conversationId, visitorId: state.visitorId })); } catch (e) {} }\n";
  js += "  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }\n";
  js += "\n";
  js += "  var css = '';\n";
  js += "  css += '#ar-chat-btn{position:fixed;bottom:20px;" + "'+(left?'left':'right')+'" + ":20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:'+color+';box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:2147483000;display:flex;align-items:center;justify-content:center}';\n";
  js += "  css += '#ar-chat-btn svg{width:26px;height:26px;fill:#fff}';\n";
  js += "  css += '#ar-chat-box{position:fixed;bottom:88px;" + "'+(left?'left':'right')+'" + ":20px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 110px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.22);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;color:#111}';\n";
  js += "  css += '#ar-chat-box.open{display:flex}';\n";
  js += "  css += '#ar-chat-head{background:'+color+';color:#fff;padding:14px 16px;font-weight:600;display:flex;align-items:center;justify-content:space-between}';\n";
  js += "  css += '#ar-chat-close{background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1}';\n";
  js += "  css += '#ar-chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}';\n";
  js += "  css += '.ar-m{max-width:82%;padding:9px 12px;border-radius:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}';\n";
  js += "  css += '.ar-m.u{align-self:flex-end;background:'+color+';color:#fff;border-bottom-right-radius:4px}';\n";
  js += "  css += '.ar-m.a{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px}';\n";
  js += "  css += '#ar-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}';\n";
  js += "  css += '#ar-chat-in{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}';\n";
  js += "  css += '#ar-chat-in:focus{border-color:'+color+'}';\n";
  js += "  css += '#ar-chat-send{border:0;border-radius:10px;padding:0 14px;background:'+color+';color:#fff;font-weight:600;cursor:pointer}';\n";
  js += "  css += '#ar-chat-send:disabled{opacity:.6;cursor:default}';\n";
  js += "  css += '#ar-chat-foot{font-size:11px;color:#94a3b8;text-align:center;padding:4px 0 8px;background:#fff}';\n";
  js += "  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);\n";
  js += "\n";
  js += "  var btn = document.createElement('button'); btn.id = 'ar-chat-btn'; btn.setAttribute('aria-label', 'Odpri klepet');\n";
  js += "  btn.innerHTML = '<svg viewBox=\"0 0 24 24\"><path d=\"M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z\"/></svg>';\n";
  js += "  var box = document.createElement('div'); box.id = 'ar-chat-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', esc(title));\n";
  js += "  box.innerHTML = '<div id=\"ar-chat-head\"><span>' + esc(title) + '</span><button id=\"ar-chat-close\" aria-label=\"Zapri\">&times;</button></div>'\n";
  js += "    + '<div id=\"ar-chat-msgs\"></div>'\n";
  js += "    + '<form id=\"ar-chat-form\"><input id=\"ar-chat-in\" type=\"text\" maxlength=\"1000\" placeholder=\"Napišite sporočilo …\" autocomplete=\"off\" /><button id=\"ar-chat-send\" type=\"submit\">Pošlji</button></form>'\n";
  js += "    + '<div id=\"ar-chat-foot\">Pomočnik AI Aristotle</div>';\n";
  js += "  document.body.appendChild(btn); document.body.appendChild(box);\n";
  js += "  var msgs = box.querySelector('#ar-chat-msgs'); var form = box.querySelector('#ar-chat-form'); var input = box.querySelector('#ar-chat-in'); var send = box.querySelector('#ar-chat-send');\n";
  js += "  function add(role, text){ var d = document.createElement('div'); d.className = 'ar-m ' + (role === 'user' ? 'u' : 'a'); d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }\n";
  js += "  add('assistant', welcome);\n";
  js += "  function toggle(open){ state.open = open; box.classList.toggle('open', open); if (open) setTimeout(function(){ input.focus(); }, 50); }\n";
  js += "  btn.addEventListener('click', function(){ toggle(!state.open); });\n";
  js += "  box.querySelector('#ar-chat-close').addEventListener('click', function(){ toggle(false); });\n";
  js += "  form.addEventListener('submit', function(e){\n";
  js += "    e.preventDefault(); var text = input.value.trim(); if (!text || state.busy) return;\n";
  js += "    add('user', text); input.value = ''; state.busy = true; send.disabled = true;\n";
  js += "    var typing = add('assistant', '…');\n";
  js += "    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id: businessId, visitor_id: state.visitorId, conversation_id: state.conversationId, message: text }) })\n";
  js += "      .then(function(r){ return r.json(); })\n";
  js += "      .then(function(d){ if (d && d.conversation_id) { state.conversationId = d.conversation_id; persist(); } typing.textContent = (d && d.response) || (d && d.error) || 'Oprostite, prišlo je do napake.'; })\n";
  js += "      .catch(function(){ typing.textContent = 'Oprostite, povezava ni uspela. Poskusite znova.'; })\n";
  js += "      .then(function(){ state.busy = false; send.disabled = false; input.focus(); msgs.scrollTop = msgs.scrollHeight; });\n";
  js += "  });\n";
  js += "})();\n";

  return new Response(js, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});

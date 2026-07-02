import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, text_content, file_url, file_type } = body;

    if (!business_id || !text_content) {
      return Response.json({ error: 'Manjkajoči parametri: business_id, text_content' }, { status: 400 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    const systemPrompt = `Ti si strokovnjak za analizo poslovnih ponudb v slovenščini.
Analiziraj vsebino ponudbe in vrni strukturiran predlog za template.
IZHOD JSON (brez markdown ograj):
{
  "detected_kind": "service|product|saas|custom",
  "template_name": "Ime template-a v slovenščini",
  "sections": [
    { "title": "Naslov sekcije", "body_template": "Vsebina z {{var_name}} spremenljivkami", "vars_used": ["var_name"] }
  ],
  "suggested_variables": [
    {
      "key": "var_key",
      "label": "Oznaka v slovenščini",
      "type": "text|number|currency|date|email|phone|textarea|select|table",
      "required": true,
      "placeholder": "Primer vrednosti",
      "default": "",
      "options": [],
      "table_columns": []
    }
  ],
  "improvement_notes": "Opažanja o obstoječi ponudbi"
}`;

    const userMsg = `Analiziraj to ponudbo in ustvari template:\n\n${text_content.substring(0, 8000)}`;

    // Try best model first, fall back if the platform doesn't support it
    const MODELS = ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    let response = null, usedModel = MODELS[0], lastErr = null;
    for (const m of MODELS) {
      try {
        response = await anthropic.messages.create({
          model: m,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        });
        usedModel = m;
        break;
      } catch (e) {
        lastErr = e;
        if (!/model|not_found|invalid/i.test(e.message)) throw e;
      }
    }
    if (!response) throw lastErr || new Error('LLM klic ni uspel');

    const rawText = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    let result = {};
    try { result = JSON.parse(rawText); } catch {
      result = { detected_kind: 'service', template_name: 'Nova ponudba', sections: [], suggested_variables: [], improvement_notes: '' };
    }

    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;
    const costEur = (tokensIn * 0.000015) + (tokensOut * 0.000075);

    const today = new Date().toISOString().split('T')[0];
    await base44.asServiceRole.entities.UsageLog.create({
      business_id,
      date: today,
      pillar: 'offers',
      feature: 'offers',
      subfeature: 'scan',
      model: usedModel,
      input_tokens: tokensIn,
      output_tokens: tokensOut,
      cost_eur: costEur,
      is_demo: false,
      created_by: business.created_by,
    });

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
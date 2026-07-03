import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// TEMPORARY diagnostic function — remove after debugging.
// Reports whether the platform Anthropic key is configured and which model responds.

Deno.serve(async (_req) => {
  const hasKey = !!Deno.env.get('ANTHROPIC_API_KEY');
  const results: Record<string, string> = {};
  if (hasKey) {
    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    for (const m of ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5']) {
      try {
        await client.messages.create({ model: m, max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] });
        results[m] = 'ok';
      } catch (e) {
        results[m] = 'ERR: ' + e.message.slice(0, 160);
      }
    }
  }
  return Response.json({ has_anthropic_key: hasKey, model_results: results });
});

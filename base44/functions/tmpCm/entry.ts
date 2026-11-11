import { htmlToText, emailifyHtml, mergeFields } from '../../shared/campaignMail.js';
Deno.serve(() => Response.json({ ok: true, t: htmlToText(emailifyHtml(mergeFields('<p>Spoštovani,</p><p>za {podjetje}</p>', { name: 'Janez Novak', company: 'X' }))) }));

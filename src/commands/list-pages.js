import { callDaemon } from '../client.js';

export default async function listPages(args, flags) {
  const result = await callDaemon('list_pages', {});
  const text = result?.content?.[0]?.text || '';

  if (!text) return 'No pages open';

  const lines = text.split('\n').filter(l => l.trim());
  const verbose = flags.v || flags.verbose;

  if (lines.length === 0) return 'No pages open';

  return lines.map((line, i) => {
    if (verbose) return line;
    return line;
  }).join('\n');
}

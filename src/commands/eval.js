import { callDaemon } from '../client.js';

export default async function evalCmd(args, flags) {
  const code = args.join(' ');
  if (!code) throw new Error('Usage: chrome-cli eval <code>\nExample: chrome-cli eval "() => document.title"');

  const result = await callDaemon('evaluate_script', { function: code });
  const text = result?.content?.[0]?.text || JSON.stringify(result);

  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && parsed !== undefined) {
      return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed);
    }
  } catch {}

  return text;
}

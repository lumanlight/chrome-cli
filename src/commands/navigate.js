import { callDaemon } from '../client.js';

export default async function navigate(args, flags) {
  const url = args[0];
  if (!url) throw new Error('Usage: chrome-cli navigate <url>');

  const result = await callDaemon('navigate_page', { url });
  const text = result?.content?.[0]?.text || JSON.stringify(result);
  const lines = text.split('\n');
  return lines[0] || 'Navigated';
}

import { callDaemon } from '../client.js';

export default async function newCmd(args, flags) {
  const url = args[0];
  if (!url) throw new Error('Usage: chrome-cli new <url>');
  
  const result = await callDaemon('new_page', { url });
  const text = result?.content?.[0]?.text || JSON.stringify(result);
  return text.includes('Error') ? `Failed: ${text}` : `New tab opened: ${url}`;
}

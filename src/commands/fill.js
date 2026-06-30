import { callDaemon } from '../client.js';

export default async function fill(args, flags) {
  const uid = args[0];
  const value = args.slice(1).join(' ');
  if (!uid || !value) throw new Error('Usage: chrome-cli fill <uid> <text>');

  const result = await callDaemon('fill', { uid, value });
  const text = result?.content?.[0]?.text || JSON.stringify(result);
  return text.includes('Error') ? `Fill failed: ${text}` : `Filled element ${uid}`;
}

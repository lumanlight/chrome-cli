import { callDaemon } from '../client.js';

export default async function click(args, flags) {
  const uid = args[0];
  if (!uid) throw new Error('Usage: chrome-cli click <uid>');

  const result = await callDaemon('click', { uid });
  const text = result?.content?.[0]?.text || JSON.stringify(result);
  return text.includes('Error') ? `Click failed: ${text}` : `Clicked element ${uid}`;
}

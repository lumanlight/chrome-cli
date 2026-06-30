import { callDaemon } from '../client.js';

export default async function snapshot(args, flags) {
  const result = await callDaemon('take_snapshot', {});
  const text = result?.content?.[0]?.text || '';
  if (!text) return 'No snapshot data returned';
  return text;
}

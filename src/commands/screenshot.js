import { callDaemon } from '../client.js';
import { statSync } from 'fs';

export default async function screenshot(args, flags) {
  const filePath = args[0] || `screenshot-${Date.now()}.png`;
  
  // MCP take_screenshot with filePath writes the image directly to disk
  const result = await callDaemon('take_screenshot', { filePath });
  
  const text = result?.content?.[0]?.text || '';
  
  // Verify the file was created
  try {
    const stats = statSync(filePath);
    return `Screenshot saved: ${filePath} (${stats.size} bytes)`;
  } catch {
    return text || 'Screenshot taken';
  }
}

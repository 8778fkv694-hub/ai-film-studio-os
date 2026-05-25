import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir } = parseArgs();

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function main() {
  const fixupDir = path.join(workDir, 'fixups');
  if (!fs.existsSync(fixupDir)) {
    console.log('[Fixup] No fixups directory found.');
    return;
  }

  const files = fs.readdirSync(fixupDir).filter(f => f.endsWith('.json'));
  let processed = 0;

  console.log(`[Fixup] Scanning ${files.length} tickets...`);

  for (const f of files) {
    const p = path.join(fixupDir, f);
    const ticket = readJson(p);
    
    if (ticket?.status === 'open') {
      console.log(`[Fixup] Processing ticket ${ticket.fixup_id} (${ticket.type})...`);
      
      // MOCK PROCESSING
      // In real life: call inpaint API / upscale API here
      
      ticket.status = 'completed';
      ticket.result_ref = `renders/${ticket.target_shot_id}/fixups/${ticket.fixup_id}_fixed.mp4`;
      
      // Simulate writing result meta back
      fs.writeFileSync(p, JSON.stringify(ticket, null, 2));
      console.log(`[Fixup] Ticket ${ticket.fixup_id} marked COMPLETED.`);
      processed++;
    }
  }
  
  console.log(`[Fixup] Done. Processed ${processed} tickets.`);
}

main();

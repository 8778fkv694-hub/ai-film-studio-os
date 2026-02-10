import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const ROOT = path.resolve(process.cwd(), '..');
  const reportPath = path.join(ROOT, 'reports', 'lint.report.json');

  if (!fs.existsSync(reportPath)) {
    // If no report exists, try running lint and reading the output
    return NextResponse.json({ exists: false, issues: [], summary: 'No lint report found. Run: node tools/scripts/lint.js' });
  }

  try {
    const content = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    return NextResponse.json({ exists: true, ...report });
  } catch {
    return NextResponse.json({ exists: false, issues: [], summary: 'Failed to parse lint report' });
  }
}

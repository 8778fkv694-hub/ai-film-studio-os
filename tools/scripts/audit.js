import { execFileSync } from 'node:child_process';

const projectRoot = process.cwd();

const auditTargets = [
  { name: 'Root Project', args: ['audit', '--json', '--registry=https://registry.npmjs.org'] },
  { name: 'UI Workspace', args: ['audit', '--workspace=ui', '--json', '--registry=https://registry.npmjs.org'] },
  { name: 'Tools Workspace', args: ['audit', '--workspace=tools', '--json', '--registry=https://registry.npmjs.org'] }
];

let allPassed = true;

console.log('🛡️ AI Film Studio OS - Dependency Security Audit');

for (const target of auditTargets) {
  console.log(`\n🔍 Auditing ${target.name}...`);
  let stdout = '';
  try {
    stdout = execFileSync('npm', target.args, {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024
    });
  } catch (err) {
    stdout = err.stdout || '';
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error(`❌ Failed to parse npm audit output for ${target.name}`);
    console.error(stdout.slice(0, 1000));
    allPassed = false;
    continue;
  }

  const vulnerabilities = report.vulnerabilities || {};
  const vulnEntries = Object.entries(vulnerabilities);
  const total = report.metadata?.vulnerabilities?.total || 0;

  if (vulnEntries.length === 0 && total === 0) {
    console.log(`✅ ${target.name} audit passed: 0 vulnerabilities found.`);
  } else {
    console.error(`❌ ${target.name} audit failed: ${vulnEntries.length} vulnerabilities found (${total} total).`);
    for (const [name, v] of vulnEntries) {
      const sev = (v.severity || 'high').toUpperCase();
      const nodes = v.nodes || [];
      console.error(`  [${sev}] ${name} in ${nodes.join(', ')}`);
      for (const via of (v.via || [])) {
        if (typeof via === 'object') {
          console.error(`    - ${via.title} (${via.url})`);
        } else {
          console.error(`    - via: ${via}`);
        }
      }
    }
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n✅ All workspaces completed security audit successfully with 0 vulnerabilities!\n');
  process.exit(0);
} else {
  console.error('\n⚠️  Security audit failed. Please fix the dependency issues listed above.\n');
  process.exit(2);
}

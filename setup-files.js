const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname);

// Create directories
const huskyDir = path.join(baseDir, '.husky');
const scriptsDir = path.join(baseDir, 'scripts');

if (!fs.existsSync(huskyDir)) {
  fs.mkdirSync(huskyDir, { recursive: true });
  console.log('✅ Created .husky directory');
}

if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
  console.log('✅ Created scripts directory');
}

// Create .husky/post-commit
const postCommitContent = `#!/usr/bin/env sh

echo ""
echo "🔒 Running post-commit security checks..."
echo "==========================================="

FAILED=0

# ── 1. Dependency audit ──────────────────────────────────────────────────────
echo ""
echo "📦 Auditing client dependencies..."
npm audit --prefix client --audit-level=moderate
CLIENT_AUDIT=$?

echo ""
echo "📦 Auditing server dependencies..."
npm audit --prefix server --audit-level=moderate
SERVER_AUDIT=$?

if [ $CLIENT_AUDIT -ne 0 ] || [ $SERVER_AUDIT -ne 0 ]; then
  echo ""
  echo "❌ npm audit found moderate or higher vulnerabilities."
  echo "   Run 'npm audit fix --prefix client' or 'npm audit fix --prefix server' to resolve them."
  FAILED=1
fi

# ── 2. Secret scan ──────────────────────────────────────────────────────────
echo ""
echo "🔍 Scanning latest commit for hardcoded secrets..."
node "$(git rev-parse --show-toplevel)/scripts/check-secrets.js"
SECRET_SCAN=$?

if [ $SECRET_SCAN -ne 0 ]; then
  FAILED=1
fi

# ── Result ───────────────────────────────────────────────────────────────────
echo ""
echo "==========================================="
if [ $FAILED -ne 0 ]; then
  echo "⚠️  Security checks found issues (see above)."
  echo "   Commit was recorded, but please address these before pushing."
else
  echo "✅ All security checks passed."
fi
echo ""`;

fs.writeFileSync(path.join(huskyDir, 'post-commit'), postCommitContent, 'utf8');
console.log('✅ Created .husky/post-commit');

// Create scripts/check-secrets.js
const checkSecretsContent = `#!/usr/bin/env node
/**
 * check-secrets.js
 * Scans the diff of the latest git commit for common secret patterns.
 * Exits with code 1 if any potential secrets are found.
 */

const { execSync } = require('child_process');

const SECRET_PATTERNS = [
  // Private keys
  { name: 'Private Key', regex: /-----BEGIN\\s+(?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY/ },
  // AWS
  { name: 'AWS Access Key ID', regex: /(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])/ },
  { name: 'AWS Secret Key', regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/ },
  // Generic secrets in assignments (catches apiKey="...", password='...', secret=\`...\`, TOKEN=...)
  {
    name: 'Hardcoded Secret/Key/Token/Password',
    regex: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|client[_-]?secret)\\s*[:=]\\s*['"\`](?!process\\.env)[^'"\`\\s]{8,}['"\`]/i,
  },
  // Generic high-entropy hex/base64 strings assigned to sensitive-sounding vars
  { name: 'Possible Secret Value', regex: /(?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL)\\s*=\\s*['"\`][A-Za-z0-9+/]{32,}={0,2}['"\`]/i },
  // Connection strings with credentials
  { name: 'Connection String with Credentials', regex: /[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\/[^:@\\s]+:[^@\\s]+@/ },
  // SendGrid / Stripe / Twilio / GitHub tokens
  { name: 'SendGrid API Key', regex: /SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}/ },
  { name: 'Stripe Secret Key', regex: /sk_(live|test)_[A-Za-z0-9]{24,}/ },
  { name: 'GitHub Personal Access Token', regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub OAuth Token', regex: /gho_[A-Za-z0-9]{36}/ },
  { name: 'Twilio Auth Token', regex: /AC[a-z0-9]{32}/ },
];

// Lines to skip (e.g. diff meta-lines, comments, lock file hashes)
const SKIP_LINE_PREFIXES = ['---', '+++', 'diff ', 'index ', 'new file', 'deleted file', 'Binary'];

function getDiff() {
  try {
    // If this is the very first commit, compare against empty tree
    const parentCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    if (parentCount === '1') {
      return execSync('git diff --unified=0 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD', { encoding: 'utf8' });
    }
    return execSync('git diff --unified=0 HEAD~1 HEAD', { encoding: 'utf8' });
  } catch {
    console.error('⚠️  check-secrets: could not get git diff — skipping secret scan.');
    process.exit(0);
  }
}

function main() {
  const diff = getDiff();
  const findings = [];

  const lines = diff.split('\\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Only check added lines (starts with '+' but not '+++')
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;

    const line = raw.slice(1); // strip leading '+'
    if (SKIP_LINE_PREFIXES.some((p) => line.startsWith(p))) continue;

    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        findings.push({ lineNumber: i + 1, name, snippet: line.trim().slice(0, 120) });
        break; // one finding per line is enough
      }
    }
  }

  if (findings.length === 0) {
    console.log('✅ No hardcoded secrets detected in this commit.');
    process.exit(0);
  }

  console.error(\`\\n❌ Potential secrets found in the latest commit:\\n\`);
  for (const { lineNumber, name, snippet } of findings) {
    console.error(\`  [Line ~\${lineNumber}] \${name}\`);
    console.error(\`    \${snippet}\\n\`);
  }
  console.error('Please remove the secret(s), rotate any exposed credentials, and amend the commit.');
  process.exit(1);
}

main();`;

fs.writeFileSync(path.join(scriptsDir, 'check-secrets.js'), checkSecretsContent, 'utf8');
console.log('✅ Created scripts/check-secrets.js');

console.log('\n📋 All files created successfully!');

const fs = require('fs');
const path = require('path');

const baseDir = 'E:/Agent_Projects/projects/src/app/api';
const skipFiles = new Set(['auth/login/route.test.ts', 'auth/register/route.test.ts']);

function processFile(filepath) {
  const relPath = path.relative(baseDir, filepath).replace(/\\/g, '/');
  if (skipFiles.has(relPath)) {
    console.log('Skipping', relPath);
    return;
  }
  let content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('verifyToken')) return;
  
  const original = content;
  content = content.replace(/verifyToken:\s*vi\.fn\(\)/g, 'getAuthUser: vi.fn()');
  content = content.replace(/import\s*\{\s*verifyToken\s*\}\s*from\s*'@\/lib\/auth-utils';/g, "import { getAuthUser } from '@/lib/auth-utils';");
  content = content.replace(/const\s+mockedVerifyToken\s*=\s*vi\.mocked\(verifyToken\);/g, 'const mockedGetAuthUser = vi.mocked(getAuthUser);');
  content = content.replace(/mockedVerifyToken\.mockReset\(\);/g, 'mockedGetAuthUser.mockReset();');
  content = content.replace(/mockedVerifyToken\.mockResolvedValue\(null\);/g, 'mockedGetAuthUser.mockReturnValue(null);');
  content = content.replace(/mockedVerifyToken\.mockResolvedValue\(/g, 'mockedGetAuthUser.mockReturnValue(');
  content = content.replace(/mockedVerifyToken/g, 'mockedGetAuthUser');
  
  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated', relPath);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.test.ts')) processFile(fullPath);
  }
}
walk(baseDir);

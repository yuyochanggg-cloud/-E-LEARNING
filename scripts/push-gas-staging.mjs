// 把後端推到「測試環境」GAS：gas/Code.gs + gas/staging/Setup.gs + gas/staging/appsscript.json
// 用法：npm run push:staging   （只碰 staging 專案，正式專案的推法見 HANDOFF.md）
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const stagingDir = join(root, 'gas', 'staging');
const build = join(stagingDir, 'build');

mkdirSync(build, { recursive: true });
for (const f of readdirSync(build)) rmSync(join(build, f));
copyFileSync(join(root, 'gas', 'Code.gs'), join(build, 'Code.js'));
copyFileSync(join(stagingDir, 'Setup.gs'), join(build, 'Setup.js'));
copyFileSync(join(stagingDir, 'appsscript.json'), join(build, 'appsscript.json'));

execSync('npx @google/clasp push -f', { cwd: stagingDir, stdio: 'inherit' });
console.log('\n✅ 已推到 staging。要讓網址生效還需要更新部署：npm run deploy-gas:staging');

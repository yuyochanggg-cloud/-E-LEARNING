// 把後端推到「測試環境」GAS：gas/Code.gs + gas/Experiment.gs + gas/staging/Setup.gs (+ seed) + gas/staging/appsscript.json
// 用法：npm run push:staging   （只碰 staging 專案，正式專案的推法見 HANDOFF.md）
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const stagingDir = join(root, 'gas', 'staging');
const build = join(stagingDir, 'build');

mkdirSync(build, { recursive: true });
for (const f of readdirSync(build)) rmSync(join(build, f));
copyFileSync(join(root, 'gas', 'Code.gs'), join(build, 'Code.js'));
copyFileSync(join(root, 'gas', 'Experiment.gs'), join(build, 'Experiment.js'));
// 題庫種子（gitignore，只在本機有）：有才推
const seed = join(stagingDir, 'seed', 'SeedItems.js');
const viewAcc = join(stagingDir, 'seed', 'ViewAccounts.js'); // 多視角測試帳號共用密碼
if (existsSync(viewAcc)) copyFileSync(viewAcc, join(build, 'ViewAccounts.js'));
if (existsSync(seed)) copyFileSync(seed, join(build, 'SeedItems.js'));
// 門市對練定案資料（gitignore，只在本機有）：有才推
const finalData = join(root, 'gas', 'seed', 'FinalData.js');
if (existsSync(finalData)) copyFileSync(finalData, join(build, 'FinalData.js'));
copyFileSync(join(stagingDir, 'Setup.gs'), join(build, 'Setup.js'));
copyFileSync(join(stagingDir, 'appsscript.json'), join(build, 'appsscript.json'));

execSync('npx @google/clasp push -f', { cwd: stagingDir, stdio: 'inherit' });
console.log('\n✅ 已推到 staging。要讓網址生效還需要更新部署：npm run deploy-gas:staging');

// 部署 staging 前端到 Vercel 預覽，並把固定網址 lx-elearning-staging.vercel.app 指到這次的部署。
// 用法：npm run deploy:staging
import { execSync } from 'node:child_process';

const GAS = 'https://script.google.com/macros/s/AKfycbw0OtD6zQrut0jtgxqr_Zacsyjj_q8es3V3LOi_5tji6iLWkSQ8RG7hsODo7DqQmuQ9tQ/exec';
const ALIAS = 'lx-elearning-staging.vercel.app';

const out = execSync(`vercel deploy --yes --build-env VITE_APP_ENV=staging --build-env VITE_GAS_API_URL=${GAS}`,
  { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
const url = out.trim().split(/\s+/).filter(s => s.startsWith('https://')).pop();
if (!url) throw new Error('沒拿到部署網址：' + out);
execSync(`vercel alias set ${url} ${ALIAS}`, { stdio: 'inherit' });
console.log(`\n✅ staging 前端：https://${ALIAS}（這次部署 ${url}）`);

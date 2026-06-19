const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true, args: ['--no-sandbox'],
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage();

  const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXFrejNjcmcwMDAwcWR1dXgwMnoyaDd3IiwiZW1haWwiOiJhZG1pbkBpbnZlc3RpbWVudG9zLmxvY2FsIiwiaWF0IjoxNzgxODc2NTQ2LCJleHAiOjE3ODI0ODEzNDZ9.EILJsOJOuVaPHRg37tMNCEtw9HqXpVFPwI3ltwbdnfY';
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(t => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify({ name: 'Investidor', email: 'admin@investimentos.local' }));
  }, TOKEN);

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/ss_dashboard.png', fullPage: true });
  console.log('Dashboard URL:', page.url());
  const t = await page.textContent('body');
  console.log('Has Patrimônio:', t.includes('Patrimônio'));
  console.log('Has R$:', t.includes('R$'));
  
  await page.goto('http://localhost:3000/investimentos');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/ss_investimentos.png', fullPage: true });
  const ti = await page.textContent('body');
  console.log('Investimentos - FII:', ti.includes('FII'), '| Renda Fixa:', ti.includes('Renda Fixa'));

  await page.goto('http://localhost:3000/imoveis');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/ss_imoveis.png', fullPage: true });
  const tim = await page.textContent('body');
  console.log('Imóveis - Para Renda:', tim.includes('Para Renda'));

  await browser.close();
  console.log('Done!');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

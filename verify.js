const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  let hasErrors = false;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`PAGE LOG: ${msg.text()}`);
      hasErrors = true;
    }
  });

  page.on('pageerror', error => {
    console.error(`PAGE ERROR: ${error.message}`);
    hasErrors = true;
  });

  await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });

  // Test basic load
  const title = await page.title();
  console.log('Title:', title);

  // Check demo project load
  console.log('Clicking demo button...');
  // Mock confirm and alert
  await page.evaluate(() => {
    window.confirm = () => true;
    window.alert = () => {};
  });

  await page.click('#btn-demo');

  // Wait a moment for async fetch to finish
  await new Promise(resolve => setTimeout(resolve, 2000));

  const items = await page.$$('.asset-card');
  console.log(`Found ${items.length} assets in library`);

  await browser.close();

  if (hasErrors || items.length < 4) {
    console.error('Verification failed.');
    process.exit(1);
  } else {
    console.log('Verification passed.');
  }
})();

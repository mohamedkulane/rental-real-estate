import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.WORKFLOW_UX_RUNTIME_DISPOSABLE !== 'yes')
  throw new Error('Explicit disposable-runtime confirmation is required.');
const baseURL = process.env.WORKFLOW_UX_BASE_URL ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
  throw new Error('Runtime test is local-only.');
const packageRoot = process.env.BROWSER_PACKAGE_ROOT;
if (!packageRoot) throw new Error('BROWSER_PACKAGE_ROOT is required.');
const require = createRequire(resolve(packageRoot, 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('response', async (response) => {
  if (response.url().includes('/workflows/') && response.status() >= 400) {
    console.error('Workflow response: ' + response.status() + ' ' + (await response.text()));
    const data = response.request().postDataJSON();
    console.error(
      'Submitted command/version/step: ' +
        JSON.stringify({
          command: data?.command,
          version: data?.expectedVersion,
          step: data?.currentStep,
        }),
    );
  }
});
page.setDefaultTimeout(30000);
const directory = resolve('.artifacts/workflow-brokerage', String(Date.now()));
await mkdir(directory, { recursive: true });
let stage = 'sign-in';
const atStep = async (name) => {
  stage = name;
  await page.getByRole('heading', { name, exact: true }).waitFor();
  console.log('STEP ' + name);
};
const choose = async (label, search, match) => {
  const control = page.getByRole('combobox', { name: label, exact: true });
  if ((await control.evaluate((element) => element.tagName)) === 'SELECT') {
    const value = await control
      .locator('option')
      .evaluateAll(
        (options, needle) =>
          options.find((option) =>
            option.textContent?.toLocaleLowerCase().includes(String(needle).toLocaleLowerCase()),
          )?.value,
        match,
      );
    if (!value) throw new Error(`No ${label} option matched ${match}.`);
    await control.selectOption(value);
  } else {
    await control.fill(search);
    const option = page.getByRole('option', { name: new RegExp(match, 'i') }).first();
    await option.waitFor();
    await option.click();
  }
};
try {
  await page.goto(baseURL + '/login');
  await page.getByLabel('Email address').fill(process.env.SEED_ADMIN_EMAIL ?? '');
  await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/admin');
  stage = 'find-eligible-property';
  const target = await page.evaluate(async () => {
    const request = async (path) => {
      const response = await fetch('/api/backend' + path);
      if (!response.ok) throw new Error('Lookup failed: ' + response.status);
      return response.json();
    };
    const ownerships = (
      await request('/property-ownerships?period=CURRENT&propertySearch=Browser%20Villa&limit=50')
    ).items;
    for (const ownership of ownerships) {
      const engagements = (
        await request('/service-engagements?propertyId=' + ownership.propertyId + '&limit=20')
      ).items;
      const spaces = (
        await request('/rentable-spaces?propertyId=' + ownership.propertyId + '&limit=20')
      ).items;
      if (!engagements.length && spaces.length)
        return {
          propertyName: ownership.property.name,
          ownerName: ownership.owner.displayName,
          spaceName: spaces[0].name,
        };
    }
    throw new Error('No disposable onboarded property is ready for brokerage.');
  });
  await page.goto(baseURL + '/workflows/new?type=RENTAL_BROKERAGE');
  await page
    .getByLabel('Operating Branch', { exact: true })
    .locator('option')
    .nth(1)
    .waitFor({ state: 'attached' });
  await page.getByLabel('Operating Branch', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start Workflow', exact: true }).click();
  await atStep('Rental Brokerage');
  await choose('Owner', target.ownerName, target.ownerName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await choose('Property', target.propertyName, target.propertyName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await choose('Rentable Spaces', target.spaceName, target.spaceName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Create company service', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create company service', exact: true })
    .waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel('Readiness notes')
    .fill('Property and selected space are ready for tenant placement.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Documents', exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Review', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Activate', exact: true }).waitFor();
  await page.screenshot({ path: resolve(directory, 'review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Complete Workflow', exact: true }).click();
  await page.getByText('This workflow is no longer editable.', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(directory, 'completed.png'), fullPage: true });
  console.log('RENTAL BROKERAGE BROWSER FLOW: PASS');
  console.log('Evidence: ' + directory);
} catch (error) {
  await page
    .screenshot({ path: resolve(directory, 'failure.png'), fullPage: true })
    .catch(() => {});
  console.error('FAILED STAGE: ' + stage);
  console.error('Visible alerts: ' + (await page.getByRole('alert').allTextContents()).join(' | '));
  console.error(error.message);
  console.error('Evidence: ' + directory);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

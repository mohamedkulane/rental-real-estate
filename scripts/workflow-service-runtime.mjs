import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.WORKFLOW_UX_RUNTIME_DISPOSABLE !== 'yes')
  throw new Error('Explicit disposable-runtime confirmation is required.');
const type = process.env.WORKFLOW_TYPE;
if (!['FULL_MANAGEMENT', 'PROPERTY_SALE'].includes(type))
  throw new Error('WORKFLOW_TYPE must be FULL_MANAGEMENT or PROPERTY_SALE.');
const baseURL = process.env.WORKFLOW_UX_BASE_URL ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
  throw new Error('Runtime test is local-only.');
const require = createRequire(resolve(process.env.BROWSER_PACKAGE_ROOT, 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const directory = resolve('.artifacts/workflow-services', `${type}-${Date.now()}`);
await mkdir(directory, { recursive: true });
let stage = 'sign-in';
const choose = async (label, search, match) => {
  const control = page.getByRole('combobox', { name: label, exact: true });
  await control.fill(search);
  const option = page.getByRole('option', { name: new RegExp(match, 'i') }).first();
  await option.waitFor();
  await option.click();
};
try {
  await page.goto(baseURL + '/login');
  await page.getByLabel('Email address').fill(process.env.SEED_ADMIN_EMAIL ?? '');
  await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/admin');
  const target = await page.evaluate(async () => {
    const request = async (path) => {
      const response = await fetch('/api/backend' + path);
      if (!response.ok) throw new Error('Lookup failed.');
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
          ownershipSearch: ownership.property.name,
          spaceName: spaces[0].name,
        };
    }
    throw new Error('No disposable onboarded property is ready.');
  });
  await page.goto(`${baseURL}/workflows/new?type=${type}`);
  const branch = page.getByLabel('Operating Branch', { exact: true });
  await branch.locator('option').nth(1).waitFor({ state: 'attached' });
  await branch.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start Workflow', exact: true }).click();
  stage = type;
  await page
    .getByRole('heading', {
      name: type === 'FULL_MANAGEMENT' ? 'Full Management' : 'Property Sale',
      exact: true,
    })
    .waitFor();
  await choose(
    type === 'FULL_MANAGEMENT' ? 'Owner' : 'Seller (if external)',
    target.ownerName,
    target.ownerName,
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await choose('Property', target.propertyName, target.propertyName);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await choose(
    type === 'FULL_MANAGEMENT' ? 'Ownership Eligibility' : 'Ownership Evidence',
    target.ownershipSearch,
    target.propertyName,
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (type === 'FULL_MANAGEMENT') {
    await choose('Rentable Spaces', target.spaceName, target.spaceName);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Create company service', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create company service', exact: true })
    .waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel(type === 'FULL_MANAGEMENT' ? 'Management terms' : 'Readiness notes')
    .fill(
      type === 'FULL_MANAGEMENT'
        ? 'Manage the selected property and space under the active service engagement.'
        : 'Ownership and sale authority were reviewed for marketing preparation.',
    );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Documents', exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (type === 'PROPERTY_SALE')
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('heading', {
      name: type === 'FULL_MANAGEMENT' ? 'Review & Activate' : 'Activate',
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: resolve(directory, 'review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Complete Workflow', exact: true }).click();
  await page.getByText('This workflow is no longer editable.', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(directory, 'completed.png'), fullPage: true });
  console.log(type + ' BROWSER FLOW: PASS');
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

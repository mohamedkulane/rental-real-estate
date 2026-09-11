import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.WORKFLOW_UX_RUNTIME_DISPOSABLE !== 'yes')
  throw new Error('Explicit disposable-runtime confirmation is required.');
const baseURL = process.env.WORKFLOW_UX_BASE_URL ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
  throw new Error('Runtime test is local-only.');
const packageRoot = process.env.BROWSER_PACKAGE_ROOT;
if (!packageRoot)
  throw new Error('BROWSER_PACKAGE_ROOT must point to the installed browser automation packages.');
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
      'Submitted version/step: ' +
        JSON.stringify({ version: data?.expectedVersion, step: data?.currentStep }),
    );
  }
});
page.setDefaultTimeout(30000);
const directory = resolve('.artifacts/workflow-onboarding', String(Date.now()));
await mkdir(directory, { recursive: true });
const suffix = Date.now().toString(36);
let stage = 'sign-in';
const step = async (name) => {
  stage = name;
  await page.getByRole('heading', { name, level: 2, exact: true }).waitFor();
  console.log('STEP ' + name);
};
try {
  await page.goto(baseURL + '/login');
  await page.getByLabel('Email address').fill(process.env.SEED_ADMIN_EMAIL ?? '');
  await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/admin');
  stage = 'start-workflow';
  await page.goto(baseURL + '/workflows/new?type=PROPERTY_ONBOARDING');
  const branch = page.getByLabel('Operating Branch', { exact: true });
  await branch.locator('option').nth(1).waitFor({ state: 'attached' });
  await branch.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start Workflow', exact: true }).click();
  await step('Owner / Party');
  await page
    .getByRole('combobox', { name: 'Person or organization', exact: true })
    .first()
    .selectOption('person');
  await page.getByLabel('Given name').fill('Browser');
  await page.getByLabel('Family name').fill('Owner ' + suffix);
  await page.getByRole('button', { name: 'Add owner', exact: true }).click();
  await page.getByRole('button', { name: 'Add owner', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Ownership');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Property Details');
  await page.getByLabel('Property name').fill('Browser Villa ' + suffix);
  await page.getByLabel('Property type').selectOption('VILLA');
  await page.getByLabel('City', { exact: true }).fill('Mogadishu');
  await page.getByLabel('Address', { exact: true }).fill('Onboarding test address');
  await page.getByRole('button', { name: 'Create property', exact: true }).click();
  await page.getByText('Property and ownership are saved.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Building / Structure');
  await page.getByLabel('Building name').fill('Main Villa');
  await page.getByLabel('Number of floors').fill('2');
  await page.getByRole('button', { name: 'Add building', exact: true }).click();
  await page.getByText('1 added.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Rentable Spaces');
  await page.getByLabel('Space name').fill('First Room');
  await page.getByLabel('Space type', { exact: true }).selectOption('ROOM');
  await page.getByLabel('Building', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Add rentable space', exact: true }).click();
  await page.getByText('1 added.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Company Service');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Documents');
  await page.getByRole('button', { name: 'Upload document', exact: true }).first().click();
  await page.getByLabel('Document title').fill('Ownership intake note');
  await page
    .getByLabel('File', { exact: true })
    .setInputFiles({
      name: 'onboarding.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Disposable onboarding acceptance evidence.'),
    });
  await page
    .locator('form')
    .filter({ has: page.getByLabel('Document title') })
    .getByRole('button', { name: 'Upload document', exact: true })
    .click();
  await page.getByText('Ownership intake note', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save & resume later', exact: true }).click();
  await page.waitForURL('**/workflows');
  await page.getByRole('link', { name: 'Continue', exact: true }).first().click();
  await step('Documents');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await step('Review & Complete');
  await page.screenshot({ path: resolve(directory, 'review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Complete onboarding', exact: true }).click();
  await page.getByText('This workflow is no longer editable.', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(directory, 'completed.png'), fullPage: true });
  stage = 'completed-property-link';
  await page.getByRole('link', { name: 'Open property', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser Villa ' + suffix, exact: true }).waitFor();
  stage = 'cancel-workflow';
  await page.goto(baseURL + '/workflows/new?type=PROPERTY_ONBOARDING');
  await page.getByLabel('Operating Branch', { exact: true }).locator('option').nth(1).waitFor({ state: 'attached' });
  await page.getByLabel('Operating Branch', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start Workflow', exact: true }).click();
  await step('Owner / Party');
  await page.getByRole('button', { name: 'Cancel workflow', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Cancel workflow', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Disposable cancellation acceptance test');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel workflow', exact: true }).click();
  await page.getByText('This workflow is no longer editable.', { exact: true }).waitFor();
  await page.getByText('Cancelled', { exact: true }).waitFor();
  console.log('PROPERTY ONBOARDING BROWSER FLOW: PASS');
  console.log('Evidence: ' + directory);
} catch (error) {
  await page
    .screenshot({ path: resolve(directory, 'failure.png'), fullPage: true })
    .catch(() => {});
  console.error('FAILED STAGE: ' + stage);
  console.error('Visible alerts: ' + (await page.getByRole('alert').allTextContents()).join(' | '));
  console.error(
    'Select labels: ' +
      JSON.stringify(
        await page
          .locator('select')
          .evaluateAll((selects) =>
            selects.map((select) => ({
              labels: [...select.labels].map((label) => label.textContent),
              options: select.options.length,
            })),
          ),
      ),
  );
  console.error(error.message);
  console.error('Evidence: ' + directory);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

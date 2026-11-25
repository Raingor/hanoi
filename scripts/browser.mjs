import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://localhost:4308/';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const errors = [];
const checks = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};

async function open(width, height, touch) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: touch,
    hasTouch: touch,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${width} pageerror ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`${width} console ${msg.text()}`);
  });
  page.on('requestfailed', request => errors.push(`${width} requestfailed ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${width} HTTP ${response.status()} ${response.url()}`);
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page };
}

const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

function hanoiMoves(count, from = 0, to = 2, spare = 1) {
  if (count === 0) return [];
  return [
    ...hanoiMoves(count - 1, from, spare, to),
    [from, to],
    ...hanoiMoves(count - 1, spare, to, from),
  ];
}

async function clickPeg(page, peg, touch) {
  const target = page.locator(`[data-peg="${peg}"]`);
  if (touch) await target.tap(); else await target.click();
}

async function solveThreeDisks(page, touch) {
  for (const [from, to] of hanoiMoves(3)) {
    await clickPeg(page, from, touch);
    await clickPeg(page, to, touch);
  }
}

try {
  await mkdir(out, { recursive: true });
  for (const [width, height, touch] of [[1440, 960, false], [390, 844, true], [360, 780, true]]) {
    const label = `${width}${touch ? '-touch' : '-desktop'}`;
    const { context, page } = await open(width, height, touch);
    check(`${label}: title and bear image load`, await page.evaluate(async () => {
      const image = new Image();
      image.src = './characters/classic.webp';
      await image.decode().catch(() => {});
      return document.title.includes('汉诺塔') && image.naturalWidth > 0;
    }));
    check(`${label}: three pegs and seven minimum moves are visible`, await page.locator('.peg').count() === 3 && await page.locator('#stat-min').textContent() === '7');
    check(`${label}: initial tower has three disks`, await page.locator('[data-peg="0"] .disk').count() === 3);
    check(`${label}: no horizontal overflow`, await noOverflow(page));
    await page.screenshot({ path: `${out}/${label}-start.png`, fullPage: true, animations: 'disabled' });

    await clickPeg(page, 0, touch);
    check(`${label}: selecting a peg marks it selected`, await page.locator('[data-peg="0"].selected').isVisible());
    await clickPeg(page, 1, touch);
    check(`${label}: first legal move increments step count`, await page.locator('#stat-moves').textContent() === '1');

    await clickPeg(page, 0, touch);
    await clickPeg(page, 1, touch);
    check(`${label}: large-on-small move is rejected`, await page.locator('#stat-moves').textContent() === '1' && await page.locator('#toast.show').isVisible());
    await clickPeg(page, 1, touch);
    check(`${label}: invalid selection does not move the top disk`, await page.locator('[data-peg="1"] .disk').count() === 1);

    await clickPeg(page, 0, touch);
    check(`${label}: clicking selected peg deselects it`, await page.locator('.peg.selected').count() === 0);
    await page.locator('[data-action="undo"]').click();
    check(`${label}: undo restores the first move`, await page.locator('#stat-moves').textContent() === '0' && await page.locator('[data-peg="1"] .disk').count() === 0);

    await page.locator('[data-action="disk-plus"]').click();
    check(`${label}: disk count increases to four`, await page.locator('#disk-count').textContent().then(text => text.trim() === '4'));
    check(`${label}: four disks appear in the first peg`, await page.locator('[data-peg="0"] .disk').count() === 4);
    await page.locator('[data-action="disk-minus"]').click();
    check(`${label}: disk count returns to three`, await page.locator('#disk-count').textContent().then(text => text.trim() === '3'));

    await solveThreeDisks(page, touch);
    check(`${label}: exact seven-move solution completes the tower`, await page.locator('#stat-moves').textContent() === '7');
    check(`${label}: win dialog appears`, await page.locator('.win-card').isVisible());
    check(`${label}: right peg holds three ordered disks`, await page.locator('[data-peg="2"] .disk').count() === 3);
    await page.screenshot({ path: `${out}/${label}-win.png`, fullPage: true, animations: 'disabled' });

    await page.reload({ waitUntil: 'networkidle' });
    check(`${label}: best result persists after reload`, await page.locator('#best-text').textContent().then(text => text.includes('7 步')));
    check(`${label}: no horizontal overflow after reload`, await noOverflow(page));
    await context.close();
  }

  const { context, page } = await open(1440, 960, false);
  await page.keyboard.press('1');
  check('keyboard one selects first peg', await page.locator('[data-peg="0"].selected').isVisible());
  await page.keyboard.press('3');
  check('keyboard three completes a move', await page.locator('#stat-moves').textContent() === '1');
  await page.keyboard.press('z');
  check('keyboard z undo works', await page.locator('#stat-moves').textContent() === '0');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return '';
    const style = getComputedStyle(active);
    return `${active.tagName}:${style.outlineStyle}:${style.outlineWidth}`;
  });
  check('keyboard focus is visible', /:(solid|auto):(?!0px)/.test(focused));
  await context.close();

  if (errors.length) {
    console.error(errors.join('\n'));
    throw new Error(`browser errors: ${errors.length}`);
  }
  console.log(`Browser checks passed: ${checks.length}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

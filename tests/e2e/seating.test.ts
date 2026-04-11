import { test, expect } from '@playwright/test';

// DnD seating tests require a seeded Supabase test environment:
// - A club at slug matching TEST_CLUB env var
// - A tournament in "registration" status with 2 tables (max 3 seats each),
//   at least 3 players seated and 1 unseated
// - A tournament in "running" status with at least 1 busted player
// Set TEST_CLUB, TEST_REG_TOURNAMENT_ID, TEST_RUNNING_TOURNAMENT_ID env vars to enable.

const club = process.env.TEST_CLUB ?? '';
const regId = process.env.TEST_REG_TOURNAMENT_ID ?? '';
const runningId = process.env.TEST_RUNNING_TOURNAMENT_ID ?? '';
const hasTestEnv = !!club && !!regId && !!runningId;

test.describe('drag-and-drop seating (registration)', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    if (!hasTestEnv) testInfo.skip();
  });

  test('drag seated player to empty seat moves them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${regId}`);
    const chip = page.locator('[draggable=true]').first();
    const name = (await chip.textContent())?.trim() ?? '';
    const emptyCell = page.locator('.bg-muted.text-muted-foreground').first();
    await page.dragAndDrop('[draggable=true]', emptyCell);
    await expect(emptyCell).toContainText(name);
  });

  test('drag seated player onto seated player swaps them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${regId}`);
    const chips = page.locator('[draggable=true]');
    const nameA = (await chips.nth(0).textContent())?.trim() ?? '';
    const nameB = (await chips.nth(1).textContent())?.trim() ?? '';
    const cellA = chips.nth(0).locator('..');
    const cellB = chips.nth(1).locator('..');
    await page.dragAndDrop(chips.nth(0), chips.nth(1));
    await expect(cellA).toContainText(nameB);
    await expect(cellB).toContainText(nameA);
  });

  test('drag seated player to unseated strip unseats them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${regId}`);
    const chip = page.locator('[draggable=true]').first();
    const name = (await chip.textContent())?.trim() ?? '';
    const strip = page.locator('.border-dashed').first();
    await page.dragAndDrop(chip, strip);
    await expect(strip).toContainText(name);
  });

  test('drag unseated player to empty seat seats them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${regId}`);
    const strip = page.locator('.border-dashed').first();
    const unseatedChip = strip.locator('[draggable=true]').first();
    const name = (await unseatedChip.textContent())?.trim() ?? '';
    const emptyCell = page.locator('.bg-muted.text-muted-foreground').first();
    await page.dragAndDrop(unseatedChip, emptyCell);
    await expect(emptyCell).toContainText(name);
    await expect(strip).not.toContainText(name);
  });

  test('drag unseated player onto seated player swaps them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${regId}`);
    const strip = page.locator('.border-dashed').first();
    const unseatedChip = strip.locator('[draggable=true]').first();
    const unseatedName = (await unseatedChip.textContent())?.trim() ?? '';
    const seatedChip = page.locator('[draggable=true]').first();
    const seatedName = (await seatedChip.textContent())?.trim() ?? '';
    await page.dragAndDrop(unseatedChip, seatedChip);
    await expect(strip).toContainText(seatedName);
    await expect(page.locator('.border-dashed')).not.toContainText(unseatedName);
  });
});

test.describe('drag-and-drop seating (running)', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    if (!hasTestEnv) testInfo.skip();
  });

  test('drag active player to busted seat moves them', async ({ page }) => {
    await page.goto(`/${club}/admin/tournaments/${runningId}`);
    const activeChip = page.locator('[draggable=true]').first();
    const name = (await activeChip.textContent())?.trim() ?? '';
    const bustedCell = page.locator('.opacity-50').first();
    await page.dragAndDrop(activeChip, bustedCell);
    await expect(bustedCell).not.toContainText(name);
  });
});

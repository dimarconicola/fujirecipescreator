import { expect, test } from "@playwright/test";

function encodeSharePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

test("MVP core user path", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Fuji Recipe Lab" })).toBeVisible();
  await expect(page.getByLabel("Approximate visualizer disclosure")).toBeVisible();
  await expect(page.getByText("QA Diagnostics:")).toBeVisible();

  await page.getByRole("button", { name: "Split Screen: Off" }).click();
  await page.getByRole("button", { name: "Split Screen: On" }).click();

  const highlightSlider = page.getByLabel("Highlight");
  await highlightSlider.fill("3");
  await expect(highlightSlider).toHaveValue("3");

  await page.getByPlaceholder("Recipe name").fill("E2E Core Recipe");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("1 saved")).toBeVisible();

  await page.getByRole("button", { name: "Store A" }).click();
  await page.getByRole("button", { name: "Store B" }).click();
  await expect(page.getByRole("button", { name: "Toggle A/B" })).toBeEnabled();

  await page.getByText("Credits & Attribution").click();
  await expect(page.getByText("Reference Images")).toBeVisible();
});

test("profile switching applies catalog profile and hides fixed controls", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Camera model selector").selectOption("xtrans3");

  await expect(page.getByText("Model switched to X-T3 / X-T30.")).toBeVisible();
  await expect(page.getByLabel("Color Chrome FX Blue")).toHaveCount(0);
  await expect(page.getByLabel("Clarity")).toHaveCount(0);
  await expect(page.getByLabel("Grain Size")).toHaveCount(0);

  await page.getByLabel("Camera model selector").selectOption("xtrans5");
  await expect(page.getByText("Model switched to X-T5 / X-H2 / X-S20.")).toBeVisible();
  await expect(page.getByLabel("Clarity")).toHaveCount(1);
});

test("layout does not introduce horizontal overflow", async ({ page }) => {
  await page.goto("/");

  const desktopOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(desktopOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);

  const narrowOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(narrowOverflow).toBeLessThanOrEqual(1);
});

test("share link restoration covers same-profile and legacy migration paths", async ({
  page,
}) => {
  const baseParams = {
    film_sim: "classic_chrome",
    dynamic_range: "dr200",
    highlight: -1,
    shadow: 2,
    color: -1,
    chrome: "weak",
    chrome_blue: "off",
    clarity: 0,
    sharpness: 1,
    noise_reduction: -1,
    grain: "weak",
    grain_size: "small",
    wb: "auto",
    wb_kelvin: 5600,
    wb_shift: {
      a_b: 0,
      r_b: 0,
    },
  };

  const sameProfilePayload = {
    v: 1,
    profile_id: "xtrans3",
    base_image_id: "night_v1",
    params: {
      ...baseParams,
      film_sim: "acros",
      chrome_blue: "off",
      clarity: 0,
      grain_size: "small",
    },
  };
  const sameProfileEncoded = encodeSharePayload(sameProfilePayload);
  await page.goto(`/?v=1&s=${sameProfileEncoded}`);

  await expect(page.getByText("Share link state loaded.")).toBeVisible();
  await expect(page.getByLabel("Camera model selector")).toHaveValue("xtrans3");
  await expect(page.getByLabel("Highlight")).toHaveValue("-1");

  const migratedPayload = {
    v: 1,
    profile_id: "xtrans4",
    base_image_id: "portrait_v1",
    params: {
      ...baseParams,
      film_sim: "classic_neg",
      chrome_blue: "strong",
      clarity: 2,
      grain_size: "large",
    },
  };
  const migratedEncoded = encodeSharePayload(migratedPayload);
  await page.goto(`/?v=1&s=${migratedEncoded}`);

  await expect(
    page.getByText("Share link loaded and mapped to X-T5 / X-H2 / X-S20."),
  ).toBeVisible();
  await expect(page.getByLabel("Camera model selector")).toHaveValue("xtrans5");
  await expect(page.getByLabel("Clarity")).toHaveValue("2");
});

test("viewer interactions: hover zoom controls, hold-before preview, split drag", async ({
  page,
}) => {
  await page.goto("/");

  const viewport = page.getByTestId("viewer-viewport");
  const zoomControls = page.getByTestId("viewer-zoom-controls");

  await expect(zoomControls).toHaveCSS("opacity", "0");
  await viewport.hover();
  await expect(zoomControls).toHaveCSS("opacity", "1");

  await expect(page.getByTestId("viewer-before-layer")).toHaveCount(0);
  const viewportBox = await viewport.boundingBox();
  if (!viewportBox) {
    throw new Error("viewer viewport bounding box unavailable");
  }
  const pointerX = viewportBox.x + viewportBox.width * 0.5;
  const pointerY = viewportBox.y + viewportBox.height * 0.5;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await expect(page.getByTestId("viewer-before-layer")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("viewer-before-layer")).toHaveCount(0);

  const zoomValue = page.getByTestId("viewer-zoom-value");
  await expect(zoomValue).toContainText("1.00x");
  await page.getByTestId("viewer-zoom-in").click();
  const zoomAfterInText = (await zoomValue.textContent()) ?? "0x";
  const zoomAfterIn = Number(zoomAfterInText.replace("x", ""));
  expect(zoomAfterIn).toBeGreaterThan(1);
  await page.getByTestId("viewer-zoom-reset").click();
  await expect(zoomValue).toContainText("1.00x");

  await page.getByRole("button", { name: "Split Screen: Off" }).click();
  const splitDivider = page.getByTestId("viewer-split-divider");
  await expect(splitDivider).toBeVisible();

  const readSplitPercent = async () => {
    const leftStyle = await splitDivider.evaluate(
      (node) => (node as HTMLElement).style.left,
    );
    return Number.parseFloat(leftStyle.replace("%", ""));
  };

  const splitBefore = await readSplitPercent();
  const splitDividerBox = await splitDivider.boundingBox();
  if (!splitDividerBox) {
    throw new Error("split divider bounding box unavailable");
  }
  const splitY = splitDividerBox.y + splitDividerBox.height * 0.5;
  await page.mouse.move(splitDividerBox.x + splitDividerBox.width * 0.5, splitY);
  await page.mouse.down();
  await page.mouse.move(
    splitDividerBox.x + splitDividerBox.width * 0.5 + 120,
    splitY,
  );
  await page.mouse.up();

  const splitAfter = await readSplitPercent();
  expect(splitAfter).toBeGreaterThan(splitBefore + 5);
});

test("viewer keyboard accessibility: focus controls, zoom keys, hold-before key", async ({
  page,
}) => {
  await page.goto("/");

  const viewport = page.getByTestId("viewer-viewport");
  const zoomControls = page.getByTestId("viewer-zoom-controls");
  const zoomValue = page.getByTestId("viewer-zoom-value");

  await expect(zoomControls).toHaveCSS("opacity", "0");
  await viewport.focus();
  await expect(zoomControls).toHaveCSS("opacity", "1");

  await expect(zoomValue).toContainText("1.00x");
  await page.keyboard.press("Equal");
  const zoomAfterInText = (await zoomValue.textContent()) ?? "0x";
  const zoomAfterIn = Number(zoomAfterInText.replace("x", ""));
  expect(zoomAfterIn).toBeGreaterThan(1);

  await page.keyboard.press("Digit0");
  await expect(zoomValue).toContainText("1.00x");

  await expect(page.getByTestId("viewer-before-layer")).toHaveCount(0);
  await page.keyboard.down("Space");
  await expect(page.getByTestId("viewer-before-layer")).toBeVisible();
  await page.keyboard.up("Space");
  await expect(page.getByTestId("viewer-before-layer")).toHaveCount(0);
});

test("visual baseline for split divider and hover controls", async ({ page }) => {
  await page.goto("/");

  const viewport = page.getByTestId("viewer-viewport");
  await viewport.hover();
  await expect(page.getByTestId("viewer-zoom-controls")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Split Screen: Off" }).click();
  await page.waitForTimeout(250);

  await expect(viewport).toHaveScreenshot("viewer-split-hover-controls.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.03,
  });
});

test("preset gallery preview rendering stays responsive while chunking", async ({
  page,
  browserName,
}) => {
  await page.goto("/");

  await page.getByText("Preset Gallery (10)").click();
  const renderStatus = page.getByTestId("preset-render-status");
  await expect(renderStatus).toBeVisible();

  const highlightSlider = page.getByLabel("Highlight");
  await highlightSlider.fill("2");
  await expect(highlightSlider).toHaveValue("2");

  await expect(renderStatus).toContainText("Preview render ready");
  const chunkCount = Number((await renderStatus.getAttribute("data-chunk-count")) ?? "0");
  expect(chunkCount).toBeGreaterThan(1);

  const totalMs = Number((await renderStatus.getAttribute("data-total-ms")) ?? "0");
  const totalBudgetMs = browserName === "firefox" ? 3500 : 2500;
  expect(totalMs).toBeLessThan(totalBudgetMs);

  const maxBatchMs = Number((await renderStatus.getAttribute("data-max-chunk-ms")) ?? "0");
  const maxBatchBudgetMs = browserName === "firefox" ? 650 : 520;
  expect(maxBatchMs).toBeLessThan(maxBatchBudgetMs);
});

test("cloud sync push and pull via GitHub gist API", async ({ page }) => {
  const pulledSnapshot = {
    version: 1,
    exported_at: "2026-02-17T00:00:00.000Z",
    data: {
      recipes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Pulled Recipe",
          profile_id: "xtrans5",
          base_image_id: "night_v1",
          params: {
            film_sim: "classic_chrome",
            dynamic_range: "dr200",
            highlight: -1,
            shadow: 2,
            color: -1,
            chrome: "weak",
            chrome_blue: "off",
            clarity: 0,
            sharpness: 1,
            noise_reduction: -1,
            grain: "weak",
            grain_size: "small",
            wb: "auto",
            wb_kelvin: 5600,
            wb_shift: {
              a_b: 0,
              r_b: 0,
            },
          },
          created_at: "2026-02-17T00:00:00.000Z",
          updated_at: "2026-02-17T00:00:00.000Z",
          tags: [],
        },
      ],
      activeRecipeId: "11111111-1111-4111-8111-111111111111",
      recipeName: "Pulled Recipe",
      slots: {
        A: null,
        B: null,
      },
    },
  };

  let patchSeen = false;
  await page.route("https://api.github.com/gists/*", async (route) => {
    const request = route.request();

    if (request.method() === "PATCH") {
      patchSeen = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        files: {
          "fuji-recipes-sync-v1.json": {
            filename: "fuji-recipes-sync-v1.json",
            content: JSON.stringify(pulledSnapshot),
            truncated: false,
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Recipe name").fill("Cloud Candidate");
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByText("Cloud Sync (GitHub Gist)").click();
  await page.getByLabel("Gist ID").fill("gist-123");
  await page.getByLabel("Token").fill("token-123");

  await page.getByRole("button", { name: "Push Cloud" }).click();
  await expect(page.getByText("Cloud sync push complete")).toBeVisible();
  expect(patchSeen).toBe(true);

  await page.getByRole("button", { name: "Pull Cloud" }).click();
  await expect(page.getByText("Cloud sync pull complete (1 recipes).")).toBeVisible();
  await expect(page.getByPlaceholder("Recipe name")).toHaveValue("Pulled Recipe");
  await expect(page.getByLabel("Highlight")).toHaveValue("-1");
});

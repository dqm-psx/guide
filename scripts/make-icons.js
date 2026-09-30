#!/usr/bin/env node
/* Icon generator.

   Builds the app icons from the same Slime sprite the page ships, so the icon
   is the real monster art rather than a redraw. The sprite is nearest-neighbor
   scaled onto the guide's dark teal, which keeps the pixel art crisp.

   Uses the Playwright Chromium that the test suite already installs. The PNGs
   are committed, so the page, CI, and readers never run this; it exists so the
   icons can be regenerated:

       node scripts/make-icons.js                 # portrait sprite -> icons/
       SPRITE=overworld OUT=/tmp/icons node scripts/make-icons.js

   Not part of any build step. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const SPRITE = process.env.SPRITE === "overworld" ? "overworld" : "portrait";
const OUT_DIR = process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROOT, "icons");
const SIZES = [32, 180, 192, 512];
const BACKGROUND = "#163143";
const CONTENT_RATIO = 0.76;

// Read the shipped data files exactly as a browser would: classic scripts that
// assign a global. This keeps the icon in step with the data, with no copy.
function loadData() {
  const context = vm.createContext({});
  for (const file of ["data/overworld-sprites.js", "data/monster-sprites.js", "data/breeding-data.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return context;
}

// Look the monster up by name instead of hardcoding a table position.
function slimeIndex(data) {
  const species = data.DATA.species.find(entry => entry.name === "Slime" && entry.family === "Slime");
  if (!species) throw new Error("could not find the Slime species in data/breeding-data.js");
  return species.index;
}

(async () => {
  const data = loadData();
  const index = slimeIndex(data);
  const set = SPRITE === "overworld" ? data.OVERWORLD_SPRITES : data.MONSTER_SPRITES;
  const src = set[index];
  if (!src) throw new Error(`no ${SPRITE} sprite for species index ${index}`);

  const browser = await chromium.launch();
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        '<!doctype html><meta charset="utf-8">' +
        "<style>" +
        "html,body{margin:0;background:transparent}" +
        `#icon{width:${size}px;height:${size}px;border-radius:${(116 / 512 * 100).toFixed(2)}%;` +
        `background:${BACKGROUND};display:grid;place-items:center}` +
        `#icon img{display:block;width:${CONTENT_RATIO * 100}%;height:auto;image-rendering:pixelated}` +
        "</style>" +
        `<div id="icon"><img alt="" src="${src}"></div>`
      );
      const target = path.join(OUT_DIR, `icon-${size}.png`);
      await page.screenshot({ path: target, omitBackground: true });
      await page.close();
      console.log(`wrote ${target} (${SPRITE} sprite, species index ${index})`);
    }
  } finally {
    await browser.close();
  }
})();

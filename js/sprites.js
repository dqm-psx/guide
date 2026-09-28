"use strict";
const SPRITE_STYLE_KEY = "dqm-guide-sprite-style-v1";
let spriteStyle = "portrait";
try { if (localStorage.getItem(SPRITE_STYLE_KEY) === "overworld") spriteStyle = "overworld"; } catch {}
function spriteKind(index) {
  return spriteStyle === "overworld" && OVERWORLD_SPRITES[index] ? "overworld" : "portrait";
}
function spriteSource(index) {
  return spriteKind(index) === "overworld" ? OVERWORLD_SPRITES[index] : MONSTER_SPRITES[index];
}
function spriteMarkup(index) {
  const src = spriteSource(index);
  return src ? '<span class="monster-sprite" aria-hidden="true"><img data-monster-index="'+Number(index)+'" data-sprite-kind="'+spriteKind(index)+'" src="'+src+'" alt="" decoding="async"></span>' : '';
}
function spriteLabel(index, text) {
  return '<span class="monster-label">'+spriteMarkup(index)+'<span>'+escapeHTML(text)+'</span></span>';
}
function updateSpriteControls() {
  document.querySelectorAll("button[data-sprite-style]").forEach(button => {
    button.setAttribute("aria-pressed",String(button.dataset.spriteStyle === spriteStyle));
  });
}
function setSpriteStyle(style) {
  if (style !== "portrait" && style !== "overworld") return;
  spriteStyle = style;
  try { localStorage.setItem(SPRITE_STYLE_KEY,style); } catch {}
  document.querySelectorAll("img[data-monster-index]").forEach(img => {
    const index = Number(img.dataset.monsterIndex);
    img.src = spriteSource(index);
    img.dataset.spriteKind = spriteKind(index);
  });
  updateSpriteControls();
}
document.querySelectorAll("button[data-sprite-style]").forEach(button => {
  button.addEventListener("click",() => setSpriteStyle(button.dataset.spriteStyle));
});
updateSpriteControls();


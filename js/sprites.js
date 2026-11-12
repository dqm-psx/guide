"use strict";
const SPRITE_STYLE_KEY = "dqm-guide-sprite-style-v1";
let spriteStyle = "portrait";
try { if (localStorage.getItem(SPRITE_STYLE_KEY) === "overworld") spriteStyle = "overworld"; } catch {}
function spriteKind(index) {
  return spriteStyle === "overworld" && SPRITE_IMAGES.overworld[index] ? "overworld" : "portrait";
}
function spriteGraphic(index, kind = spriteKind(index), className = "") {
  const frame = SPRITE_IMAGES[kind]?.[index];
  if (!frame) return "";
  return '<img alt="" class="'+className+'" data-monster-index="'+Number(index)+'" data-sprite-kind="'+kind+
    '" src="'+frame.src+'" width="'+frame.width+'" height="'+frame.height+'" loading="lazy" decoding="async">';
}
function spriteMarkup(index) {
  const graphic = spriteGraphic(index);
  return graphic ? '<span class="monster-sprite" aria-hidden="true">'+graphic+'</span>' : '';
}
function spriteLabel(index, text) {
  const id = Number(index);
  const safeText = String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  if (!Number.isInteger(id) || id < 0) return '<span class="monster-label">'+safeText+'</span>';
  return '<a class="monster-label monster-link" href="#monster?id='+id+'">'+spriteMarkup(id)+'<span>'+safeText+'</span></a>';
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
  document.querySelectorAll(".monster-sprite > [data-monster-index]").forEach(graphic => {
    const index = Number(graphic.dataset.monsterIndex);
    graphic.outerHTML = spriteGraphic(index);
  });
  updateSpriteControls();
}
document.querySelectorAll("button[data-sprite-style]").forEach(button => {
  button.addEventListener("click",() => setSpriteStyle(button.dataset.spriteStyle));
});
updateSpriteControls();


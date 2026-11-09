/* Read-only PSX memory card import. SaveFile and SaveMonster are packed by
   SLPM-87050 at 0x80024c80 and restored at 0x8002667c. The game's checksum
   routine is 0x800278d0. No player/master name or card image leaves the reader. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DQMSaveImport = api;
})(globalThis, function () {
  "use strict";
  const BLOCK = 8192, CARD = BLOCK * 16, FRAME = 128;
  const CAMPAIGNS = ["DQM1 · Terry", "DQM2 · Cobi", "DQM2 · Tara"];
  const signature = "DQM1/2 MAIN SAVE BLOCK BY YOK\0";
  const acceptedSizes = [BLOCK, BLOCK + FRAME, CARD];
  // The patch uses 00–09 for digits, 0a–23 for capitals and 40–59 for
  // lowercase. Omit a nickname if any glyph has no verified equivalent.
  const punctuation = new Map([
    [0x24, " "], [0x27, "-"], [0x28, "."], [0x29, ","], [0x2a, "?"], [0x2b, "!"],
    [0x2c, "~"], [0x2d, "&"], [0x2e, "*"], [0x30, ":"], [0x31, "○"], [0x32, "×"],
    [0x33, "△"], [0x34, "□"], [0x35, "/"], [0x3b, "+"], [0x3c, "♂"], [0x3d, "♀"],
    [0x5a, "'"], [0x5b, '"'], [0x5c, "("], [0x5d, ")"], [0x5e, ";"], [0x5f, "%"],
    [0x60, "="], [0x61, "["], [0x62, "]"], [0x63, "#"], [0x64, "@"], [0x65, "_"],
  ]);

  function nickname(bytes) {
    let name = "";
    for (const code of bytes) {
      if (code === 0xff) break;
      if (code <= 9) name += String.fromCharCode(48 + code);
      else if (code <= 0x23) name += String.fromCharCode(65 + code - 10);
      else if (code >= 0x40 && code <= 0x59) name += String.fromCharCode(97 + code - 0x40);
      else if (punctuation.has(code)) name += punctuation.get(code);
      else return null;
    }
    return name.trim();
  }

  function readBlock(bytes, speciesByCode, slot) {
    if (bytes[0] !== 0x53 || bytes[1] !== 0x43 || bytes[3] !== 1 ||
        !Array.from(signature).every((ch, i) => ch.charCodeAt(0) === bytes[0x100 + i])) {
      throw new Error("This block does not contain a DQM1+2 PlayStation save.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let sum = 0;
    for (let i = 0; i < 0x1fe8; i++) {
      if ((i < 0x120 || i >= 0x124) && i !== 0x1fc7) sum += bytes[i];
    }
    if (view.getUint32(0x120, true) !== sum) throw new Error("The save checksum is invalid.");
    const variant = bytes[0x12c] & 3;
    if (variant >= CAMPAIGNS.length || variant !== ((bytes[0x171] >> 2) & 3)) {
      throw new Error("The save has an unrecognized campaign.");
    }
    const count = bytes[0x150] & 3;
    const packedParty = view.getUint16(0x14c, true);
    const party = Array.from({length: count}, (_, i) => (packedParty >> (5 * i)) & 31);
    if (new Set(party).size !== count || party.some(i => i >= 30 || bytes[0x250 + 136 * i + 0x7c] === 0xff)) {
      throw new Error("The saved party references an invalid roster slot.");
    }
    const entries = [];
    const skipped = {eggs: 0, unavailable: 0, unsupported: 0};
    let unreadableNames = 0;
    // The game returns the party to its ranch slots before writing. Rebuild
    // party order from the saved indices, without double-counting members.
    const slots = [...party, ...Array.from({length: 50}, (_, i) => i).filter(i => !party.includes(i))];
    for (const i of slots) {
      const at = 0x250 + i * 136;
      if (bytes[at + 0x7c] === 0xff) continue;
      const flags = view.getUint16(at + 0x1c, true);
      if (flags & 0xc000) { skipped.eggs++; continue; }
      if (!(flags & 0x3000) || (flags & 0x0300)) { skipped.unavailable++; continue; }
      const packed = view.getUint32(at + 4, true);
      const speciesIndex = speciesByCode.get(packed & 0x3ff);
      if (speciesIndex === undefined) { skipped.unsupported++; continue; }
      const name = nickname(bytes.subarray(at + 0x81, at + 0x86));
      if (name === null) unreadableNames++;
      entries.push({
        speciesIndex, nickname: name || "", sex: packed & (1 << 17) ? "female" : "male",
        plus: (packed >>> 10) & 127, level: (packed >>> 18) & 127,
        location: party.includes(i) ? "party" : "farm",
      });
    }
    return {slot, campaign: CAMPAIGNS[variant], game: variant === 0 ? "dqm1" : "dqm2",
      hours: view.getUint16(0x124, true), minutes: bytes[0x126], entries, unreadableNames, skipped};
  }

  function directorySlot(frame) {
    const name = String.fromCharCode(...frame.subarray(10, 30));
    const match = /^BISLPM-87050DQM-S(0[1-9]|1[0-5])\x00$/.exec(name);
    return match ? Number(match[1]) : null;
  }

  function read(input, species) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const byCode = new Map(species.filter(s => s.index < 315 && s.playable === true)
      .map(s => [(s.member << 4) | s.family_id, s.index]));
    if (bytes.length === BLOCK) return {saves: [readBlock(bytes, byCode, null)], errors: []};
    if (bytes.length === BLOCK + FRAME) {
      const slot = directorySlot(bytes);
      if (!slot || bytes[0] !== 0x51) throw new Error("This single-save export has no active DQM1+2 entry.");
      return {saves: [readBlock(bytes.subarray(FRAME), byCode, slot)], errors: []};
    }
    if (bytes.length !== CARD || bytes[0] !== 0x4d || bytes[1] !== 0x43) {
      throw new Error("Choose a raw 128 KiB PlayStation memory card, an 8 KiB DQM save block, or a single-save .mcs export.");
    }
    const saves = [], errors = [];
    for (let i = 1; i < 16; i++) {
      const frame = bytes.subarray(i * FRAME, (i + 1) * FRAME);
      const slot = directorySlot(frame);
      if (frame[0] !== 0x51 || slot === null) continue;
      try {
        const dir = new DataView(frame.buffer, frame.byteOffset, FRAME);
        if (dir.getUint32(4, true) !== BLOCK || dir.getUint16(8, true) !== 0xffff ||
            frame.reduce((xor, b) => xor ^ b, 0) !== 0) throw new Error("The card directory entry is damaged.");
        saves.push(readBlock(bytes.subarray(i * BLOCK, (i + 1) * BLOCK), byCode, slot));
      } catch (error) {
        errors.push("Slot " + slot + " — " + error.message);
      }
    }
    if (!saves.length) throw new Error(errors.join(" ") || "No active DQM1+2 saves were found on this card.");
    return {saves: saves.sort((a, b) => a.slot - b.slot), errors};
  }
  return {acceptedSizes, read};
});

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
  const statKeys = ['hp', 'mp', 'attack', 'defense', 'agility', 'intelligence'];
  const statOffsets = [0xa2, 0xa6, 0xa8, 0xaa, 0xac, 0xae];
  const campaignKeys = ['terry', 'cobi', 'tara'];
  // Family widths in the save codec (SLPM-87050, 0x80010424) include member zero.
  const collectionWidths = [27, 32, 33, 28, 28, 27, 31, 28, 33, 33, 36];
  function bits(bytes, at, first, count) {
    let value = 0;
    for (let bit = 0; bit < count; bit++) value |= ((bytes[at + ((first + bit) >> 3)] >> ((first + bit) & 7)) & 1) << bit;
    return value;
  }
  function planningDetails(bytes, at, entry, variant, byCode, reference, flags) {
    const currentHp = bits(bytes, at + 8, 0, 10), currentMp = bits(bytes, at + 8, 10, 10);
    const baseStats = Object.fromEntries(statKeys.map((key, i) => {
      const value = bits(bytes, at + 0x0c + Math.floor(i / 2) * 4, (i % 2) * 10, 10);
      return [key, value <= 999 ? value : null];
    }));
    const resistances = [];
    for (let word = 0; word < 4; word++) for (let i = 0; i < 4; i++) resistances.push(bits(bytes, at + 8 + word * 4, 20 + i * 3, 3));
    for (let i = 0; i < 6; i++) resistances.push(bits(bytes, at + 0x18, 13 + i * 3, 3));
    for (let i = 0; i < 5; i++) resistances.push(bits(bytes, at + 0x1c, 16 + i * 3, 3));
    const levelCap = bits(bytes, at + 4, 25, 7), accessory = bits(bytes, at + 0x18, 8, 5);
    // Save data stores two full parent identities and four shorter grandparent records.
    // A zero family-member number is the game's empty ancestor sentinel.
    const pedigree = Array.from({length: 6}, (_, index) => {
      const parent = index < 2;
      const bit = parent ? index * 18 : 36 + (index - 2) * 11;
      const member = bits(bytes, at + 0x72, bit, 6);
      if (!member) return null;
      const speciesIndex = byCode.get((member << 4) | bits(bytes, at + 0x72, bit + 6, 4)) ?? null;
      const sex = bits(bytes, at + 0x72, bit + (parent ? 17 : 10), 1) ? 'female' : 'male';
      if (!parent) return {speciesIndex, sex};
      const nameAt = at + 0x68 + index * 5;
      return {speciesIndex, sex, plus: bits(bytes, at + 0x72, bit + 10, 7),
        nickname: nickname(bytes.subarray(nameAt, nameAt + 5)) || ''};
    });
    const trait = offset => (bytes[at + offset] + 64) >> 7;
    const equipmentId = accessory === 31 ? null : accessory + 64;
    const battleStats = {...baseStats};
    let knownSkills = null, inheritedSkills = null;
    if (reference?.schemaVersion === 1) {
      const natural = reference.naturalSkills[variant === 0 ? 'terry' : 'dqm2'];
      const indices = [entry.speciesIndex, pedigree[0]?.speciesIndex, pedigree[1]?.speciesIndex];
      const pool = indices.flatMap(index => natural[index] || [null, null, null]).map((id, i) => {
        const delta = bits(bytes, at + 0x40, i * 3, 3);
        return delta === 4 ? 0 : id === null ? null : (id + delta) & 255;
      }).concat(Array.from(bytes.subarray(at + 0x48, at + 0x58)));
      if (pool.every(id => Number.isInteger(id) && id >= 0 && id <= 169)) inheritedSkills = [...new Set(pool.filter(Boolean))];
      const learned = [];
      for (let i = 0; i < 8; i++) {
        const selector = bits(bytes, at + 0x20, i * 5, 5) | (bits(bytes, at + 0x45, i, 1) << 5);
        if (selector === 63) continue;
        const table = bytes[at + 0x86] & (1 << i) ? reference.specialSkills : pool;
        learned.push(table[selector]);
      }
      if (learned.every(id => Number.isInteger(id) && id >= 1 && id <= 169)) knownSkills = [...new Set(learned)];
    }
    if (equipmentId !== null) {
      const equipment = reference?.accessories.find(row => row.itemId === equipmentId);
      const index = equipment && statOffsets.indexOf(equipment.offset);
      if (!equipment || equipment.offset !== 0 && equipment.offset !== 0xb2 && (index < 0 || equipment.minimum !== equipment.maximum)) {
        for (const key of statKeys) battleStats[key] = null;
      } else if (index >= 0 && battleStats[statKeys[index]] !== null) {
        const key = statKeys[index];
        battleStats[key] = Math.max(0, Math.min(999, battleStats[key] + equipment.minimum));
      }
    }
    return {schemaVersion: 1, speciesIndex: entry.speciesIndex, level: entry.level, plus: entry.plus,
      campaign: campaignKeys[variant], location: entry.location,
      trainingLocation: entry.location === 'party' ? 'party' : flags & 0x1000 ? 'hibernation' : 'farm',
      levelCap: levelCap >= entry.level && levelCap <= 99 ? levelCap : null,
      currentHp: currentHp <= 999 ? currentHp : null, currentMp: currentMp <= 999 ? currentMp : null,
      experience: bits(bytes, at + 0x58, 0, 24), experienceToNext: bits(bytes, at + 0x5b, 0, 24),
      personalityId: 27 - trait(0x25) * 9 - trait(0x26) - trait(0x27) * 3,
      wildness: bytes[at + 0x18], pedigree,
      baseStats, battleStats, equipmentId, resistances, knownSkills, inheritedSkills};
  }
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

  function generatedKeyName(key, reference = globalThis.SAVE_REFERENCE) {
    if (!key?.appraised) return null;
    const prefix = reference?.keys?.prefixes[key.prefix];
    const noun = reference?.keys?.nouns[key.noun];
    return prefix && noun ? prefix + ' ' + noun + ' Key' : null;
  }

  function savedKeys(bytes, view, reference) {
    const fixed = [];
    for (let id = 0; id < 12; id++) {
      // Both first world headers exist before Warubou actually gives the keys.
      if (bits(bytes, 0x1ef0, Math.max(0, id - 1), 1)) fixed.push(id);
    }
    const generated = [];
    for (let slot = 12; slot < 32; slot++) {
      const at = 0x1ce0 + slot * 16;
      const type = bits(bytes, at + 4, 14, 2);
      if (type !== 1 && type !== 3) continue;
      const key = {slot: slot - 11, appraised: type === 3, prefix: null, noun: null};
      if (key.appraised) {
        const tier = Math.floor(bits(bytes, at + 4, 0, 7) / 10);
        const weights = reference?.keys?.weights[tier];
        const noun = bits(bytes, at + 4, 7, 7);
        if (weights && reference.keys.nouns[noun]) {
          // First RNG call after resetting to the key's seed, at 0x800391e4.
          const state = (Math.imul(view.getUint16(at, true), 0x41c64e6d) + 12345) >>> 0;
          let roll = (((state >>> 16) * 65535) >>> 16) % 100;
          key.prefix = weights.findIndex(weight => (roll -= weight) < 0);
          key.noun = noun;
        }
      }
      generated.push(key);
    }
    const appraised = generated.filter(key => key.appraised).length;
    return {fixed, generated, appraised, mysterious: generated.length - appraised};
  }

  function adventureLog(bytes, view, variant, speciesByCode, reference) {
    const bag = new Map();
    const bagSize = Math.min(30, bits(bytes, 0x150, 2, 5));
    for (let slot = 0; slot < bagSize; slot++) {
      const id = bits(bytes, 0x157, slot * 7, 7);
      if (id) bag.set(id, (bag.get(id) || 0) + 1);
    }
    const vault = [];
    // SaveFile packs 100 pairs, but only the first 97 belong to item storage.
    for (let slot = 0; slot < 97; slot++) {
      const itemId = bits(bytes, 0x172, slot * 7, 7);
      if (!itemId) break;
      const quantity = bits(bytes, 0x1ca, slot * 7, 7);
      if (quantity) vault.push({itemId, quantity});
    }
    const librarySpecies = [];
    let start = 0;
    for (const [family, width] of collectionWidths.entries()) {
      for (let member = 1; member < width; member++) {
        const index = speciesByCode.get((member << 4) | family);
        if (index !== undefined && index < 312 && bits(bytes, 0x222, start + member, 1)) librarySpecies.push(index);
      }
      start += width;
    }
    const keys = variant === 0 ? null : savedKeys(bytes, view, reference);
    const arenaClasses = variant === 0
      ? [[1,'g'],[2,'f'],[3,'e'],[4,'d'],[6,'c'],[7,'b'],[8,'a'],[9,'s']]
      : [[0x1b,'kids'],[0x1c,'c'],[0x1d,'b'],[0x1e,'a'],[0x1f,'s']];
    const arenaWins = arenaClasses.filter(([flag]) => bits(bytes, 0x1ef0, flag, 1)).map(([,rank]) => rank);
    // Scene restoration can replace the descriptor for story-dependent towns
    // and generated worlds. Only offer a fixed descriptor to the named atlas.
    const scene = view.getUint16(0x1f14, true);
    const fixedScene = scene > 0 && scene < 0x8000 && ![10,12,13,14,15,16,111,112,166,177,178].includes(scene);
    const savedMap = fixedScene ? {scene, area: bytes[0x1f16]} : null;
    return {schemaVersion: 1, hours: view.getUint16(0x124, true), minutes: bytes[0x126],
      completed: Boolean(bytes[0x12c] & 4), gold: bits(bytes, 0x14c, 15, 17), bankGold: bits(bytes, 0x150, 12, 20),
      depositedMedals: bytes[0x1f38], bag: Array.from(bag, ([itemId, quantity]) => ({itemId, quantity})),
      vault, librarySpecies, keys, arenaWins, ...(savedMap ? {savedMap} : {})};
  }

  function readBlock(bytes, speciesByCode, extraSpeciesByCode, slot, reference) {
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
    const allSpeciesByCode = new Map([...speciesByCode, ...extraSpeciesByCode]);
    const eggs = [];
    const extraMonsters = [];
    const skipped = {eggs: 0, unavailable: 0, unsupported: 0};
    let unreadableNames = 0;
    // The game returns the party to its ranch slots before writing. Rebuild
    // party order from the saved indices, without double-counting members.
    const slots = [...party, ...Array.from({length: 50}, (_, i) => i).filter(i => !party.includes(i))];
    for (const i of slots) {
      const at = 0x250 + i * 136;
      if (bytes[at + 0x7c] === 0xff) continue;
      const flags = view.getUint16(at + 0x1c, true);
      if (flags & 0xc000) {
        const identity = view.getUint32(at + 4, true);
        eggs.push({speciesIndex: speciesByCode.get(identity & 0x3ff) ?? extraSpeciesByCode.get(identity & 0x3ff) ?? null, plus: (identity >>> 10) & 127,
          sex: flags === 0x4000 ? (identity & (1 << 17) ? 'female' : 'male') : null});
        skipped.eggs++;
        continue;
      }
      if (!(flags & 0x3000) || (flags & 0x0300)) { skipped.unavailable++; continue; }
      const packed = view.getUint32(at + 4, true);
      const speciesIndex = allSpeciesByCode.get(packed & 0x3ff);
      if (speciesIndex === undefined) {
        skipped.unsupported++;
        continue;
      }
      const name = nickname(bytes.subarray(at + 0x81, at + 0x86));
      if (name === null) unreadableNames++;
      const entry = {
        speciesIndex, nickname: name || "", sex: packed & (1 << 17) ? "female" : "male",
        plus: (packed >>> 10) & 127, level: (packed >>> 18) & 127,
        location: party.includes(i) ? "party" : "farm",
      };
      entry.saveDetails = planningDetails(bytes, at, entry, variant, allSpeciesByCode, reference, flags);
      if (extraSpeciesByCode.has(packed & 0x3ff)) {
        extraMonsters.push({...entry, location:entry.saveDetails.trainingLocation});
        skipped.unsupported++;
      } else {
        entries.push(entry);
      }
    }
    const log = {...adventureLog(bytes, view, variant, speciesByCode, reference), eggs, extraMonsters,
      unavailable: skipped.unavailable, unidentified: skipped.unsupported - extraMonsters.length};
    return {slot, campaign: CAMPAIGNS[variant], campaignKey: campaignKeys[variant], game: variant === 0 ? "dqm1" : "dqm2",
      hours: log.hours, minutes: log.minutes, adventureLog: log, entries, unreadableNames, skipped};
  }

  function directorySlot(frame) {
    const name = String.fromCharCode(...frame.subarray(10, 30));
    const match = /^BISLPM-87050DQM-S(0[1-9]|1[0-5])\x00$/.exec(name);
    return match ? Number(match[1]) : null;
  }

  function read(input, species, reference = globalThis.SAVE_REFERENCE) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const byCode = new Map(species.filter(s => s.index < 315 && s.playable === true)
      .map(s => [(s.member << 4) | s.family_id, s.index]));
    const extraByCode = new Map(species.filter(s => s.index >= 315 && s.member > 0 && Number.isInteger(s.family_id))
      .map(s => [(s.member << 4) | s.family_id, s.index]));
    if (bytes.length === BLOCK) return {saves: [readBlock(bytes, byCode, extraByCode, null, reference)], errors: []};
    if (bytes.length === BLOCK + FRAME) {
      const slot = directorySlot(bytes);
      if (!slot || bytes[0] !== 0x51) throw new Error("This single-save export has no active DQM1+2 entry.");
      return {saves: [readBlock(bytes.subarray(FRAME), byCode, extraByCode, slot, reference)], errors: []};
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
        saves.push(readBlock(bytes.subarray(i * BLOCK, (i + 1) * BLOCK), byCode, extraByCode, slot, reference));
      } catch (error) {
        errors.push("Slot " + slot + " — " + error.message);
      }
    }
    if (!saves.length) throw new Error(errors.join(" ") || "No active DQM1+2 saves were found on this card.");
    return {saves: saves.sort((a, b) => a.slot - b.slot), errors};
  }
  return {acceptedSizes, get fixedKeyNames() { return (globalThis.SAVE_REFERENCE?.keys?.fixed || []).map(name => name + ' Key'); },
    generatedKeyName, read};
});

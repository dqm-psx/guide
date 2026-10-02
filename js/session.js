/* DQM-guide reference session: remembers the pair finder's parents, filters,
   and recent pairings across reloads, the way teams and plans are remembered.
   localStorage only, defensive, no DOM. Load after js/storage.js and before
   js/reference.js. A shared URL (see js/reference.js) takes precedence over
   whatever this module holds. */
(function (root) {
  "use strict";

  const KEY = "dqm-guide-reference-session-v1";
  const VERSION = 1;
  const MAX_RECENT = 6;
  const storage = root.DQMStorage ? root.DQMStorage.create() : null;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const asIndex = value => (Number.isInteger(value) && value >= 0) ? value : null;
  const asText = value => (typeof value === "string" ? value : "");
  const asBool = value => value === true;

  /** Coerce anything read from storage into the one accepted shape. */
  function normalize(raw) {
    const source = isRecord(raw) ? raw : {};
    const pair = isRecord(source.pair) ? source.pair : {};
    const parent = value => {
      const entry = isRecord(value) ? value : {};
      return { family: asText(entry.family), search: asText(entry.search) };
    };
    const reverse = isRecord(source.reverse) ? source.reverse : {};
    const species = isRecord(source.species) ? source.species : {};
    const recent = Array.isArray(source.recent)
      ? source.recent
        .map(item => ({ a: asIndex(item && item.a), b: asIndex(item && item.b) }))
        .filter(item => item.a !== null && item.b !== null)
        .slice(0, MAX_RECENT)
      : [];
    return {
      version: VERSION,
      pair: { a: asIndex(pair.a), b: asIndex(pair.b) },
      pedigree: parent(source.pedigree),
      mate: parent(source.mate),
      target: asIndex(source.target),
      reverse: {
        pedigreeFamily: asText(reverse.pedigreeFamily),
        mateFamily: asText(reverse.mateFamily),
        search: asText(reverse.search),
      },
      species: {
        search: asText(species.search),
        family: asText(species.family),
        favoritesOnly: asBool(species.favoritesOnly),
      },
      showInternal: asBool(source.showInternal),
      recent,
    };
  }

  function load() {
    if (!storage) return normalize(null);
    const text = storage.read(KEY);
    if (typeof text !== "string" || text === "") return normalize(null);
    try {
      return normalize(JSON.parse(text));
    } catch (error) {
      return normalize(null);
    }
  }

  function save(session) {
    if (!storage) return false;
    try {
      return storage.write(KEY, JSON.stringify(normalize(session)));
    } catch (error) {
      return false;
    }
  }

  function clear() {
    if (storage) storage.remove(KEY);
  }

  root.DQMSession = Object.freeze({ KEY, VERSION, MAX_RECENT, normalize, load, save, clear });
})(globalThis);

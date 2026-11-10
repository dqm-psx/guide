/* Used by the guide and by the standalone article builder. */
globalThis.DQMCharacterDialogue = {
  markup(row, escape, questLinks, hideDialogue = false) {
    if (row.kind !== 'npc') return '';
    const scenes = CHARACTER_DIALOGUE.entries[row.id];
    const quests = questLinks.length ? '<section class="character-quests"><h3>Quests</h3><ul>' +
      questLinks.map(link => '<li>' + link + '</li>').join('') + '</ul></section>' : '';
    if (!scenes?.length) return quests;
    const count = scenes.reduce((n, scene) => n + scene.passages.length, 0);
    const title = row.id === 'npc-surabou' ? 'When ' + row.title + ' joins' : 'Dialogue';
    const groups = scenes.map(scene => {
      const passages = '<ul class="spoken-lines">' + scene.passages.map(text => '<li>' + escape(text) + '</li>').join('') + '</ul>';
      if (scenes.length === 1) return '<h4>' + escape(scene.place) + '</h4>' + passages;
      return '<details><summary>' + escape(scene.place) + ' (' + scene.passages.length + ')</summary>' + passages + '</details>';
    }).join('');
    return quests + '<details class="character-dialogue"' + (!hideDialogue && count <= 10 ? ' open' : '') + '><summary>' +
      escape(title) + ' (' + count + ')</summary>' + groups + '</details>';
  }
};

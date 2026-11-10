# Dragon Quest Monsters 1 & 2 PSX Player Guide

Walkthroughs, maps, monster profiles and breeding tools for the English PlayStation patch. Follow Terry through GreatTree or Cobi and Tara through GreatLog.

**[Open the Player Guide](https://dqm-psx.github.io/guide/)** · [English patch release](https://anonymous.4open.science/r/DQM-1-2-PSX-translation-D1FC/README.txt) · [Translation editions](https://dqm-psx.github.io/translations/)

| I want to… | Open |
| --- | --- |
| Find the next gate, key or boss | [Terry walkthrough](https://dqm-psx.github.io/guide/walkthroughs/terry/) · [Cobi and Tara walkthrough](https://dqm-psx.github.io/guide/walkthroughs/cobi-tara/) |
| See which gates an arena class opens or which towns a world key connects | [Terry’s gates](https://dqm-psx.github.io/guide/#field-guide?kind=location&game=dqm1) · [Cobi & Tara’s worlds](https://dqm-psx.github.io/guide/#field-guide?kind=location&game=dqm2) |
| Find a quest, its requirements or the person to speak to | [Quests](https://dqm-psx.github.io/guide/#field-guide?kind=quest) · [Characters and dialogue](https://dqm-psx.github.io/guide/#field-guide?kind=npc) |
| Look up an item, skill or gameplay question | [Guide home](https://dqm-psx.github.io/guide/#field-guide) |
| Follow a doorway or see which monsters appear on a floor | [Map atlas](https://dqm-psx.github.io/guide/#atlas) |
| Find a monster’s locations, parents, stats, skills and library text | [Monster library](https://dqm-psx.github.io/guide/#species-index) |
| Check two parents or find recipes for a first copy | [Breeding lookup](https://dqm-psx.github.io/guide/#pair-finder) |
| Plan several generations or compare many pairs | [Breeding tree](https://dqm-psx.github.io/guide/#breeding-tree) · [Breeding table](https://dqm-psx.github.io/guide/#breeding-table) |
| See what my own monsters can breed | [Import a save in My game](https://dqm-psx.github.io/guide/#team-planner?import=save) |

## Bring your own team

Choose a 128 KiB PlayStation memory card, an 8 KiB Adventure Log or a single-save MCS export. Preview the slot, then choose **Create team from save** to open Team breeding. You can also add monsters by hand. Your save stays on your device. Use the backup controls in **My game** to move teams and plans between browsers.

## Names and offline use

Search accepts English names, abbreviated menu names, Japanese and alternate names. **Settings** contains the story spoiler switch, extra monster slots (including Aibou), sprite style, theme, and **Download guide for offline use**. Once downloaded, the atlas and breeding tools work without a connection. You can also download this repository and open `index.html` directly.

Names and library text follow the public translation export, checked every four hours. The [Sources & coverage page](https://dqm-psx.github.io/guide/#sources) distinguishes current wording from gameplay verified against a specific disc release.

## Development

Run `npm ci`, `npx playwright install chromium`, and `npm test`. To preview the publishable site, run `node scripts/sync-stage-site.js` and serve `site-dist/` with a static web server.

[Maintenance and gameplay verification](docs/maintaining-guide.md) · [Translation sync](docs/translation-sync.md)

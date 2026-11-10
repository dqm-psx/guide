# Current patch names and PSX monster reference

`data/monster-reference.js` adds the monster encyclopedia and overlays the guide's
names before the application starts. Native species indices stay unchanged, so
saved teams, breeding matrices, form identities, and shared links survive a name
change. Search aliases retain the original guide name and the public snapshot's
Current, Game Boy, Delocalized, and Vibecoded spellings. These aliases do not
change the gameplay rules to those of another game.

## Automatic publication

The **Refresh translation names and publish guide** workflow runs on `main`
pushes, every four hours, and manually. For this workflow to publish, set the
repository's **Settings → Pages → Build and deployment → Source** to
**GitHub Actions**, and allow the `github-pages` environment to deploy `main`.
No private repository checkout, private token, or new repository secret is
required in the guide. The workflow uses the existing public
[translation export](https://github.com/dqm-psx/translations) after it receives
updates from the patch project.

Each build resolves the public translation repository's full commit SHA and
downloads `comparison-data.json` and `source-manifest.json` from that same commit.
The comparison's SHA-256, revision, schema, row count, source identity, and
required coverage are validated before any output is replaced. The exporter
selects explicit public wording fields; it never copies the full comparison,
source evidence, filesystem paths, user information, or arbitrary metadata into
the guide. It does not execute any code from the translation repository.

The same public snapshot supplies item and skill names and aliases, map titles,
character names, and reviewed place and character references in walkthroughs.
Character dialogue uses the speaker and scene assignments in
`scripts/character-dialogue-bindings.json`. The sync resolves those IDs against
the current English export and rebuilds `data/character-dialogue.js`.
New scenes or changes to who speaks a line need a review of the assignment.
The handbook binds these names to native system slots and translation records.
The publisher checks the source identity and expected context before applying
each binding. Authored articles, image assets and release-specific verification
receipts are versioned in the guide repository.

The workflow first refreshes names, captions, guide wording, fixed-encounter
labels, and the current patch summary, then packages the site on a lightweight
runner. Before starting a browser job, it compares the result with the last
successful deployment:

| Change | Publication checks |
| --- | --- |
| No changed source, public revision, or packaged contents | Skip the browser job and deployment |
| Updated public wording or release metadata | Unit/data checks and focused browser checks against the packaged site |
| Changed application, tooling, or tests; unavailable or invalid previous-deployment metadata | Complete suite against the checked-in snapshot, then unit/data and packaged browser checks after refresh |

The browser job checks out the exact guide commit selected during preparation
and refreshes from the same pinned public revision. Both source and packaged
content fingerprints must match preparation before that artifact can deploy.
The small public `deployment-manifest.json` records only the schema, guide and
public revisions, and source/content hashes. It is published with the artifact,
so comparison uses a successful deployment rather than the checked-in generated
bundle. The manifest itself is excluded from the content hash.

Documentation-only PRs retain the required successful `test` check without
running browsers; documentation-only main pushes do not trigger publication.
Other PRs run the complete suite, with no duplicate main-branch CI workflow.
Browser jobs use the official Playwright container; its version must match the
repository's pinned Playwright dependency.

Only browser assets and the public deployment manifest are uploaded. A failed
translation download, changed schema, incomplete catalog, or failing check stops
publication and leaves the previous Pages deployment intact. GitHub schedule
delays and the upstream translation publication delay can extend the four-hour
interval. Inactive repositories may have scheduled workflows disabled by GitHub;
a manual run resumes publication.

Publication gives each script, stylesheet, and icon a URL containing its content
hash, and records the same URLs in the offline cache. Changed data therefore
gets a new URL even for a returning browser controlled by an older service
worker. The packaged worker's cache version follows the application contents;
online requests revalidate the HTTP cache and retain the refreshed files for
offline visits. Open tabs receive the new version on their next navigation or
reload.

The generated runtime bundle is part of each deployed artifact. Scheduled runs
do not make Git commits or pull requests, and do not require write access to
repository contents. The checked-in bundle remains a usable offline snapshot;
refresh it when preparing a source release:

```sh
node scripts/sync-monster-reference.js
npm run test:unit
node scripts/sync-stage-site.js
npm run test:publication
```

The publication checks use the staged copy and its refreshed data. For code
changes, run the relevant local tests while iterating and let PR CI run the
complete suite; repeated full local runs are unnecessary after unchanged checks
pass.

To reproduce a specific public snapshot:

```sh
node scripts/sync-monster-reference.js --public-revision FULL_40_CHARACTER_COMMIT
```

For a downloaded pair of source files, use `--source-dir PATH` together with
`--public-revision`. `--check` compares without writing, and `--output PATH`
selects a different generated bundle. The source revision and date shown in the
guide describe the translation export, not when a player last opened the page.

## Current release metadata

The private patch project's existing publisher also exports a small
`current_patch` object in the public source manifest. It reads the latest stable
release, validates its tag's source commit and standard Current-edition ZIP,
and publishes only the version, edition, UTC publication date, source revision,
and package SHA-256. Publishing or editing a stable release triggers that
upstream workflow; no private release URL, author, description, or filesystem
path is copied to the guide. The guide reads this object from the same pinned
public commit as its wording snapshot, validates its exact schema, and keeps it
separate from the translation revision and gameplay verification.

The original implementation synchronized wording automatically but did not
export a patch-version label or refresh gameplay. Historical snapshots without
`current_patch` remain readable; the guide does not invent a release version
from their date or commit. A failed or incomplete upstream publication cannot
silently advance the public guide's reported version.

## Gameplay and wording are separate

`data/monster-baseline.json` retains the authenticated PSX v1.0.61 native
extraction, with stable species IDs and source hashes. It includes all 315
standard species' base level limits, six growth arrays, and natural skill IDs.
Every growth array has 99 entries: a level-up to level **N** uses entry **N−1**.
Total base gain from level 1 to N is `gains.slice(1, N)` summed. These are species
gains, not an individual monster's final stats. Starting/inherited stats,
accessories, and individual level limits affect actual results. Recruitment can
vary the base level limit by ±2, and breeding also changes it.

The native library has 312 entries. Ramia, Dimension Dragon, and Hide-and-seek
have no entry in that table. The guide keeps that absence explicit. Species
resistance meanings remain unverified and are not filled with Game Boy values.
Locations cover named fixed gate/world encounters and wandering-master teams;
an empty list does not establish that a monster is breeding-only. Bosses, gifts,
random magic-key worlds, and other special encounters are not comprehensively
cataloged.

The current wording sync does **not** claim to re-extract gameplay from each new
patch. A native rule/layout change needs a reviewed baseline update. The source
hashes and native addresses in the baseline document its evidence; translation
dates never relabel old gameplay facts as freshly verified.

`data/gameplay-verification.json` records a separate check against a specific
release-matched patched disc. The v1.0.73 check covers all 106,276 ordered matrix
outcomes, native special-rule and breeding-context code, 317 stat profiles
(315 standard species), natural skill IDs, and 312 library identity mappings.
The proof binds the package checksum, patched-disc checksum, source commit, and
the exact baseline and breeding data hashes. The generator rejects a proof if
those data hashes or coverage counts no longer match.
If a release is reissued under the same version with a different source commit
or package checksum, publication also stops until its proof is reviewed.

This proof does not reverify encounter/acquisition coverage or resistance
meanings. A future automatic release or wording update leaves the last gameplay
verification version unchanged until another authenticated disc check succeeds.
The historical extraction label remains v1.0.61; it describes where the data
originated, while the separate verification identifies the later checked patch.

The optional verifier checks all native growth values, natural skill IDs, base
limits, and 312 caption-to-species mappings against the authenticated original
Japanese SLPM-87050 disc. It uses only local read-only input and writes no game
assets:

```sh
python scripts/sync-verify-native.py --bin /path/to/original-japanese.bin
```

The accepted original image has SHA-256
`a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29`.
Its native parameter code/table guards match the extraction's source evidence.
There are 317 verified parameter rows including two additional internal slots;
315 belong to the standard roster. Internal placeholders remain distinct.

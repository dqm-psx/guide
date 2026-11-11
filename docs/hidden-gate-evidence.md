# Hidden Gate and the retained Nameless Place scene

Hidden Gate is retained, unused gate data, with no normal hub entrance or
working final boss event. The original Japanese game and the authenticated
Current v1.0.73 patch have the same portal dispatchers, gate definition, empty
terminal event setup and inactive terminal map grid. A retained internal gate
selector can pass gate ID 32 to the constructor; that does not establish a
normal gameplay unlock. These checks do not claim that forced or debug access
is impossible.

Reproduce the read-only checks with:

```sh
python scripts/audit-hidden-gate.py --original-bin ORIGINAL.bin --current-bin CURRENT_V1_0_73.bin
python scripts/audit-hidden-gate-access.py --bin ORIGINAL.bin --bin CURRENT_V1_0_73.bin
```

The helper authenticates both complete images before reading their native
tables. It prints only identities, addresses, counts and hashes, and writes no
game assets. The original and Current disc hashes are respectively
`a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` and
`c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812`.

## Ordinary entrances and retained internal selector

The access audit scans the resident executable and all 6,025 archive resources
for direct MIPS calls, jumps and embedded addresses referencing gate entry.
Both authenticated editions have exactly 13 calls to portal constructor
`0x8006A784`: four in resource 5630 (town), two in 5661 (arena), two in 5671
(bazaar), two in 5688 (farm), and three in 5698 (gate chamber). Every call is
covered by the independently verified native dispatchers in
`build-gate-entrances.py`. Their table entries and immediate arguments cover
gate IDs 1–31, with no ID 32. Farm's two map layouts share one gate.

The other entry path is resident `0x8006A6A4`, called by VM callback
`0x8003F22C`. That callback reads the selection byte, adds one and starts the
selected gate. Its only embedded address reference is in the retained resident
menu script at `0x800B3AD0`–`0x800B3AFA`, which opens the 32-entry gate-name
list. The list includes Hidden Gate. This is internal selector code; a normal
gameplay route to this menu has not been established. The script and its entry
callbacks are byte-identical between the original and checked English patch.

The native constructor itself does not reject gate ID 32. The reconstructed
Rust `dungeon_entry::prepare` limit of 1–31 is a host-side validation policy,
not evidence that the original executable rejects 32. The conclusion is
therefore **unused in normal play**, not that its data cannot be forced to run.
The direct-reference scan is not a proof against arbitrary indirect calls or
modified save state.

## Native records

- The name comes from the Japanese game: **かくしのとびら**, translated as
  **Hidden Gate**. It is not an invented guide title. Catalog row
  `m_exe_09202c` binds the four context labels at original executable offsets
  `0x92088`, `0x9209B`, `0x920AF` and `0x920C3` (contexts `0x7A`–`0x7D`).
  The standalone gate-list name is at `0x93AD3`, in row `m_exe_093a7c`.
  Current v1.0.73 translates those names while retaining the 31–39F label.
  Their encounter resources 1576, 1579, 1582 and 1585 are byte-identical in
  the original Japanese and checked English images.
- The 32nd four-byte gate definition at executable address
  `0x800A85D4 + 31*4` is `[15, 50, 15, 15]` in both images. Its final-floor
  value is **50**, giving 49 ordinary generated floors if the definition is
  selected. The encounter progression row at `0x800A8820 + 31*16` contains
  `(1,122), (11,123), (21,124), (31,125)`, then a zero terminator. Native selector
  `0x8003EB44` returns the last context whose threshold is at most the floor.
  Context 125 consequently applies to 31–49F before the terminal floor, if
  this unused definition is selected. The native text label saying 31–39F is
  inconsistent with these settings. It is not a 39-floor limit.
- The terminal descriptor at resource 18 address `0x80117068 + 31*16` selects
  scene 101, area 0, native map group 15/entry 30. This is `map-101-0`, whose
  title record is `s00288800_0000` (Nameless Place).
- Native scene 101 resolves to resource 102. Its script directory at resource
  offset 4 points to offset 8, whose single script target is offset `0x0c`.
  That target starts with opcode `00`, the stopping instruction, with no
  dialogue or battle setup before it. The adjacent pointer is null.
- Neither the original nor the translated resource contains a call to the
  normal fixed-battle entry point `0x80042220`.
- The scene's native map descriptor is at resource offset 25088. Its 20×15
  event grid has only event opcode zero. There is no grid-triggered doorway,
  interaction or fight attached to the blue ring shown in the map image.
  The grid is identical in both versions, with SHA-256
  `ac94dd9ad36251ac09907df53f2716045f9810c0ea66e885507e464aad8a64d1`.

The original resource has SHA-256
`50be69ce92739ec34aef1bc8b7203d0e34c1ae3fcc937513a08c9a9f50643ed3`;
the translated resource has SHA-256
`73833087863c0462b3ea9eff27fbd4b77865e1ba5a113573752017c2ca94868b`.
Across the original resource body, the only differences are the allocation-size
operand at `0x5848` and the translated text offsets beginning at `0x6220`, plus
the resource checksum. Translated text is appended. The patch has not added an
event program to make this scene into a functioning confrontation.

## Retained text does not establish a fight

The unused dialogue records `s00288800_0055`, `009d`, `0115` and `01d7` belong
to Darkdrium. They include a challenge, a repeat challenge and a refusal to
join followed by a clue about rebirth through breeding. Those are retained
messages; the scene does not call them. The narration at `0016` and Watabou's
lines at `032c` are separate speakers and must not be included as Darkdrium's
own dialogue.

The terminal descriptor also retains encounter context 159, resource 4603,
formation 1. Its native identity bytes are `0A 10`: family 10/member 16,
**Deathmore (index 305)**. Darkdrium is family 10/member 19 (`0A 13`, index 308).
There is no scene call to this retained formation. Neither its identity nor
its numerical parameters should be presented as a verified Darkdrium fight.

The guide's previous assertion that the Nameless Place encounter “can be
fought” was unsupported. The character page should label these lines as unused
dialogue, and the gate page should identify unused content with no normal
entrance rather than give players a supposed hidden unlock requirement.

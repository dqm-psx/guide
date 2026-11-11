# Gate character assignments

These relationships use the native scene and actor identities, so changing a
gate or character's translated name does not change its map or article URL.

## Laura — Swamp Cave

`npc-laura` belongs to `map-72-0`, the final area of
`location-townsperson-s-gate`. Native scene resource 73 identifies actor 2 at
definition offset `0x5C48`; its talk selector at offset `0x10` reaches the
princess's conversation. Slot 102 contains her explicit self-introduction.
The character audit joins that speaking actor to sprite resource 4116, texture
slot 2. The 32 × 32 portrait has SHA-256
`841461021d227349ad998fa5d3383e7b2ae21d61913588701946ba343f8b55a3`.

`scripts/build-npc-sprites.py` verifies the self-identification, native actor
definition, talk pointer, sprite assignment and artwork bytes against the
authenticated v1.0.73 disc before producing the portrait.

The ten spoken records in `scripts/character-dialogue-bindings.json` are
`s001b5000_0058`, `_008e`, `_009d`, `_00c2`, `_00e1`, `_0107`, `_017d`,
`_01ed`, `_0210` and `_0310`. The intervening `_0148` record narrates Terry's
attempt to lift the princess and is deliberately excluded from her dialogue.
Dragon's lines and Watabou's return message are separate speakers.

The title binding extracts Laura's name from `_0310`. The normal translation
sync refreshes the displayed name and all ten passages from the same public
snapshot.

## Healie — Bottom of the Old Well

`npc-healie` belongs to `map-71-0`, the Departure Gate's final area. Native
scene resource 72 and the existing fixed-encounter generation record identify
this encounter; its reviewed transcript is already bound on Healie's page.
The character uses its verified species portrait. The explicit link back to
`location-departure-gate` makes this encounter reachable in both directions.

Other existing characters retain their reviewed `map_ids`. Shared entrance
rooms are not evidence that every character there belongs to every gate.

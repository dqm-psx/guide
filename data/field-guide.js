globalThis.FIELD_GUIDE = {
  "schema_version": 1,
  "provenance": {
    "source_url": "https://github.com/dqm-psx/translations/tree/e5097e6e9403abda92130144b44488c84bfcb0e3",
    "source_label": "PSX English patch text and item records",
    "public_revision": "e5097e6e9403abda92130144b44488c84bfcb0e3",
    "translation_revision": "a5b29b8686d49453f5a47c0dbef7b326a2bf810a",
    "patch_version": "v1.0.73",
    "disc_sha256": "c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812",
    "release_url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73",
    "scope": "Item attributes, base prices and 18 fixed-town shop inventories and Terry’s gate shop checked against the v1.0.73 PSX disc. Town stock can change with story progress. The item directory also covers story gifts, arena rewards, fixed chests and random Magic Key treasure.",
    "source_ids_note": "Item and dialogue IDs identify rows in the public translation catalog. PSX shop IDs identify the archive scene and byte offset of a stock list.",
    "skill_requirements": "Minimum level and stats for 169 PSX skill-learning records, checked against v1.0.73. Species, inheritance and skill evolution determine eligibility."
  },
  "entries": [
    {
      "id": "item-1",
      "kind": "item",
      "game": "both",
      "title": "Medicinal Herb",
      "category": "Consumable",
      "summary": "Restores 30–40 HP to one ally.",
      "details": [
        "Cobi / Tara: Mom gives you one at the farm. Terry can receive one at GreatTree Castle; leave space in your bag for the gift.",
        "Single use.",
        "Terry shops sell it for 10 G (9 G with a Gold Pass). GreatTree / Bazaar · Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 10 G (9 G with a Gold Pass). GreatLog / Main Street · Port Ritz Town · Assia."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0937",
        "m_exe_08b68c",
        "s003d6000_35cb",
        "s0ac3d800_35fb",
        "s0ac3d800_3621",
        "PSX shop 5671/8",
        "PSX shop 134/8",
        "PSX shop 142/4",
        "PSX shop 2162/4",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "MedHerb"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10,
          "gold_pass": 9,
          "locations": [
            "GreatTree / Bazaar",
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10,
          "gold_pass": 9,
          "locations": [
            "GreatLog / Main Street",
            "Port Ritz Town",
            "Assia"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-2",
      "kind": "item",
      "game": "both",
      "title": "Amor Water",
      "category": "Consumable",
      "summary": "Restores 60–70 HP to one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 50 G (45 G with a Gold Pass). GreatTree / Bazaar · Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 50 G (45 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo · Northden Town · Pei Town · Port Ritz Town · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e093c",
        "m_exe_08b6a8",
        "PSX shop 5671/8",
        "PSX shop 122/8",
        "PSX shop 134/8",
        "PSX shop 135/8",
        "PSX shop 136/8",
        "PSX shop 138/8",
        "PSX shop 142/16",
        "PSX shop 142/4",
        "PSX shop 149/8",
        "PSX shop 154/8",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "AmorWater"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "GreatTree / Bazaar",
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo",
            "Northden Town",
            "Pei Town",
            "Port Ritz Town",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-3",
      "kind": "item",
      "game": "both",
      "title": "Yggdrasil Dew",
      "category": "Consumable",
      "summary": "Fully restores every ally’s HP.",
      "details": [
        "Single use.",
        "Terry shops sell it for 500 G (450 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 500 G (450 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo · Pei Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0944",
        "m_exe_08b6c4",
        "PSX shop 5671/21",
        "PSX shop 122/8",
        "PSX shop 134/24",
        "PSX shop 135/8",
        "PSX shop 138/8"
      ],
      "availability": "shop",
      "aliases": [
        "YggDew"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 500,
          "gold_pass": 450,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 500,
          "gold_pass": 450,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo",
            "Pei Town"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-4",
      "kind": "item",
      "game": "both",
      "title": "Magic Water",
      "category": "Consumable",
      "summary": "Restores 20–30 MP to one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 200 G (180 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 200 G (180 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo · Pei Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e094e",
        "m_exe_08b6dc",
        "PSX shop 5671/21",
        "PSX shop 122/8",
        "PSX shop 134/24",
        "PSX shop 135/8",
        "PSX shop 138/8"
      ],
      "availability": "shop",
      "aliases": [
        "MagicWatr"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 200,
          "gold_pass": 180,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 200,
          "gold_pass": 180,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo",
            "Pei Town"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-5",
      "kind": "item",
      "game": "both",
      "title": "Elfin Elixir",
      "category": "Consumable",
      "summary": "Fully restores one ally’s MP.",
      "details": [
        "Single use.",
        "Cobi / Tara shops sell it for 2,000 G (1,800 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0957",
        "m_exe_08b6f8",
        "PSX shop 134/40"
      ],
      "availability": "shop",
      "aliases": [
        "ElfinElix"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 2000,
          "gold_pass": 1800,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-6",
      "kind": "item",
      "game": "both",
      "title": "Antidote Herb",
      "category": "Consumable",
      "summary": "Cures poison in one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 4 G (3 G with a Gold Pass). GreatTree / Bazaar · Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 4 G (3 G with a Gold Pass). GreatLog / Main Street · Northden Town · Port Ritz Town · Assia."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0961",
        "m_exe_08b70c",
        "PSX shop 5671/8",
        "PSX shop 134/8",
        "PSX shop 136/8",
        "PSX shop 142/16",
        "PSX shop 142/4",
        "PSX shop 2162/4",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "Antidote"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 4,
          "gold_pass": 3,
          "locations": [
            "GreatTree / Bazaar",
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 4,
          "gold_pass": 3,
          "locations": [
            "GreatLog / Main Street",
            "Northden Town",
            "Port Ritz Town",
            "Assia"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-7",
      "kind": "item",
      "game": "both",
      "title": "Moonwort",
      "category": "Consumable",
      "summary": "Cures paralysis in one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 20 G (18 G with a Gold Pass). Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 20 G (18 G with a Gold Pass). GreatLog / Main Street · Northden Town · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0968",
        "m_exe_08b720",
        "PSX shop 134/24",
        "PSX shop 136/8",
        "PSX shop 149/8",
        "PSX shop 154/8",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "GreatLog / Main Street",
            "Northden Town",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-8",
      "kind": "item",
      "game": "both",
      "title": "Laurel Leaf",
      "category": "Consumable",
      "summary": "Lifts a curse from one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 20 G (18 G with a Gold Pass). Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 20 G (18 G with a Gold Pass). GreatLog / Main Street · Nofo · Northden Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e096f",
        "m_exe_08b734",
        "PSX shop 134/24",
        "PSX shop 135/20",
        "PSX shop 136/8",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "LaurelLf"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "GreatLog / Main Street",
            "Nofo",
            "Northden Town"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-9",
      "kind": "item",
      "game": "both",
      "title": "Awakening Powder",
      "category": "Consumable",
      "summary": "Wakes up one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 20 G (18 G with a Gold Pass). Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 20 G (18 G with a Gold Pass). GreatLog / Main Street · Port Ritz Town · Assia."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0976",
        "m_exe_08b748",
        "PSX shop 134/24",
        "PSX shop 142/16",
        "PSX shop 142/4",
        "PSX shop 2162/4",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "AwakePwdr"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "GreatLog / Main Street",
            "Port Ritz Town",
            "Assia"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-10",
      "kind": "item",
      "game": "both",
      "title": "Angel Bell",
      "category": "Consumable",
      "summary": "Cures one ally’s confusion.",
      "details": [
        "Single use.",
        "Terry shops sell it for 20 G (18 G with a Gold Pass). Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 20 G (18 G with a Gold Pass). GreatLog / Main Street · Nofo · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e097d",
        "m_exe_08b75c",
        "PSX shop 134/24",
        "PSX shop 135/8",
        "PSX shop 149/8",
        "PSX shop 154/8",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "AngelBell"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "GreatLog / Main Street",
            "Nofo",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAy0lEQVR42s2UsQ3CQAxFbxTalJRZgZIyI6RlhKxAyQgpaRnhSlpGSElr9A++9KGKbZCwZF0Uxe/O//xTyj/FvivG/Aqsxf1ot3mXhwIA0FJHq9MmB+z63pCXoTQY1jAQoNN5trpcG9StoQqPJGwYDw3oBqEd5rR9vgvBqA+ER1IrQl2toZA3iLHgaKwGKoQAheHZDUQBP0Z7nzBXyzyhDinWEOzNSi+t9KTcJAREAYsUqpu4/al2IiRlfr1xQtPm5zxyqFPm/9kPNBoPImE5PI6LoLkAAAAASUVORK5CYII="
    },
    {
      "id": "item-11",
      "kind": "item",
      "game": "both",
      "title": "Sage's Stone",
      "category": "Reusable item",
      "summary": "Restores about 60 HP to every ally.",
      "details": [
        "GreatTree’s bazaar describes it as a party heal that can be used several times before it breaks.",
        "Can be reused until it breaks.",
        "Terry shops sell it for 1,000 G (900 G with a Gold Pass). GreatTree / Bazaar."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0984",
        "m_exe_08b774",
        "s0afae000_09c1",
        "PSX shop 5671/21"
      ],
      "availability": "shop",
      "aliases": [
        "SageStone"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 1000,
          "gold_pass": 900,
          "locations": [
            "GreatTree / Bazaar"
          ]
        }
      ],
      "related": [
        "item-3"
      ]
    },
    {
      "id": "item-12",
      "kind": "item",
      "game": "both",
      "title": "Yggdrasil Leaf",
      "category": "Consumable",
      "summary": "Revives one ally.",
      "details": [
        "Single use.",
        "Terry shops sell it for 1,000 G (900 G with a Gold Pass). GreatTree / Bazaar · Travelers’ Gate item-shop floor.",
        "Cobi / Tara shops sell it for 1,000 G (900 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e098c",
        "m_exe_08b790",
        "PSX shop 5671/21",
        "PSX shop 122/8",
        "PSX shop 134/40",
        "PSX shop 135/20",
        "PSX shop 117/655853"
      ],
      "availability": "shop",
      "aliases": [
        "YggLeaf"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 1000,
          "gold_pass": 900,
          "locations": [
            "GreatTree / Bazaar",
            "Travelers’ Gate item-shop floor"
          ]
        },
        {
          "game": "dqm2",
          "buy": 1000,
          "gold_pass": 900,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-13",
      "kind": "item",
      "game": "both",
      "title": "Strength Seed",
      "category": "Consumable",
      "summary": "Raises one ally’s Attack by 3.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0994",
        "m_exe_08b7a4"
      ],
      "availability": "event",
      "aliases": [
        "StrSeed"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-14",
      "kind": "item",
      "game": "both",
      "title": "Defense Seed",
      "category": "Consumable",
      "summary": "Raises one ally’s Defense by 3.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e099b",
        "m_exe_08b7c0"
      ],
      "availability": "event",
      "aliases": [
        "DefSeed"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-15",
      "kind": "item",
      "game": "both",
      "title": "Agility Seed",
      "category": "Consumable",
      "summary": "Raises one ally’s Agility by 3.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09a2",
        "m_exe_08b7dc"
      ],
      "availability": "event",
      "aliases": [
        "AgiSeed"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-16",
      "kind": "item",
      "game": "both",
      "title": "Wisdom Seed",
      "category": "Consumable",
      "summary": "Raises one ally’s Wisdom by 3.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09aa",
        "m_exe_08b7f4"
      ],
      "availability": "event",
      "aliases": [
        "WisSeed"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-17",
      "kind": "item",
      "game": "both",
      "title": "Life Nut",
      "category": "Consumable",
      "summary": "Raises one ally’s maximum HP by 5.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09b2",
        "m_exe_08b80c"
      ],
      "availability": "event",
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-18",
      "kind": "item",
      "game": "both",
      "title": "Mystic Nut",
      "category": "Consumable",
      "summary": "Raises one ally’s maximum MP by 5.",
      "details": [
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09ba",
        "m_exe_08b828"
      ],
      "availability": "event",
      "aliases": [
        "MysticNut"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA9ElEQVR42s2UsQ3CMBBFPQIjsAal12AEt5SUrMAIlF4jJWVWYIS0Qf/EN1/2YSUKQkQ62b7YL/+f7YTw6yfuw6yxGZRTmIdrtEB/NZgLxnya83lnoMf9ZoH+JQaLRWAqAgwAtNM0GBgBEN7bOL3BXSAVqTKFoaX6LpAwTFa7zAEGuIFVbXKgSHCiwhRerIpdtsdDBS2bIBNZR6rgZhDMMWAYN0Ba4uJi9aXIjo2oU5irkMVWVaquhjFHmKtQoVqCOlhLhbkbU9eQcH5AbRPW2P0ELTVKba6rzD0+qT0Sdbi1691lVcMbsUrdEvBXf2ObQX/zPAF0OsCrCuj+qwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-19",
      "kind": "item",
      "game": "both",
      "title": "Adventure Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being braver.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09c2",
        "m_exe_08b844",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "AdvenBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-20",
      "kind": "item",
      "game": "both",
      "title": "Scary Story Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being more timid.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09c9",
        "m_exe_08b85c",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "ScaryBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-21",
      "kind": "item",
      "game": "both",
      "title": "Kindness Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being kinder.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09d3",
        "m_exe_08b874",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "KindBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-22",
      "kind": "item",
      "game": "both",
      "title": "Slyness Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being more coldhearted.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09dd",
        "m_exe_08b88c",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "SlyBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-23",
      "kind": "item",
      "game": "both",
      "title": "Clear Mind Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being more thoughtful.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09e5",
        "m_exe_08b8a4",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "ClearBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-24",
      "kind": "item",
      "game": "both",
      "title": "Humor Book",
      "category": "Consumable",
      "summary": "Reading it steers the monster toward being more foolish.",
      "details": [
        "It can take more than one book to change a monster’s personality.",
        "Single use.",
        "Terry shops sell it for 10,000 G (9,000 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10,000 G (9,000 G with a Gold Pass). Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09ef",
        "m_exe_08b8bc",
        "s0afae000_1197",
        "PSX shop 5671/34",
        "PSX shop 135/33"
      ],
      "availability": "shop",
      "aliases": [
        "HumorBook"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10000,
          "gold_pass": 9000,
          "locations": [
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-25",
      "kind": "item",
      "game": "both",
      "title": "BeefJerky",
      "category": "Consumable",
      "summary": "Wins a monster over.",
      "details": [
        "The least effective of the four ordinary recruitment meats. Defeat the monster you want last.",
        "Single use.",
        "Terry shops sell it for 10 G (9 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 10 G (9 G with a Gold Pass). GreatLog / Main Street · Assia."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09f7",
        "m_exe_08b8d4",
        "s0adf7000_5062",
        "s0b113000_09a2",
        "PSX shop 5671/8",
        "PSX shop 134/8",
        "PSX shop 2162/4"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 10,
          "gold_pass": 9,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 10,
          "gold_pass": 9,
          "locations": [
            "GreatLog / Main Street",
            "Assia"
          ]
        }
      ],
      "related": [
        "item-26",
        "item-27",
        "item-28"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAxElEQVR42t2UsQ2DQAxFGYGSkhVSpmSNlClpKRmBNiWrXMkIrJA1LvpI/2RZvtjQJZa+hHTyk+/jf03z93Xv+0ydanzcuqxFICqlPQ5FcxqHIgIBmJ5jXpbXoRBQwt7rdAjf89AWIOUCAUMjYXnfCpCTuh5KjySMklCcE3pqInlVCfsK5FQapieyYC6w5pkEuf5p36y/qiHuQuPQAoen0vHhkhJYu6KbRcSG8eGCWlELAzGVhFGWZ6HXohafyy/J5cafrA/KoXUnCsIa2wAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-26",
      "kind": "item",
      "game": "both",
      "title": "PorkChop",
      "category": "Consumable",
      "summary": "Wins a monster over.",
      "details": [
        "Stronger recruitment bait than BeefJerky. Rib and Sirloin are stronger still.",
        "Single use.",
        "Terry shops sell it for 40 G (36 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 40 G (36 G with a Gold Pass). GreatLog / Main Street · Nofo · Northden Town · Port Ritz Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e09fe",
        "m_exe_08b8e4",
        "s0adf7000_5062",
        "s0b113000_09a2",
        "PSX shop 5671/8",
        "PSX shop 134/8",
        "PSX shop 135/8",
        "PSX shop 136/8",
        "PSX shop 142/16",
        "PSX shop 142/4"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 40,
          "gold_pass": 36,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 40,
          "gold_pass": 36,
          "locations": [
            "GreatLog / Main Street",
            "Nofo",
            "Northden Town",
            "Port Ritz Town"
          ]
        }
      ],
      "related": [
        "item-25",
        "item-27",
        "item-28"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAxElEQVR42t2UsQ2DQAxFGYGSkhVSpmSNlClpKRmBNiWrXMkIrJA1LvpI/2RZvtjQJZa+hHTyk+/jf03z93Xv+0ydanzcuqxFICqlPQ5FcxqHIgIBmJ5jXpbXoRBQwt7rdAjf89AWIOUCAUMjYXnfCpCTuh5KjySMklCcE3pqInlVCfsK5FQapieyYC6w5pkEuf5p36y/qiHuQuPQAoen0vHhkhJYu6KbRcSG8eGCWlELAzGVhFGWZ6HXohafyy/J5cafrA/KoXUnCsIa2wAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-27",
      "kind": "item",
      "game": "both",
      "title": "Rib",
      "category": "Consumable",
      "summary": "Wins a monster over.",
      "details": [
        "Stronger bait than PorkChop. In GreatLog, Mom may ask you to bring her a Rib from the item shop.",
        "Single use.",
        "Terry shops sell it for 200 G (180 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 200 G (180 G with a Gold Pass). GreatLog / Main Street · Nofo · Northden Town · Pei Town · Port Ritz Town · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a05",
        "m_exe_08b8f4",
        "s0b113000_09a2",
        "s003d6000_3adb",
        "s003d6000_3afc",
        "PSX shop 5671/21",
        "PSX shop 134/24",
        "PSX shop 135/20",
        "PSX shop 136/8",
        "PSX shop 138/8",
        "PSX shop 142/16",
        "PSX shop 149/8",
        "PSX shop 154/8"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 200,
          "gold_pass": 180,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 200,
          "gold_pass": 180,
          "locations": [
            "GreatLog / Main Street",
            "Nofo",
            "Northden Town",
            "Pei Town",
            "Port Ritz Town",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "related": [
        "item-26",
        "item-28"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAxElEQVR42t2UsQ2DQAxFGYGSkhVSpmSNlClpKRmBNiWrXMkIrJA1LvpI/2RZvtjQJZa+hHTyk+/jf03z93Xv+0ydanzcuqxFICqlPQ5FcxqHIgIBmJ5jXpbXoRBQwt7rdAjf89AWIOUCAUMjYXnfCpCTuh5KjySMklCcE3pqInlVCfsK5FQapieyYC6w5pkEuf5p36y/qiHuQuPQAoen0vHhkhJYu6KbRcSG8eGCWlELAzGVhFGWZ6HXohafyy/J5cafrA/KoXUnCsIa2wAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-28",
      "kind": "item",
      "game": "both",
      "title": "Sirloin",
      "category": "Consumable",
      "summary": "Wins a monster over.",
      "details": [
        "The strongest of the four ordinary meats. Feed the target during battle and defeat it last. Mom can also request Sirloin for the GreatLog farm celebration.",
        "Single use.",
        "Terry shops sell it for 1,000 G (900 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 1,000 G (900 G with a Gold Pass). Hitano · GreatLog / Main Street · Pei Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a0c",
        "m_exe_08b904",
        "s0adf7000_5062",
        "s003d6000_3fa6",
        "s003d6000_407f",
        "PSX shop 5671/45",
        "PSX shop 122/8",
        "PSX shop 134/40",
        "PSX shop 138/8"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 1000,
          "gold_pass": 900,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 1000,
          "gold_pass": 900,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Pei Town"
          ]
        }
      ],
      "related": [
        "item-25",
        "item-26",
        "item-27"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAxElEQVR42t2UsQ2DQAxFGYGSkhVSpmSNlClpKRmBNiWrXMkIrJA1LvpI/2RZvtjQJZa+hHTyk+/jf03z93Xv+0ydanzcuqxFICqlPQ5FcxqHIgIBmJ5jXpbXoRBQwt7rdAjf89AWIOUCAUMjYXnfCpCTuh5KjySMklCcE3pqInlVCfsK5FQapieyYC6w5pkEuf5p36y/qiHuQuPQAoen0vHhkhJYu6KbRcSG8eGCWlELAzGVhFGWZ6HXohafyy/J5cafrA/KoXUnCsIa2wAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-29",
      "kind": "item",
      "game": "both",
      "title": "BadMeat",
      "category": "Consumable",
      "summary": "Field use lowers a living ally’s wildness.",
      "details": [
        "The PS1 menu describes poison. The field-use routine lowers wildness and leaves poison status unchanged.",
        "Warubou offers Terry his leftovers at the GreatTree Monster Farm. The scene gives no item for your bag."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a13",
        "m_exe_08b914",
        "s0b113000_3861"
      ],
      "availability": "unconfirmed",
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAxElEQVR42t2UsQ2DQAxFGYGSkhVSpmSNlClpKRmBNiWrXMkIrJA1LvpI/2RZvtjQJZa+hHTyk+/jf03z93Xv+0ydanzcuqxFICqlPQ5FcxqHIgIBmJ5jXpbXoRBQwt7rdAjf89AWIOUCAUMjYXnfCpCTuh5KjySMklCcE3pqInlVCfsK5FQapieyYC6w5pkEuf5p36y/qiHuQuPQAoen0vHhkhJYu6KbRcSG8eGCWlELAzGVhFGWZ6HXohafyy/J5cafrA/KoXUnCsIa2wAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-30",
      "kind": "item",
      "game": "dqm2",
      "title": "Starry Orb",
      "category": "Consumable",
      "summary": "Recruitment item that wins over an eligible monster.",
      "details": [
        "Tara’s medal exchange offers one for 2 Tiny Medals after the collector opens the exchange. The effect applies to an eligible recruitment target.",
        "Single use."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a1a",
        "m_exe_08b928",
        "m_exe_0aa8e0",
        "medal_0aadc0_02a3"
      ],
      "availability": "event",
      "aliases": [
        "StarryOrb"
      ],
      "related": [
        "item-44"
      ]
    },
    {
      "id": "item-31",
      "kind": "tool",
      "game": "both",
      "title": "Mommonja Tail",
      "category": "Reusable item",
      "summary": "Find the next gateway in Terry’s adventure or check a monster’s capture history.",
      "details": [
        "Terry: in a Travelers’ Gate it points toward the hole. In battle, it checks whether you have caught that monster before. Cobi / Tara: it checks whether you have caught the monster before.",
        "Unlimited uses.",
        "Terry shops sell it for 800 G (720 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 800 G (720 G with a Gold Pass). GreatLog / Main Street · Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a23",
        "m_exe_08b940",
        "s0afae000_0115",
        "s0adf7000_922d",
        "m_exe_08bf94",
        "PSX shop 5671/8",
        "PSX shop 134/40",
        "PSX shop 135/20"
      ],
      "availability": "shop",
      "aliases": [
        "MomTail"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 800,
          "gold_pass": 720,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 800,
          "gold_pass": 720,
          "locations": [
            "GreatLog / Main Street",
            "Nofo"
          ]
        }
      ],
      "related": [
        "item-40",
        "item-47"
      ]
    },
    {
      "id": "item-32",
      "kind": "item",
      "game": "both",
      "title": "Holy Water",
      "category": "Consumable",
      "summary": "Prevents monsters from appearing.",
      "details": [
        "Single use.",
        "Terry shops sell it for 100 G (90 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 100 G (90 G with a Gold Pass). Hitano · Pei Town."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a2d",
        "m_exe_08b95c",
        "PSX shop 5671/8",
        "PSX shop 122/8",
        "PSX shop 138/8"
      ],
      "availability": "shop",
      "aliases": [
        "HolyWater"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 100,
          "gold_pass": 90,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 100,
          "gold_pass": 90,
          "locations": [
            "Hitano",
            "Pei Town"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA6klEQVR42q3UoQ6DMBCAYR5jcpZH6CsgJ/sI2MnJSSxychLJKyAnsXuEydlbfrYjl26B0u6SSwOhH0cvR1FEhNt7IYt/BNBwF6nbUfa7Mh8Faa9P8b7PB0vnxFUH8fVxWrlORtkMdOk7IU5NM8NZKJvDzD7D7MrCKvls0CwQiOTsbo9xWrXKzbA2RDFSq9zcbdtdIEJB2+kolKmo3HmuTCMEFeX5RVRBpoJRs5/7BX7mexVUrBve88vYsXKf5IXkZhAIlB8DaWGLRoEhulRlVGMsqpmE6ajpJkWSzi9ELWwRhZLG8NefZg16AaDTiNf9T/rSAAAAAElFTkSuQmCC"
    },
    {
      "id": "item-33",
      "kind": "tool",
      "game": "both",
      "title": "Silver Harp",
      "category": "Reusable item",
      "summary": "Uses music to attract monsters.",
      "details": [
        "Unlimited uses.",
        "Terry shops sell it for 1,200 G (1,080 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 1,200 G (1,080 G with a Gold Pass). GreatLog / Main Street · Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a32",
        "m_exe_08b974",
        "PSX shop 5671/45",
        "PSX shop 134/40",
        "PSX shop 135/20"
      ],
      "availability": "shop",
      "aliases": [
        "SilvHarp"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 1200,
          "gold_pass": 1080,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 1200,
          "gold_pass": 1080,
          "locations": [
            "GreatLog / Main Street",
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-34",
      "kind": "item",
      "game": "both",
      "title": "Silence Staff",
      "category": "Reusable item",
      "summary": "A strange mist seals enemy magic.",
      "details": [
        "Can be reused until it breaks.",
        "Terry shops sell it for 700 G (630 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 700 G (630 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a3a",
        "m_exe_08b98c",
        "PSX shop 5671/21",
        "PSX shop 134/40"
      ],
      "availability": "shop",
      "aliases": [
        "HushStaff"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 700,
          "gold_pass": 630,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 700,
          "gold_pass": 630,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-35",
      "kind": "item",
      "game": "dqm2",
      "title": "Friendship Staff",
      "category": "Reusable item",
      "summary": "Doubles one ally's Attack.",
      "details": [
        "Can be reused until it breaks.",
        "Cobi / Tara shops sell it for 800 G (720 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a42",
        "m_exe_08b9a8",
        "PSX shop 134/40"
      ],
      "availability": "shop",
      "aliases": [
        "PalStaff"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 800,
          "gold_pass": 720,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-36",
      "kind": "item",
      "game": "both",
      "title": "Divine Staff",
      "category": "Reusable item",
      "summary": "Deals damage with a vacuum wave.",
      "details": [
        "The GreatTree bazaar compares its effect to Infernos.",
        "Can be reused until it breaks.",
        "Terry shops sell it for 1,500 G (1,350 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 1,500 G (1,350 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a4b",
        "m_exe_08b9c4",
        "s0afae000_0dd4",
        "PSX shop 5671/45",
        "PSX shop 134/40"
      ],
      "availability": "shop",
      "aliases": [
        "DivStaff"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 1500,
          "gold_pass": 1350,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 1500,
          "gold_pass": 1350,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-37",
      "kind": "item",
      "game": "both",
      "title": "Thunder Staff",
      "category": "Reusable item",
      "summary": "Deals damage with a lightning bolt.",
      "details": [
        "The GreatTree bazaar compares its effect to Bolt.",
        "Can be reused until it breaks.",
        "Terry shops sell it for 3,000 G (2,700 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 3,000 G (2,700 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a53",
        "m_exe_08b9e0",
        "s0afae000_0dd4",
        "PSX shop 5671/45",
        "PSX shop 134/40"
      ],
      "availability": "shop",
      "aliases": [
        "ThunStaff"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 3000,
          "gold_pass": 2700,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 3000,
          "gold_pass": 2700,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-38",
      "kind": "item",
      "game": "both",
      "title": "Blizzard Staff",
      "category": "Reusable item",
      "summary": "Deals damage with a blizzard.",
      "details": [
        "The GreatTree bazaar compares its effect to Freezing Blizzard.",
        "Can be reused until it breaks.",
        "Terry shops sell it for 4,000 G (3,600 G with a Gold Pass). GreatTree / Bazaar."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a5b",
        "m_exe_08b9f8",
        "s0afae000_0dd4",
        "PSX shop 5671/45"
      ],
      "availability": "shop",
      "aliases": [
        "BlizStaff"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 4000,
          "gold_pass": 3600,
          "locations": [
            "GreatTree / Bazaar"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-39",
      "kind": "item",
      "game": "both",
      "title": "Flame Staff",
      "category": "Reusable item",
      "summary": "Deals damage with flames.",
      "details": [
        "The GreatTree bazaar compares its effect to Scorch.",
        "Can be reused until it breaks.",
        "Terry shops sell it for 5,000 G (4,500 G with a Gold Pass). GreatTree / Bazaar."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a62",
        "m_exe_08ba10",
        "s0afae000_0dd4",
        "PSX shop 5671/45"
      ],
      "availability": "shop",
      "aliases": [
        "FireStaff"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 5000,
          "gold_pass": 4500,
          "locations": [
            "GreatTree / Bazaar"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-40",
      "kind": "tool",
      "game": "both",
      "title": "Return Staff",
      "category": "Consumable",
      "summary": "Warp to the gateway or the magic door shrine, depending on the campaign.",
      "details": [
        "Terry: warp directly to the dimensional gateway. Cobi / Tara: warp to the magic door shrine.",
        "Single use.",
        "Cobi / Tara shops sell it for 50 G (45 G with a Gold Pass). Hitano · Nofo · Northden Town · Pei Town · Port Ritz Town · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a69",
        "m_exe_08ba28",
        "s0adf7000_227b",
        "m_exe_08bf78",
        "PSX shop 122/8",
        "PSX shop 135/8",
        "PSX shop 136/8",
        "PSX shop 138/8",
        "PSX shop 142/16",
        "PSX shop 154/8"
      ],
      "availability": "shop",
      "aliases": [
        "RetnStaff"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "Hitano",
            "Nofo",
            "Northden Town",
            "Pei Town",
            "Port Ritz Town",
            "Eastoria"
          ]
        }
      ],
      "related": [
        "item-31",
        "item-41",
        "item-46"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-41",
      "kind": "tool",
      "game": "both",
      "title": "Chimera Wing",
      "category": "Consumable",
      "summary": "Return to your home kingdom from the field.",
      "details": [
        "Terry: return to GreatTree. Cobi / Tara: return to GreatLog.",
        "Single use.",
        "Terry shops sell it for 25 G (22 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 25 G (22 G with a Gold Pass). GreatLog / Main Street · Port Ritz Town · Wiston · Assia."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a70",
        "m_exe_08ba3c",
        "s003f6800_356e",
        "m_exe_08bf60",
        "PSX shop 5671/8",
        "PSX shop 134/8",
        "PSX shop 142/4",
        "PSX shop 149/8",
        "PSX shop 2162/4"
      ],
      "availability": "shop",
      "aliases": [
        "ChimWing"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 25,
          "gold_pass": 22,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 25,
          "gold_pass": 22,
          "locations": [
            "GreatLog / Main Street",
            "Port Ritz Town",
            "Wiston",
            "Assia"
          ]
        }
      ],
      "related": [
        "item-40",
        "item-42"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA2klEQVR42sWTsQ3DIBBFGSWty5Ss4NKlR3CbMqVLr5ARXKbNCJRpM4JXuOiIfvKFToKjCdIXCHSP/zk7hH+OOE5Skwt0u++SjqdYQ/ebgACVxZCeqa7bJkOM0gzjYmheLlkKgqpAhllxceZ2Z0WEqjDLXQlxR0VEzLx2NYLdcSEawHK7K924YuqYhpA/ToAsN00gwI60iM5lxGZICUzr6Qtldf34KH7MH6eQXuKGArSef1BI97DvgulQRyhmiMslx3ztY17jPfEMeNdmoLrhiLiEm9TVEO5qb5ffThfgbNoWjGIAAAAASUVORK5CYII="
    },
    {
      "id": "item-42",
      "kind": "tool",
      "game": "dqm2",
      "title": "Memory Bell",
      "category": "Consumable",
      "summary": "Returns to the entrance instantly.",
      "details": [
        "Single use.",
        "Cobi / Tara shops sell it for 50 G (45 G with a Gold Pass). Hitano · Nofo · Northden Town · Pei Town · Port Ritz Town · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a78",
        "m_exe_08ba54",
        "PSX shop 122/8",
        "PSX shop 135/8",
        "PSX shop 136/8",
        "PSX shop 138/8",
        "PSX shop 142/16",
        "PSX shop 149/8",
        "PSX shop 154/8"
      ],
      "availability": "shop",
      "aliases": [
        "MemBell"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "Hitano",
            "Nofo",
            "Northden Town",
            "Pei Town",
            "Port Ritz Town",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAy0lEQVR42s2UsQ3CQAxFbxTalJRZgZIyI6RlhKxAyQgpaRnhSlpGSElr9A++9KGKbZCwZF0Uxe/O//xTyj/FvivG/Aqsxf1ot3mXhwIA0FJHq9MmB+z63pCXoTQY1jAQoNN5trpcG9StoQqPJGwYDw3oBqEd5rR9vgvBqA+ER1IrQl2toZA3iLHgaKwGKoQAheHZDUQBP0Z7nzBXyzyhDinWEOzNSi+t9KTcJAREAYsUqpu4/al2IiRlfr1xQtPm5zxyqFPm/9kPNBoPImE5PI6LoLkAAAAASUVORK5CYII="
    },
    {
      "id": "item-43",
      "kind": "tool",
      "game": "both",
      "title": "Travel Bookmark",
      "category": "Consumable",
      "summary": "Lets you save progress anywhere.",
      "details": [
        "Use it to write to the adventure log while away from a usual save point.",
        "Single use.",
        "Terry shops sell it for 50 G (45 G with a Gold Pass). GreatTree / Bazaar.",
        "Cobi / Tara shops sell it for 50 G (45 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo · Port Ritz Town · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a80",
        "m_exe_08ba6c",
        "s0afae000_09c1",
        "PSX shop 5671/21",
        "PSX shop 122/8",
        "PSX shop 134/8",
        "PSX shop 134/24",
        "PSX shop 135/20",
        "PSX shop 142/4",
        "PSX shop 154/8"
      ],
      "availability": "shop",
      "aliases": [
        "Bookmark"
      ],
      "prices": [
        {
          "game": "dqm1",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "GreatTree / Bazaar"
          ]
        },
        {
          "game": "dqm2",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo",
            "Port Ritz Town",
            "Eastoria"
          ]
        }
      ]
    },
    {
      "id": "item-44",
      "kind": "item",
      "game": "both",
      "title": "Tiny Medal",
      "category": "Key item",
      "summary": "Collect these to trade for prizes.",
      "details": [
        "GreatTree’s Medal Man and GreatLog’s collector keep the medals you hand in. Clear space in the bag or farm before collecting a reward."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a87",
        "m_exe_08ba88",
        "s0ab53000_59ee",
        "s003f6800_0054",
        "medal_0aadc0_02f2",
        "medal_0aadc0_031e"
      ],
      "availability": "event",
      "aliases": [
        "TinyMedal"
      ],
      "related": [
        "item-30"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAnUlEQVR42mNgGAU0A0GaDP9xYbIMu7fG6z8K+Dbl/7uzWf/3RpFoKLphIENAfBgGGUy0ofhcBsMkGQpSgOwqfIaCaKINPNusgPAiFkNhriTOQKh3UMINzVCSDITFJLKByIbCDAPRRBkI8i42V8INBcqRFCnNhqiGgjAsTJENA6kjOunADAV5H2YIzJskGYZuKMyFyJhkw2iSl4c3AAD19X15fBuaKwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-45",
      "kind": "item",
      "game": "dqm2",
      "title": "Gold Pass",
      "category": "Key item",
      "summary": "Lowers the price of goods at shops.",
      "details": [
        "Carrying the pass sets the purchase rate to 90% of base price. The shop rounds each unit down to whole gold.",
        "Key item.",
        "Cobi / Tara shops sell it for 20,000 G (18,000 G with a Gold Pass). GreatLog / Main Street · Nofo."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a8f",
        "m_exe_08baa0",
        "s00434000_0309",
        "PSX shop 134/40",
        "PSX shop 135/20"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm2",
          "buy": 20000,
          "gold_pass": 18000,
          "locations": [
            "GreatLog / Main Street",
            "Nofo"
          ]
        }
      ]
    },
    {
      "id": "item-46",
      "kind": "tool",
      "game": "dqm2",
      "title": "GreatLog Branch",
      "category": "Consumable",
      "summary": "Moves the magic door shrine.",
      "details": [
        "Cobi / Tara: use it to move the magic door shrine to your chosen spot. The Return Staff warps back to that shrine.",
        "Single use.",
        "Cobi / Tara shops sell it for 50 G (45 G with a Gold Pass). Hitano · GreatLog / Main Street · Nofo · Northden Town · Wiston · Eastoria."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a96",
        "m_exe_08babc",
        "s003f6800_1abc",
        "m_exe_08bf78",
        "PSX shop 122/8",
        "PSX shop 134/24",
        "PSX shop 135/20",
        "PSX shop 136/8",
        "PSX shop 149/8",
        "PSX shop 154/8"
      ],
      "availability": "shop",
      "aliases": [
        "LogBranch"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "Hitano",
            "GreatLog / Main Street",
            "Nofo",
            "Northden Town",
            "Wiston",
            "Eastoria"
          ]
        }
      ],
      "related": [
        "item-40"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAhUlEQVR42mNgGCgQZcnwH4apYtCzNZZgvCaLAkNhBoEMgeFvZ4PIMxTZsGZHhv+OChAMYpNlKEgxsmEgMZihV6cogOVg4iSFHbomsg3EZ9HRZk3qGAgyDOY65KAYNYyI5FMtQD3DqJZEaONVahoGSrxUMQxkAMxl2LIeWQZSzTBkQ8k1DADWRrS/UyeXhwAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-47",
      "kind": "tool",
      "game": "dqm1",
      "title": "Seek Herb",
      "category": "Consumable",
      "summary": "Reveals the surroundings in your mind.",
      "details": [
        "Terry’s field lesson says it reveals the entire floor map. Pair it with the Mommonja Tail to locate the gateway.",
        "Single use.",
        "Terry shops sell it for 50 G (45 G with a Gold Pass). GreatTree / Bazaar."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0a9d",
        "m_exe_08bad8",
        "s0adf7000_227b",
        "PSX shop 5671/21"
      ],
      "availability": "shop",
      "prices": [
        {
          "game": "dqm1",
          "buy": 50,
          "gold_pass": 45,
          "locations": [
            "GreatTree / Bazaar"
          ]
        }
      ],
      "related": [
        "item-31",
        "item-40"
      ],
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAA4klEQVR42q2TwQ3CMAxFPUJH4Nojxx5ZgWNH4MqRI0dWYATWYBXWCPpBP/pYqZNKiWS1dePn79gx21iHsyUbuYYCATu95rQFPV4sqYXJCVvfy99GBeAfLCe9T20gNt8+1xwwLT8F9AGgsKiSAkTgMz1yIBXBR6DCmDQsV4FUBB+/FYb3LiCNgVpmaUYE8w2hIqoqDehVV4N6VR4GXxewFqhl0powD+WMackcZMC6gVicP1Wr57gLTBievkw1QkMwVfEn4f7uqoVzWDtsZveQsFze1+g8mhA/e7u61mrCMNjo9QXbcFIRzaZQ+gAAAABJRU5ErkJggg=="
    },
    {
      "id": "item-48",
      "kind": "item",
      "game": "dqm2",
      "title": "Spring Water",
      "category": "Key item",
      "summary": "Summons an illusory lake.",
      "details": [
        "In Assia, give food to the hungry prisoner. He gives you the Spring Water and a hint to lay bait for what keeps running away."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0aa5",
        "m_exe_08baf4",
        "s03e9f000_0000",
        "s03e9f000_28d8",
        "s03e9f000_28f1",
        "s03e9f000_298e"
      ],
      "availability": "event",
      "aliases": [
        "SprngWatr"
      ]
    },
    {
      "id": "item-49",
      "kind": "item",
      "game": "dqm2",
      "title": "Moonstone",
      "category": "Key item",
      "summary": "Moon power makes the tide rise.",
      "details": [
        "Open the chest aboard the Ghost Ship. Fit the Moonstone into the pedestal at the top of East Lighthouse to open the approach to Volcano Island."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0aaa",
        "m_exe_08bb0c",
        "s00494000_0000",
        "s00494000_01ea",
        "s00300000_0000",
        "s00300000_0078",
        "s004ae000_1162"
      ],
      "availability": "event"
    },
    {
      "id": "item-50",
      "kind": "item",
      "game": "dqm2",
      "title": "Spirit Mark",
      "category": "Key item",
      "summary": "Proof of a spirit's approval.",
      "details": [
        "Visit the spirit at the spring northwest of Northden Castle. Show the mark to identify yourself as the spirit’s envoy when seeking entry to the castles."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ab0",
        "m_exe_08bb24",
        "s0044a800_016c",
        "s004d6000_0222",
        "s004d6000_03eb"
      ],
      "availability": "event",
      "aliases": [
        "SprtMark"
      ]
    },
    {
      "id": "item-51",
      "kind": "item",
      "game": "dqm2",
      "title": "Princess's Soul",
      "category": "Key item",
      "summary": "The soul of an amnesiac princess.",
      "details": [
        "Recover the soul in the Southern Forest and take it back to Westernia Castle. Defeat the enemy there so it can return to the princess."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ab9",
        "m_exe_08bb3c",
        "s00538800_0000",
        "s00538800_01c5",
        "s004ee000_0000",
        "s004ee000_1e0f",
        "s004ee000_1f0a"
      ],
      "availability": "event",
      "aliases": [
        "PrincSoul"
      ]
    },
    {
      "id": "item-52",
      "kind": "item",
      "game": "dqm2",
      "title": "Birdsong Herb",
      "category": "Key item",
      "summary": "Used to make Birdsong Nectar.",
      "details": [
        "Examine the blue flower at the summit of Northern Mountain, then take the herb to the botanist. The resulting nectar restores the townspeople’s voices."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ac1",
        "m_exe_08bb54",
        "s0046b000_0000",
        "s0046b000_0012",
        "s00555000_0517",
        "s00555000_05ad"
      ],
      "availability": "event",
      "aliases": [
        "BirdHerb"
      ]
    },
    {
      "id": "item-53",
      "kind": "item",
      "game": "dqm2",
      "title": "Transform Staff",
      "category": "Key item",
      "summary": "Transforms you into a monster.",
      "details": [
        "Search the hollow behind the grave in Funt Village. Clear space in your inventory before taking the staff."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ac8",
        "m_exe_08bb6c",
        "s0031d800_0000",
        "s0031d800_03dd",
        "s0031d800_0410"
      ],
      "availability": "event",
      "aliases": [
        "MorphStaf"
      ]
    },
    {
      "id": "item-54",
      "kind": "item",
      "game": "dqm2",
      "title": "Sea Bell",
      "category": "Key item",
      "summary": "Summons a shell to cross the sea.",
      "details": [
        "The king rewards you after the trouble at Mirage Lake. Return to Warubou with the bell, then press Triangle beside water to cross it.",
        "Warubou later returns the three treasures. Bring them to Darck’s Manor for the trade."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0acf",
        "m_exe_08bb80",
        "s03e9f000_23dc",
        "s004c3000_0667",
        "s00488000_069e",
        "s003b7800_0dab"
      ],
      "availability": "event"
    },
    {
      "id": "item-55",
      "kind": "item",
      "game": "dqm2",
      "title": "Mirror of Destruction",
      "category": "Key item",
      "summary": "A mirror that destroys what it reflects.",
      "details": [
        "Recover it from Volcanic Island Cave and show it to Warubou. Face a breakable rock and press Triangle to clear it.",
        "Warubou later returns the three treasures. Bring them to Darck’s Manor for the trade."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ad7",
        "m_exe_08bb98",
        "s00521800_0000",
        "s00521800_0359",
        "s003b7800_11be",
        "s003b7800_1201"
      ],
      "availability": "event",
      "aliases": [
        "DestrMirr"
      ]
    },
    {
      "id": "item-56",
      "kind": "item",
      "game": "dqm2",
      "title": "Sky Shield",
      "category": "Key item",
      "summary": "Summons a cloud to fly through the sky.",
      "details": [
        "Return to the spirit after restoring peace. Take the shield to Warubou, then press Triangle at a gap where you can fly across.",
        "Warubou later returns the three treasures. Bring them to Darck’s Manor for the trade."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0adf",
        "m_exe_08bbb0",
        "s004d6000_0773",
        "s004d6000_0813",
        "s003b7800_1955",
        "s003b7800_1a2d"
      ],
      "availability": "event",
      "aliases": [
        "SkyShield"
      ]
    },
    {
      "id": "item-57",
      "kind": "item",
      "game": "dqm2",
      "title": "Zenithian Helm",
      "category": "Key item",
      "summary": "A helm sought by the Demon Lord.",
      "details": [
        "Open the treasure chest in Small Cave. Gather all three pieces of Zenithian equipment for Mudo’s offer of the Orb of Light."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0ae7",
        "m_exe_08bbc8",
        "s00373000_0000",
        "s00373000_0094",
        "s00329800_00c9"
      ],
      "availability": "event",
      "aliases": [
        "ZenHelm"
      ],
      "related": [
        "item-58",
        "item-59"
      ]
    },
    {
      "id": "item-58",
      "kind": "item",
      "game": "dqm2",
      "title": "Zenithian Armor",
      "category": "Key item",
      "summary": "Armor sought by the Demon Lord.",
      "details": [
        "Open the treasure chest in Wind Tower. Gather all three pieces of Zenithian equipment for Mudo’s offer of the Orb of Light."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0af0",
        "m_exe_08bbe0",
        "s0035e800_0000",
        "s0035e800_002b",
        "s00329800_00c9"
      ],
      "availability": "event",
      "aliases": [
        "ZenArmor"
      ],
      "related": [
        "item-57",
        "item-59"
      ]
    },
    {
      "id": "item-59",
      "kind": "item",
      "game": "dqm2",
      "title": "Zenithian Sword",
      "category": "Key item",
      "summary": "A sword sought by the Demon Lord.",
      "details": [
        "Open the treasure chest in Castle of the Dead. Gather all three pieces of Zenithian equipment for Mudo’s offer of the Orb of Light."
      ],
      "spoiler": "story",
      "source_ids": [
        "e0af9",
        "m_exe_08bbf8",
        "s002d3000_0000",
        "s002d3000_01ba",
        "s00329800_00c9"
      ],
      "availability": "event",
      "aliases": [
        "ZenSword"
      ],
      "related": [
        "item-57",
        "item-58"
      ]
    },
    {
      "id": "item-60",
      "kind": "item",
      "game": "both",
      "title": "Magic Stone",
      "category": "Key item",
      "summary": "A blue stone filled with magic power.",
      "details": [
        "The item has a native record. Its acquisition and quest use are unconfirmed."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b02",
        "m_exe_08bc10"
      ],
      "availability": "unconfirmed",
      "aliases": [
        "MagicSton"
      ]
    },
    {
      "id": "item-61",
      "kind": "item",
      "game": "both",
      "title": "Pretty Ring",
      "category": "Key item",
      "summary": "A gold ring with lovely decorations.",
      "details": [
        "The item has a native record. Its acquisition and quest use are unconfirmed."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b0a",
        "m_exe_08bc2c"
      ],
      "availability": "unconfirmed",
      "aliases": [
        "PretyRing"
      ]
    },
    {
      "id": "item-64",
      "kind": "item",
      "game": "dqm2",
      "title": "Stamina Belt",
      "category": "Accessory",
      "summary": "Max HP increased by 30.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b18",
        "m_exe_08bc68",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "StamBelt"
      ]
    },
    {
      "id": "item-65",
      "kind": "item",
      "game": "dqm2",
      "title": "Dragon Belt",
      "category": "Accessory",
      "summary": "Max HP increased by 80.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b20",
        "m_exe_08bc7c",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "DrgnBelt"
      ]
    },
    {
      "id": "item-66",
      "kind": "item",
      "game": "dqm2",
      "title": "Magic Belt",
      "category": "Accessory",
      "summary": "Max MP increased by 30.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b28",
        "m_exe_08bc90",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "MagicBelt"
      ]
    },
    {
      "id": "item-67",
      "kind": "item",
      "game": "dqm2",
      "title": "Mystic Belt",
      "category": "Accessory",
      "summary": "Max MP increased by 80.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b30",
        "m_exe_08bca4",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "MystBelt"
      ]
    },
    {
      "id": "item-68",
      "kind": "item",
      "game": "dqm2",
      "title": "Stone Fang",
      "category": "Accessory",
      "summary": "Attack increased by 10.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b38",
        "m_exe_08bcb8",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "StoneFang"
      ]
    },
    {
      "id": "item-69",
      "kind": "item",
      "game": "dqm2",
      "title": "Steel Fang",
      "category": "Accessory",
      "summary": "Attack increased by 50.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b3e",
        "m_exe_08bccc",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "SteelFang"
      ]
    },
    {
      "id": "item-70",
      "kind": "item",
      "game": "dqm2",
      "title": "Mermaid Scale",
      "category": "Accessory",
      "summary": "Defense increased by 10.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b45",
        "m_exe_08bce0",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "MermScale"
      ]
    },
    {
      "id": "item-71",
      "kind": "item",
      "game": "dqm2",
      "title": "Divine Dragon Scale",
      "category": "Accessory",
      "summary": "Defense increased by 50.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b4e",
        "m_exe_08bcf4",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "DivDScale"
      ]
    },
    {
      "id": "item-72",
      "kind": "item",
      "game": "dqm2",
      "title": "Gale Bracelet",
      "category": "Accessory",
      "summary": "Agility increased by 10.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b58",
        "m_exe_08bd08",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "GaleBrac"
      ]
    },
    {
      "id": "item-73",
      "kind": "item",
      "game": "dqm2",
      "title": "Meteor Bracelet",
      "category": "Accessory",
      "summary": "Agility increased by 50.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b61",
        "m_exe_08bd1c",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "MeteoBrac"
      ]
    },
    {
      "id": "item-74",
      "kind": "item",
      "game": "dqm2",
      "title": "Wisdom Cap",
      "category": "Accessory",
      "summary": "Wisdom increased by 50.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b69",
        "m_exe_08bd30",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "WisdomCap"
      ]
    },
    {
      "id": "item-75",
      "kind": "item",
      "game": "dqm2",
      "title": "Knowledge Cap",
      "category": "Accessory",
      "summary": "Wisdom increased by 100.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b70",
        "m_exe_08bd44",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "KnowCap"
      ]
    },
    {
      "id": "item-76",
      "kind": "item",
      "game": "dqm2",
      "title": "Magic Cloak",
      "category": "Accessory",
      "summary": "Resists offensive spells.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b78",
        "m_exe_08bd58",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "MagCloak"
      ]
    },
    {
      "id": "item-77",
      "kind": "item",
      "game": "dqm2",
      "title": "Dragon Cloak",
      "category": "Accessory",
      "summary": "Resists fire and blizzards.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b80",
        "m_exe_08bd70",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "DrgnCloak"
      ]
    },
    {
      "id": "item-78",
      "kind": "item",
      "game": "dqm2",
      "title": "Silver Cloak",
      "category": "Accessory",
      "summary": "Resists sleep, poison and confusion.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b88",
        "m_exe_08bd88",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "SilvCloak"
      ]
    },
    {
      "id": "item-79",
      "kind": "item",
      "game": "dqm2",
      "title": "Gold Cloak",
      "category": "Accessory",
      "summary": "Resists sleep, curse, Surround and paralysis.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b90",
        "m_exe_08bda4",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "GoldCloak"
      ]
    },
    {
      "id": "item-80",
      "kind": "item",
      "game": "dqm2",
      "title": "Platinum Cloak",
      "category": "Accessory",
      "summary": "Resists Beat, Sacrifice, curse and paralysis.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0b98",
        "m_exe_08bdc4",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "PlatCloak"
      ]
    },
    {
      "id": "item-81",
      "kind": "item",
      "game": "dqm2",
      "title": "Dolphin Cloak",
      "category": "Accessory",
      "summary": "Resists Water-based attacks.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0ba0",
        "m_exe_08bde4",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "DolfCloak"
      ]
    },
    {
      "id": "item-82",
      "kind": "item",
      "game": "dqm2",
      "title": "Fortitude Cloak",
      "category": "Accessory",
      "summary": "Makes attacks harder to seal.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0ba9",
        "m_exe_08be00",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "FortCloak"
      ]
    },
    {
      "id": "item-83",
      "kind": "item",
      "game": "dqm2",
      "title": "Dragon Scale",
      "category": "Accessory",
      "summary": "Defense increased by 5.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Cobi / Tara shops sell it for 20 G (18 G with a Gold Pass). GreatLog / Main Street."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bb1",
        "m_exe_08be18",
        "PSX shop 134/8",
        "s003f6800_04d2"
      ],
      "availability": "shop",
      "aliases": [
        "DrgnScale"
      ],
      "prices": [
        {
          "game": "dqm2",
          "buy": 20,
          "gold_pass": 18,
          "locations": [
            "GreatLog / Main Street"
          ]
        }
      ]
    },
    {
      "id": "item-84",
      "kind": "item",
      "game": "dqm2",
      "title": "Life Ring",
      "category": "Accessory",
      "summary": "Restores HP as you walk.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bb9",
        "m_exe_08be2c",
        "s003f6800_04d2"
      ],
      "availability": "event"
    },
    {
      "id": "item-85",
      "kind": "item",
      "game": "dqm2",
      "title": "Goddess Ring",
      "category": "Accessory",
      "summary": "Restores MP as you walk.",
      "details": [
        "Equip in the monster’s accessory slot."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bc1",
        "m_exe_08be44",
        "s003f6800_04d2"
      ],
      "availability": "event",
      "aliases": [
        "GodesRing"
      ]
    },
    {
      "id": "item-86",
      "kind": "item",
      "game": "dqm2",
      "title": "Warrior Ring",
      "category": "Accessory",
      "summary": "Improves Max HP growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bc9",
        "m_exe_08be5c",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "WarRing"
      ]
    },
    {
      "id": "item-87",
      "kind": "item",
      "game": "dqm2",
      "title": "Mage Ring",
      "category": "Accessory",
      "summary": "Improves Max MP growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bd1",
        "m_exe_08be78",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event"
    },
    {
      "id": "item-88",
      "kind": "item",
      "game": "dqm2",
      "title": "Fighter Ring",
      "category": "Accessory",
      "summary": "Improves Attack growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bda",
        "m_exe_08be94",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "FightRing"
      ]
    },
    {
      "id": "item-89",
      "kind": "item",
      "game": "dqm2",
      "title": "Sailor Ring",
      "category": "Accessory",
      "summary": "Improves Defense growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0be3",
        "m_exe_08beb0",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "SailRing"
      ]
    },
    {
      "id": "item-90",
      "kind": "item",
      "game": "dqm2",
      "title": "Thief Ring",
      "category": "Accessory",
      "summary": "Improves Agility growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bec",
        "m_exe_08bec8",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "ThiefRing"
      ]
    },
    {
      "id": "item-91",
      "kind": "item",
      "game": "dqm2",
      "title": "Priest Ring",
      "category": "Accessory",
      "summary": "Improves Wisdom growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bf5",
        "m_exe_08bee0",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "PristRing"
      ]
    },
    {
      "id": "item-92",
      "kind": "item",
      "game": "dqm2",
      "title": "Spellblade Ring",
      "category": "Accessory",
      "summary": "Improves Max HP and MP growth.",
      "details": [
        "Equip in the monster’s accessory slot.",
        "Keep it equipped when gaining a level to improve the matching stat gain."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0bfe",
        "m_exe_08bef8",
        "s003f6800_04d2",
        "s003f6800_0709"
      ],
      "availability": "event",
      "aliases": [
        "SpelbRing"
      ]
    },
    {
      "id": "item-96",
      "kind": "item",
      "game": "both",
      "title": "Miracle Mark",
      "category": "Consumable",
      "summary": "Changes one monster's sex.",
      "details": [
        "Terry can earn one from the Queen of GreatTree. Complete her requests in order and bring Divine Dragon for the last one. Leave one slot free in your bag to collect the mark.",
        "Use it on a hatched monster. The mark is consumed."
      ],
      "spoiler": "none",
      "source_ids": [
        "e0c07",
        "m_exe_08bf48",
        "s00419800_1bf0",
        "s003f6800_0473",
        "s0adf7000_b999"
      ],
      "availability": "event",
      "aliases": [
        "MirclMark",
        "Miracle Sign"
      ],
      "related": [
        "quest-the-queen-s-monster-collection-requests",
        "npc-queen-of-greattree"
      ],
      "species_ids": [
        55
      ]
    },
    {
      "id": "field-wandering-masters",
      "game": "both",
      "title": "Foreign masters and their monsters",
      "summary": "After winning Class F, Terry can find visiting masters on the next floor of a gate. Cobi and Tara meet them outdoors in random Magic Key worlds. The two adventures use different rules to choose who appears.",
      "details": [],
      "source_ids": [
        "s0ac3d800_1a19",
        "s0adf7000_5062",
        "PSX wandering-master selectors 800442C4 / 8004125C",
        "PSX v1.0.66 arena recruitment mode 2",
        "s00419800_2704",
        "s0adf7000_548d",
        "s0adf7000_553d",
        "s000e9000_0aa4",
        "s000e9000_0cbb",
        "PSX retail and v1.0.73 party-strength classifier 80044434–80044640",
        "m_exe_08ed2c",
        "s00419800_25c4",
        "PSX retail and v1.0.73 master selection 80050440, floor statistics 8003F298–8003F360, ordinary destinations 8003EB8C",
        "US/EU DWM1 rooms 0B:46DA–470D and master roll 16:6266–6289",
        "US DWM2 Cobi and Tara visitor priority 12:764C–765D, Bard 12:77AC–781D, Merchant 12:7934–797B"
      ],
      "related": [
        "field-recruitment",
        "item-28",
        "field-arena-items"
      ],
      "species_ids": [
        20
      ],
      "aliases": [
        "foreign masters",
        "wandering masters",
        "visiting masters",
        "other masters",
        "rival master",
        "steal a monster",
        "Can I recruit a foreign master’s monster?",
        "bard",
        "wizard",
        "butcher",
        "foreign master spawn requirements",
        "Game Boy foreign masters"
      ],
      "kind": "mechanic",
      "spoiler": "none",
      "sections": [
        {
          "title": "Terry’s gates on PlayStation",
          "game": "dqm1",
          "intro": "Use the floor you are leaving to choose a master. Descend to an ordinary floor to meet them. A boss or special floor takes the destination instead. When several conditions apply, the first match below wins.",
          "rows": [
            [
              "Priest",
              "Collect every loose item on the floor. With zero items left, the Priest takes priority even on a two-room floor. Win for a full party recovery."
            ],
            [
              "Bard",
              "Reveal both rooms of a two-room floor and leave at least one item on the ground. You may pick up the others. Win to raise each active monster’s lowest stat by 20."
            ],
            [
              "Wizard",
              "Reveal every reachable room and leave at least one item behind. On a two-room floor the Bard takes priority. Win to travel up to 10 floors deeper. From the last floor before the boss, he takes you to the exit."
            ],
            [
              "Merchant (Butcher)",
              "Leave part of the map unexplored and walk at least 200 steps on that floor without picking up an item. Win to receive meat."
            ],
            [
              "Warrior",
              "If the other conditions miss, a warrior can appear by chance and reward a win with an item."
            ]
          ]
        },
        {
          "title": "Cobi and Tara’s Magic Key worlds on PlayStation",
          "game": "dqm2",
          "intro": "Carry at least 1,000 G into a random key world. Walk outdoors, enter a building or dungeon, then come back outside and look for the master. The game checks at least 100 counted field steps when choosing a master. The exact walking distance needed to place one on the map is unconfirmed.",
          "rows": [
            [
              "Priest",
              "Keep a monster at half HP or below, or bring a poisoned monster. This check comes first. Win for a full party recovery."
            ],
            [
              "Bard",
              "Keep the party healthy and bring a monster whose total EXP ends in three identical digits, such as 000, 444 or 999. Win for the same +20 lowest-stat reward as Terry."
            ],
            [
              "Merchant",
              "Carry 10 items or fewer, with no meat in the bag. The Priest and Bard take priority. Win to receive meat."
            ],
            [
              "Warrior",
              "When no other master qualifies, a warrior can appear by chance."
            ]
          ]
        },
        {
          "title": "Terry on Game Boy",
          "game": "dqm1",
          "intro": "These comparisons are for Terry’s original Dragon Warrior Monsters. The English PlayStation patch v1.0.73 uses the Japanese PlayStation master selection rules.",
          "rows": [
            [
              "Wizard",
              "On Game Boy, reveal all 16 rooms on a 16-screen floor to qualify. The Wizard can advance you up to 20 floors. On PlayStation, smaller fully revealed floors work too, and the warp spans up to 10 floors."
            ],
            [
              "Bard",
              "On Game Boy, revealing both screens of a two-screen floor sets the Bard condition. On PlayStation the item count at descent also matters. Leave something on the ground."
            ],
            [
              "Chance to appear",
              "The Game Boy game makes a separate 50% roll for a qualifying Priest, Wizard, Bard or Merchant. The PlayStation selector picks the first matching role directly for an eligible ordinary floor."
            ],
            [
              "Enemy team",
              "On Game Boy, the sum of your active monsters’ levels sets Terry’s opponent pool. On PlayStation, their six stats set the pool. A newly bred party can meet stronger opponents at the same levels."
            ]
          ]
        },
        {
          "title": "Cobi and Tara on Game Boy Color",
          "game": "dqm2",
          "intro": "In both original cartridges, hunt outdoors in a random key world and carry at least 1,000 G when looking for the Bard.",
          "rows": [
            [
              "Bard or meat merchant?",
              "Bring a monster whose total EXP ends in three identical digits. If the meat merchant also qualifies, he takes priority over the Bard. Carry a piece of meat to rule him out. On PlayStation, the Bard takes priority."
            ],
            [
              "Repeat Bard visits",
              "On Game Boy Color, a monster capped at 9,999,999 EXP keeps the Bard condition ready. On PlayStation, EXP stops at the monster’s level cap. Check its final three digits before bringing it along."
            ],
            [
              "Traveling Wizard",
              "The Wizard can offer to sell a map for 200 G. There is no visiting Wizard in the siblings’ PlayStation key worlds. The Wizard who skips floors belongs to Terry’s gates."
            ]
          ]
        },
        {
          "title": "Recruiting and finding a particular monster",
          "intro": "Talk to the master to battle. Feed meat during the fight and defeat the monster you want last. It can still refuse to join. Ranked arena opponents cannot be recruited.",
          "rows": [
            [
              "Find a species",
              "Check the monster library before hunting a species. Choose Terry, Cobi or Tara on its profile and look for “Wandering master’s team” under Recorded encounters. For example, Metal Slime can appear at ranks 5 and 9 for Terry, or rank 6 for either sibling."
            ],
            [
              "Calculate your rank",
              "Your active party sets the opponent rank. Average each stat across your party, rounding down separately. Add the averages for maximum HP, maximum MP, Attack and Defense, then add half the combined Agility and Intelligence averages, rounded down. Every 100 points gives one rank, up to rank 19. A party averaging 100 in every stat scores 500 and faces rank 5."
            ]
          ]
        }
      ]
    },
    {
      "id": "field-movement-settings",
      "game": "both",
      "title": "Walking speed, running and encounters",
      "summary": "Terry walks faster on ordinary gate floors than Cobi or Tara do on the Desert, Water, Ice and Sky overworlds. Walk around GreatLog and the siblings use the same faster pace as Terry’s gate floors.",
      "details": [
        "The Japanese PS1 game sets walking pace by map. A normal step takes four movement updates on Terry’s ordinary gate floors and eight on those four overworlds. The same timing difference applies to diagonal steps.",
        "In English patch v1.0.73, Tactics → Movement changes the speed for each adventure. Walk defaults to 1× the map’s usual pace. Hold R1 for 2×, or choose Toggle to switch speeds with each press. Walk and R1 can each be set to 1×, 2× or 4×.",
        "Choose Time for roughly the same number of encounters per minute as you speed up. Choose Distance to keep the usual rate per step. You’ll cover ground faster between fights with Time.",
        "Use Up and Down to choose a setting and Left and Right to change it. Circle or Triangle applies it. Save your adventure to keep the settings. When you reload, you start at walking speed.",
        "Cobi and Tara also gain Triangle actions from Warubou as the story advances. Those actions let them cross water, break rocks and fly across gaps."
      ],
      "source_ids": [
        "Japanese PS1 map movement selector 0x8005EA1C and step tables 0x800BC118–0x800BC14E · v55 walking-speed investigation",
        "v1.0.73 release README · Movement Settings",
        "s004d6000_065a"
      ],
      "related": [
        "field-triangle"
      ],
      "aliases": [
        "run",
        "walk speed",
        "R1 toggle",
        "dash",
        "encounter rate",
        "movement differences",
        "why does Cobi walk slowly",
        "Terry gate speed",
        "diagonal walking"
      ],
      "kind": "mechanic",
      "spoiler": "none"
    },
    {
      "id": "field-restored-content",
      "game": "both",
      "title": "Game Boy, PlayStation and English patch differences",
      "summary": "PlayStation combines Terry, Cobi and Tara in a remake with redrawn presentation, a shared expanded monster roster, revised story routes and different battle and learning rules. The English patch adds restorations, settings and fixes on top of that remake.",
      "details": [],
      "source_ids": [
        "v1.0.73 release README · Restored Content in Terry’s Adventure",
        "v1.0.70 traveling colosseum exit",
        "PSX breeding conditional 8004AB80 and two-save override 8004B05C",
        "PSX/GB foreign-master comparison; see docs/edition-comparison-evidence.md",
        "Native original/v73 learning, growth, recruitment and combat comparisons",
        "Publisher PSX Colosseum and mobile-transfer pages"
      ],
      "related": [
        "field-wandering-masters",
        "field-breed",
        "field-skill-inheritance",
        "field-movement-settings",
        "field-retail-bugs",
        "field-two-save-breeding",
        "field-colosseum-prizes"
      ],
      "aliases": [
        "version differences",
        "GBC PSX differences",
        "DWM1 DWM2 comparison",
        "original Japanese PlayStation",
        "Game Boy translation edition",
        "restored content",
        "cut content",
        "PS1 remake"
      ],
      "kind": "mechanic",
      "spoiler": "none",
      "sections": [
        {
          "id": "which-edition",
          "title": "Which version are you playing?",
          "paragraphs": [
            "The Japanese PlayStation release remakes the two handheld games. The English patch translates that remake and adds further features. Its alternative English wording editions change names and phrasing, not which game’s mechanics you are playing."
          ],
          "table": {
            "columns": [
              "Version",
              "What it means for this guide"
            ],
            "rows": [
              [
                "Dragon Warrior Monsters / DQM1 on Game Boy",
                "Terry’s original adventure, with its own encounter, special-floor and breeding rules."
              ],
              [
                "Dragon Warrior Monsters 2 on Game Boy Color",
                "Cobi’s Journey and Tara’s Adventure are separate cartridge releases, with campaign-specific wild encounters and hidden keys."
              ],
              [
                "DQM 1 & 2 on PlayStation, original Japanese release",
                "One remake contains Terry, Cobi and Tara adventures, plus title-screen activities using saved Adventure Logs."
              ],
              [
                "English patch, v1.0.73",
                "The guide’s verified gameplay baseline. It includes the translated PlayStation game, restored activities, movement settings and bug repairs."
              ],
              [
                "Current / Game Boy / Delocalized wording",
                "Alternative English names and phrasing. A Game Boy-named patch still runs the PlayStation game, including its breeding and encounter rules."
              ]
            ]
          },
          "sources": [
            {
              "label": "Japanese PlayStation release overview",
              "url": "https://wikiwiki.jp/dqdic3rd/%E3%80%90%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA%EF%BC%91%E3%83%BB%EF%BC%92%20%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1%E3%80%91"
            },
            {
              "label": "English v1.0.73 release",
              "url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73"
            }
          ]
        },
        {
          "id": "presentation-controls",
          "title": "Redrawn presentation, sound and controls",
          "paragraphs": [
            "The remake redraws the towns, dungeons and monsters for PlayStation. Larger scenery and layered environments give places more depth; the atlas shows the actual PSX floor plans. The battle monsters are detailed 2D artwork with movement, scaling and visual effects rather than the handheld’s small battle images.",
            "Sound was reworked for PlayStation, with new castle and boss music as well as arrangements of familiar themes. These audiovisual changes belong to the Japanese remake and are retained by the English patch."
          ],
          "table": {
            "columns": [
              "Part of play",
              "What changes on PlayStation"
            ],
            "rows": [
              [
                "World traversal",
                "Cobi and Tara use Triangle for the story-granted water crossing, rock breaking and flight actions. Terrain and paths are redrawn, so an old handheld map is not a pixel-for-pixel route."
              ],
              [
                "Movement feel",
                "The four main Cobi/Tara outdoor worlds use a slower native movement cadence than Terry’s gate floors. GreatLog itself uses the faster cadence."
              ],
              [
                "Local battles",
                "PlayStation uses one shared screen and timed, alternating command entry. Opposing team selection is visible; action order still follows the battle rules."
              ],
              [
                "Running in English v1.0.73",
                "The patch adds configurable walking/R1 speeds and Hold/Toggle. This is separate from the original remake’s movement differences."
              ]
            ]
          },
          "links": [
            "field-triangle",
            "field-movement-settings"
          ],
          "sources": [
            {
              "label": "Contemporary report of Enix’s PSX announcement",
              "url": "https://game.watch.impress.co.jp/docs/20020326/dqm.htm"
            },
            {
              "label": "Japanese PlayStation release overview",
              "url": "https://wikiwiki.jp/dqdic3rd/%E3%80%90%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA%EF%BC%91%E3%83%BB%EF%BC%92%20%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1%E3%80%91"
            },
            {
              "label": "Publisher’s original battle presentation",
              "url": "https://www.jp.square-enix.com/dragonquest/psdqm12/taisen_gokui.html"
            }
          ]
        },
        {
          "id": "monsters-and-breeding",
          "title": "The expanded monster roster and breeding",
          "paragraphs": [
            "Terry gains access to the later monster and skill pool on PlayStation, including the Aquatic family. These additions broaden breeding and foreign-master teams; they do not all become ordinary wild encounters in Terry’s gates.",
            "The publisher described more than 300 species across 11 families. The PSX library has 312 entries, while the guide preserves 325 native species records including special and unused records outside that library.",
            "Breeding uses the PSX ordered-pair and conditional tables. The same pair can behave differently at the adventure’s shrine and in the title-screen room for two saves."
          ],
          "table": {
            "columns": [
              "Decision",
              "PlayStation rule to check"
            ],
            "rows": [
              [
                "Which parent is the pedigree?",
                "The ordered pair matters. Reversing pedigree and mate can change the offspring. Use the breeding lookup with the intended order."
              ],
              [
                "Does this recipe need a + value?",
                "Some results have additional conditions. Two Killing Machines at +5 and +6 produce another Killing Machine at the adventure’s shrine; at least one parent needs +8 for Killing Machine 2."
              ],
              [
                "Am I breeding in the adventure or from the title screen?",
                "The title-screen Breeding room has a separate two-save rule. The same Killing Machine pair can produce Killing Machine 2 there at lower + values."
              ],
              [
                "Will a natural or inherited skill pass on?",
                "Both parents’ species skills can become offspring candidates even if unlearned. Other inherited skills must be retained in a parent’s learned list to pass through that route."
              ],
              [
                "Can the child learn it immediately?",
                "Candidate status is only eligibility. The child still needs the skill’s level and base-stat requirements, and has eight learned-skill slots."
              ]
            ]
          },
          "links": [
            "field-breed",
            "field-skill-inheritance",
            "field-growth",
            "field-two-save-breeding"
          ],
          "sources": [
            {
              "label": "Publisher’s PlayStation breeding guide",
              "url": "https://www.jp.square-enix.com/dragonquest/psdqm12/slash/haigou.html"
            },
            {
              "label": "Verified PSX breeding and learning rules",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/learning-mechanics-evidence.md"
            }
          ]
        },
        {
          "id": "terry-gates",
          "title": "Terry: gates, special floors and optional routes",
          "paragraphs": [
            "Terry still progresses through arena classes and Travelers’ Gates, but a handheld walkthrough cannot supply the complete PlayStation floor rules. The original Japanese PSX release does not normally select most of the Game Boy special rooms. The English patch restores treasure and Mimic rooms, Lost Forest, the traveling colosseum, mazes and sliding floors using retained PSX assets and reconstructed behavior.",
            "The restoration is an English-patch feature. Its encounter rates and some mechanics are reconstruction choices, so a Game Boy floor probability is not a confirmed PSX probability. Gate pages show the entrance, final area, generated terrain and wild encounters separately."
          ],
          "bullets": [
            "For the optional farm egg, clear Class F, hear Pulio’s hint and inspect the “Watch overhead!” sign before defeating Battle Rex. Use the PSX quest window rather than assuming that walking past the farm is enough.",
            "Arena requirements on gate pages describe the class you must already have won. They are not rewards for defeating the gate boss.",
            "A retained map need not be a reachable gate. The unused Hidden Gate’s encounter tables and final map are documented as unused content, not an ordinary exploration destination."
          ],
          "links": [
            "quest-sky-dragon-egg",
            "field-packing",
            "story-terry-optional-gates"
          ],
          "sources": [
            {
              "label": "Patch restoration notes",
              "url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73"
            },
            {
              "label": "Verified campaign and progression evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/data/world-verification.json"
            }
          ]
        },
        {
          "id": "cobi-tara-worlds",
          "title": "Cobi & Tara: rewritten story routes",
          "paragraphs": [
            "Several steps were rewritten for PlayStation, especially the opening, the Ice Key and the route through Ice World. Cobi and Tara still have their own encounters within the shared main-world sequence.",
            "On PSX, Kids’ Class grants shrine permission and the queue clears after Water World. The handheld book calls that same story world Pirate World; those two labels alone are not evidence of a changed unlock."
          ],
          "table": {
            "columns": [
              "Story step",
              "Game Boy Color",
              "PlayStation"
            ],
            "rows": [
              [
                "GreatLog’s opening",
                "After the plug breaks, speak to the island’s inhabitants to seek a volunteer master.",
                "Return home with your sibling, collect your father’s pot and bring it to Warubou as a temporary plug."
              ],
              [
                "Ice Key",
                "Give Father a MadGopher, then give the dock merchant an ArmyAnt; the merchant finds the key beneath a crate.",
                "Search the GreatLog farm for the Ice Key after returning the Mirror of Destruction. The monster handovers are no longer needed."
              ],
              [
                "Ice World’s northern mountain",
                "The handheld route sends you north of Eastoria for the Sleep Herb to continue the queen’s story.",
                "The Birdsong Herb and Eastoria’s lost-voices investigation are optional for reaching the Sky Key. Finish the Northden/Westernia peace route, return to the Spirit’s Spring for the Sky Shield, then visit GreatLog Castle."
              ],
              [
                "A pause before Sky World",
                "The handheld walkthrough moves from the Ice World treasure toward its Sky-world access steps.",
                "GreatLog temporarily believes Kameha has solved its problem. A Sky Dragon egg search belongs to this interval; collecting the Sky Key ends its availability."
              ],
              [
                "After the ending",
                "Six named Hidden Keys form additional adventures, three per cartridge, with trading to obtain the other set.",
                "Those handheld Hidden Key adventures are cut. Continue with generated Magic Key worlds, arena rewards, breeding, library completion and spirit rewards."
              ]
            ]
          },
          "links": [
            "story-cobi-tara-opening",
            "quest-find-the-ice-key",
            "story-ice-eastoria",
            "story-ice-shield",
            "quest-greatlog-buried-egg",
            "story-greatlog-postgame",
            "field-generated-keys"
          ],
          "sources": [
            {
              "label": "Verified world text and progression guards",
              "url": "https://github.com/dqm-psx/guide/blob/main/data/world-verification.json"
            },
            {
              "label": "Handheld guide pages and PSX comparison evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/edition-comparison-evidence.md"
            }
          ]
        },
        {
          "id": "foreign-master-differences",
          "title": "Foreign masters: changed conditions and strength",
          "paragraphs": [
            "The most consequential difference is how opponents scale. Terry’s Game Boy opponent pool uses party levels; PlayStation calculates its rank from party statistics. Raising stats while keeping levels low therefore does not keep PSX foreign-master teams weak.",
            "On PSX, average each party stat, add HP, MP, Attack and Defense, then add half the combined Agility and Intelligence averages. Each 100 points advances the rank, up to rank 19. Some charts double the score and number ranks from 1; convert both conventions before comparing them.",
            "These are selection rules, not a promise that a visitor will appear at your next visible step. The full foreign-master page gives role priority, recruitment restrictions and the distinction between a qualifying check and a reachable destination."
          ],
          "table": {
            "columns": [
              "Situation",
              "Game Boy reference",
              "PlayStation"
            ],
            "rows": [
              [
                "Terry: basic availability",
                "The original uses a separate 50% master roll on an otherwise qualifying floor.",
                "After Class F, meeting a role condition selects that master on an ordinary qualifying floor; a boss or special-floor destination can take priority."
              ],
              [
                "Terry: Wizard",
                "Reveal all 16 rooms on a 16-screen floor; the teleport can descend up to 20 floors.",
                "Reveal every reachable room; leave an item on the floor to avoid the higher-priority Priest. The teleport descends up to 10 floors."
              ],
              [
                "Terry: Bard",
                "The handheld two-screen floor rule does not describe PSX room counting.",
                "Reveal both rooms of a two-room floor and leave at least one item."
              ],
              [
                "Cobi / Tara: Bard versus Merchant",
                "The handheld Merchant is checked before Bard; carried meat blocks Merchant.",
                "Bard is checked first. Merchant needs at most 10 carried items and no meat."
              ],
              [
                "Cobi / Tara: travel Wizard",
                "A handheld visitor can offer map help for 200 G.",
                "This Wizard visitor is absent from the PSX selection described here."
              ],
              [
                "Cobi / Tara: searching random key worlds",
                "Do not reuse Terry’s floor-exit method.",
                "Search outdoors in a generated Magic Key world with at least 1,000 G. The selection check requires at least 100 counted steps."
              ]
            ]
          },
          "links": [
            "field-wandering-masters"
          ],
          "sources": [
            {
              "label": "Native PSX and handheld comparison evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/edition-comparison-evidence.md"
            }
          ]
        },
        {
          "id": "learning-changes",
          "title": "Lower learning thresholds and a different Summon chain",
          "paragraphs": [
            "Many DWM2 Game Boy Color skill-learning Intelligence requirements are lower on PSX. The table compares the printed handheld requirements with the native PSX table. These are minimum stats for learning, not the MP spent casting the spell; level and maximum-MP requirements are unchanged in these examples."
          ],
          "table": {
            "columns": [
              "Skill",
              "Minimum level",
              "Minimum max MP",
              "GBC DWM2 Intelligence",
              "PSX Intelligence"
            ],
            "rows": [
              [
                "Blaze",
                "1",
                "7",
                "36",
                "20"
              ],
              [
                "Firebal",
                "3",
                "11",
                "42",
                "23"
              ],
              [
                "Bang",
                "4",
                "13",
                "47",
                "26"
              ],
              [
                "Heal",
                "1",
                "7",
                "11",
                "6"
              ],
              [
                "Healmore",
                "10",
                "52",
                "87",
                "48"
              ],
              [
                "Healall",
                "16",
                "82",
                "114",
                "80"
              ]
            ]
          },
          "bullets": [
            "On Game Boy Color, the TatsuCall → DiagoCall → SamsiCall → BazooCall chain advances through level and stat thresholds. The printed Intelligence thresholds are 100, 250, 400 and 550.",
            "On PSX, the stronger summons are combination skills. Summon Deago requires Summon Tattsu, Defense and Focus Spirit, plus level 25, 100 max MP and 120 Intelligence.",
            "Summon Samshin combines Summon Tattsu, Speedup and Charge Power at level 30, 130 max MP and 150 Intelligence. Summon Bazoo combines Summon Tattsu, Thordain and Wave of Darkness at level 35, 160 max MP and 180 Intelligence.",
            "Simply leveling a monster with Summon Tattsu therefore does not supply the missing combination skills. Use the skill planner to check natural skills, inherited candidates and the exact prerequisites."
          ],
          "links": [
            "field-skill-inheritance"
          ],
          "sources": [
            {
              "label": "Handheld pages and native PSX learning table comparison",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/edition-comparison-evidence.md"
            },
            {
              "label": "Native skill-learning evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/skill-learning-evidence.md"
            }
          ]
        },
        {
          "id": "battle-system-changes",
          "title": "Timed effects and repeated-skill bonuses",
          "paragraphs": [
            "PSX changes more than spell names and animation. Temporary effects can expire during a long fight, and repeating the same eligible attacking skill can improve its performance against resistance. These rules are present in the original Japanese game and the checked English release."
          ],
          "table": {
            "columns": [
              "System",
              "PSX behavior",
              "Practical consequence"
            ],
            "rows": [
              [
                "Temporary stat changes and protections",
                "The battle engine maintains duration counters and restores the underlying stats or effect flags when they expire. Defense and Agility changes are among these timed effects.",
                "Reapply protection when it wears off in a long fight. A turn-one setup is not permanent for the whole battle."
              ],
              [
                "Repeated use of a skill",
                "The native routine tracks consecutive use of the same eligible command. Its resistance check uses the streak, and the fourth use can gain an additional damage multiplier.",
                "Repeated spell/breath damage can differ from its first-use range even when the attacker’s stats have not changed."
              ],
              [
                "What breaks or resets the sequence",
                "Changing the command restarts the counter. The four-use cycle also restarts after its fourth entry; unavailable actors and ineligible contexts clear it.",
                "It is not a permanent resistance reduction that every later attack inherits."
              ],
              [
                "Damage calculator scope",
                "The calculator displays supported baseline hits and resistance settings, without the repeated-command sequence or expiring battle buffs.",
                "Use the result as the unmodified hit range. A live battle with these effects needs the relevant adjustment."
              ]
            ]
          },
          "sources": [
            {
              "label": "Native repeated-action and duration audit",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/edition-comparison-evidence.md"
            }
          ]
        },
        {
          "id": "training-and-combat",
          "title": "Training and combat on PlayStation",
          "paragraphs": [
            "The English patch retains the audited PSX learning, growth, recruitment and baseline damage rules. Farm training and a monster’s permanent collection record explain several behaviors that are easy to mistake for a translation-patch change."
          ],
          "table": {
            "columns": [
              "Mechanic",
              "What matters on PSX"
            ],
            "rows": [
              [
                "Skill learning",
                "Checks use level and the six base stats, including maximum HP and MP. Accessory bonuses are not a shortcut to the learning thresholds. Upgrades and combination skills have separate checks."
              ],
              [
                "Training on the farm",
                "Farm growth does not run the party’s skill-learning routine. Bring a monster back to the active party and gain a level to check eligible skills."
              ],
              [
                "Maximum level after breeding",
                "The cap is the species base limit plus three times the offspring’s + value, capped at 99. It is not simply the number of times a lineage has bred."
              ],
              [
                "Repeated recruitment",
                "The persistent collected-species flag matters. Releasing or breeding away your last copy does not make the next one a first recruit again."
              ],
              [
                "Feeding meat",
                "Meats stack in a shared battle appeal value. Higher appeal can stop helping one species while still helping another. Feeding does not override an ineligible battle or species."
              ],
              [
                "Damage",
                "Ordinary wild enemies and companions can use different spell and breath ranges. Resistance, species family and rounding matter; an Attack-versus-Defense estimate does not describe every skill."
              ],
              [
                "Battle messages",
                "Text Speed 8 selects manual pacing for applicable message waits. That behavior already exists in the Japanese PSX release."
              ]
            ]
          },
          "links": [
            "field-skill-inheritance",
            "field-growth",
            "field-recruitment",
            "field-battle-text-speed"
          ],
          "sources": [
            {
              "label": "Learning and growth evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/learning-mechanics-evidence.md"
            },
            {
              "label": "Recruitment evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/recruitment-evidence.md"
            },
            {
              "label": "Combat evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/combat-evidence.md"
            }
          ]
        },
        {
          "id": "items-and-medals",
          "title": "Items and medal rewards",
          "paragraphs": [
            "PSX adds the Miracle Mark for changing a hatched monster’s sex and, in Cobi and Tara’s adventure, the Spellblade Ring for HP/MP growth. The mark is consumed when used; Terry’s final queen request is one confirmed source.",
            "The old Rotten Meat/BadMeat record survives in PSX data, but the guide has not established an ordinary acquisition source. Warubou’s leftover-meat conversation does not actually put one in Terry’s bag. This differs from treating it as a normal handheld supply item.",
            "Both PSX medal collectors first award prizes against a cumulative total, then open an exchange menu after that reward track. GreatLog also has a separate talking-pot offer: one Tiny Medal for one magic key."
          ],
          "links": [
            "item-96",
            "item-92",
            "item-29",
            "field-medals",
            "quest-the-queen-s-monster-collection-requests",
            "quest-talking-pot-key"
          ],
          "sources": [
            {
              "label": "Japanese PlayStation release overview",
              "url": "https://wikiwiki.jp/dqdic3rd/%E3%80%90%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA%EF%BC%91%E3%83%BB%EF%BC%92%20%E6%98%9F%E9%99%8D%E3%82%8A%E3%81%AE%E5%8B%87%E8%80%85%E3%81%A8%E7%89%A7%E5%A0%B4%E3%81%AE%E4%BB%B2%E9%96%93%E3%81%9F%E3%81%A1%E3%80%91"
            },
            {
              "label": "Native PSX item and source evidence",
              "url": "https://github.com/dqm-psx/guide/blob/main/data/gameplay-verification.json"
            }
          ]
        },
        {
          "id": "multiplayer-and-saves",
          "title": "Memory cards, breeding between saves and Colosseum",
          "paragraphs": [
            "PlayStation’s title-screen activities read saved Adventure Logs. The original Colosseum can even select the same log for both sides, making a practice match possible with your own collection. Players reveal their choices as they select monsters; the publisher’s original rules allow up to 20 turns and prohibit Dragon Form and Transform.",
            "The original Colosseum uses timed command entry. Players alternate entering orders, but input order is not the monsters’ action order. If a command times out, the monster falls back to its aggressive tactic."
          ],
          "table": {
            "columns": [
              "Activity",
              "Original Japanese PSX",
              "English v1.0.73"
            ],
            "rows": [
              [
                "Breed monsters from different saves",
                "A separate title-screen room pairs two masters’ monsters. Crossing Terry with Cobi or Tara requires game completion. Both parents leave and each save receives an egg.",
                "Retains this system. This is distinct from the shrine’s ordinary breeding context."
              ],
              [
                "Battle saved teams",
                "The title-screen Colosseum loads selected Adventure Logs for a local match.",
                "Adds Free Battle, Enix Rules and configurable Local Rules."
              ],
              [
                "Wager a monster",
                "Do not assume the handheld monster-transfer wager is available in the original PSX Colosseum.",
                "Enable prizes in Local Rules. Each player offers an awake farm monster outside the active party; a winner receives the other offer and keeps their own."
              ],
              [
                "Save a prize result",
                "A practice match is not a transfer route.",
                "A transfer writes both Adventure Logs. Leave receiving farm space, let both writes finish, and use Retry if a card error occurs. Draws transfer nothing."
              ]
            ]
          },
          "links": [
            "field-two-save-breeding",
            "field-colosseum-prizes"
          ],
          "sources": [
            {
              "label": "Publisher: original Colosseum setup and rules",
              "url": "https://www.jp.square-enix.com/dragonquest/psdqm12/taisen_top.html"
            },
            {
              "label": "Publisher: command timing",
              "url": "https://www.jp.square-enix.com/dragonquest/psdqm12/taisen_gokui.html"
            },
            {
              "label": "English patch rules and prizes",
              "url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73"
            }
          ]
        },
        {
          "id": "mobile-link",
          "title": "The old mobile-phone connection is a separate system",
          "paragraphs": [
            "The Japanese PSX game was also designed to exchange monsters with a contemporary mobile-phone game. This is neither Game Boy link breeding nor ordinary PSX memory-card breeding. The publisher describes a receiving-side key and a sending-side transfer password that must match.",
            "The historical service had its own conversion rules: a phone-born monster arrived on PSX at level 10 with a level-20 growth limit, and its skills were converted for the PSX species rather than copied directly from the phone battle. Treat old transfer advice as a description of that service, not as a currently verified way to obtain every retained rare species."
          ],
          "sources": [
            {
              "label": "Publisher’s historical mobile-transfer FAQ",
              "url": "https://www.jp.square-enix.com/dragonquest/psdqm12/psdqmisub/dqmi_tensou_others.html"
            }
          ]
        },
        {
          "id": "english-restorations",
          "title": "Restored table conversations and special floors",
          "paragraphs": [
            "The Japanese PSX release retained 112 monster table conversations, but its table interaction was unavailable. The English patch reconnects those conversations with reconstructed seating and personality matching. This is why a Game Boy guide may mention a conversation that an unpatched PlayStation player cannot start."
          ],
          "bullets": [
            "At the arena dining room’s right table, step onto the east stool with one to three living, visible party monsters.",
            "Up, Left and Down select the north, west and south seats. Confirm/Talk starts the selected monster’s conversation. Cancel or Right stands up. Leave the stool before sitting again.",
            "In the restored traveling colosseum, win the first three matches, then decide whether to accept the second set. Decline when finished and leave through the north door.",
            "Travel Bookmark cannot be used inside the traveling colosseum. If your bag is full when claiming a prize, make room and return."
          ],
          "links": [
            "field-packing"
          ],
          "sources": [
            {
              "label": "Restoration controls and floor notes",
              "url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73"
            }
          ]
        },
        {
          "id": "english-settings-fixes",
          "title": "English-patch settings, fixes and saved games",
          "paragraphs": [
            "Tactics → Movement adds separate walking and R1 speeds, Hold or Toggle, and Time or Distance encounter behavior. Each adventure stores its own choices. The defaults are Walk 1×, R1 2×, Hold and Time; loading an adventure begins at the walking speed.",
            "Time keeps encounters at roughly the same frequency while running. Distance uses the usual rate per step. These choices are new patch settings; they are separate from the original map-dependent walking differences."
          ],
          "table": {
            "columns": [
              "Problem or change",
              "How to interpret it"
            ],
            "rows": [
              [
                "Truth Gate cannot be retried after losing to Dungeon Shrimp",
                "An original Japanese progression bug, repaired in English v1.0.34. On an updated game, return and answer the questions again."
              ],
              [
                "Scene/NPC graphics memory leaks and walking-sprite loading fault",
                "Original-game problems identified and fixed by v1.0.73. They are not changes to breeding or recruitment balance."
              ],
              [
                "Historical English menu, text or battle-loading regressions",
                "Check the release that introduced and fixed the problem. A patch changelog entry does not prove the Japanese game had the same bug."
              ],
              [
                "Continue after updating",
                "Apply the patch to a clean Japanese disc, boot the updated game and load the in-game memory-card save. A state from another patch version can restore old code."
              ],
              [
                "A familiar monster or gate has a new name",
                "The identity is unchanged when a translation label changes. Search aliases and linked names help connect old walkthrough wording to the current guide."
              ]
            ]
          },
          "links": [
            "field-movement-settings",
            "field-retail-bugs"
          ],
          "sources": [
            {
              "label": "Release history and update instructions",
              "url": "https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73"
            }
          ]
        }
      ]
    },
    {
      "id": "field-retail-bugs",
      "game": "both",
      "title": "Which bugs came from the Japanese PlayStation game?",
      "summary": "The patch release notes identify a Truth Gate progression bug in the original game and several faults in how it loaded and freed graphics.",
      "details": [
        "In Terry’s Truth Gate, losing to Dungeon Shrimp (Digster) could leave the boss unable to challenge you again. That also blocked credit for the gate toward recruiting Watabou. The English v1.0.34 release includes the repair. Return to the boss room on the updated game and answer the questions again to retry.",
        "The original game could leave scene and NPC graphics in memory after they were no longer needed. v1.0.73 fixes these leaks and a separate walking-sprite loading bug.",
        "For a stuck event on an older English build, patch a clean Japanese disc image, boot the updated game and load your in-game memory-card save. An emulator save state can resume the old game code."
      ],
      "source_ids": [
        "v1.0.73 release README · v34, v73 and Install"
      ],
      "related": [
        "field-restored-content"
      ],
      "aliases": [
        "original Japanese bugs",
        "retail PSX bugs",
        "Digster",
        "Truth Gate",
        "update existing save",
        "save state"
      ],
      "kind": "mechanic",
      "spoiler": "story"
    },
    {
      "id": "field-colosseum-prizes",
      "game": "both",
      "title": "How do two players wager monsters?",
      "summary": "In the title-screen Colosseum, choose Local Rules and enable prizes. Monster transfer is available from English patch v1.0.73.",
      "details": [
        "Each player offers an awake farm monster outside their saved adventure party. Make space on the receiving farm before starting.",
        "The winner keeps their own offer and receives the opponent’s monster. A draw leaves both farms as they were.",
        "The transfer writes both Adventure Logs. Wait until both saves finish. If a card write fails, choose Retry before resetting or turning off the game."
      ],
      "source_ids": [
        "v1.0.73 release README · Colosseum Battles"
      ],
      "related": [
        "field-farm"
      ],
      "aliases": [
        "wagers",
        "bet monsters",
        "two player",
        "multiplayer",
        "local rules",
        "prize transfer"
      ],
      "kind": "mechanic",
      "spoiler": "none"
    },
    {
      "id": "field-recruitment",
      "kind": "mechanic",
      "game": "both",
      "title": "Recruit a wild monster",
      "summary": "Compare how much meat helps for a particular monster and encounter. Previous collection matters, even if you no longer own that species.",
      "details": [
        "Meat used on enemies adds to a shared food score for that battle. More than one piece can help, but the same species can have different recruitment settings in different encounters. Choose its area and floor band in the calculator before comparing food.",
        "The game remembers whether a species has ever entered your collection, including through gifts or breeding. Releasing or breeding away your last copy does not restore its first-collection chance. Your current party or farm alone cannot establish this history.",
        "In the calculator’s Terry examples, a previously collected Metal Slime gets an 8.47% joining check from one Sirloin and 23.87% from two. The Slime example already reaches 70.07% with one Sirloin. These native calculations match the Japanese release and English patch v1.0.73. They assume the monster is the eligible recruitment candidate and no Starry Orb was used.",
        "The percentages describe the joining check, not the chance per battle: they do not determine which defeated monster becomes the candidate. A Starry Orb guarantees an otherwise eligible joining check, but neither it nor meat bypasses battle or encounter restrictions. Feeding your own monsters changes wildness instead.",
        "In a DQM2 world reached by a generated magic key, defeat its resident boss before trying to recruit the local monsters."
      ],
      "aliases": [
        "recruitment calculator",
        "meat stacking",
        "Sirloin chance",
        "taming",
        "catch a monster",
        "feeding"
      ],
      "spoiler": "none",
      "source_ids": [
        "s0adf7000_5062",
        "s0039f000_4a3f",
        "s08a74000_0377",
        "Retail Japanese and English v1.0.73 recruitment, feeding and eligibility routines · native executable verification"
      ],
      "related": [
        "item-25",
        "item-26",
        "item-27",
        "item-28",
        "item-30",
        "field-battle-text-speed",
        "field-wandering-masters"
      ]
    },
    {
      "id": "field-storage",
      "kind": "mechanic",
      "game": "both",
      "title": "Keep gold safe in storage",
      "summary": "A party wipe costs half the gold you are carrying. Deposited gold stays safe.",
      "details": [
        "Deposit gold in GreatTree or GreatLog before a risky expedition. A GreatLog resident gives the storage limit as 999,900 G."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0ab53000_158a",
        "s003f6800_27a9",
        "s003f6800_25e9"
      ]
    },
    {
      "id": "field-farm",
      "kind": "mechanic",
      "game": "dqm1",
      "title": "GreatTree farm and hibernation",
      "summary": "Reserve a farm slot before accepting an egg. The farm can hold 30 monsters and eggs combined.",
      "details": [
        "Monsters left awake on the farm gain a little experience. Hibernating monsters gain none. Leaving a monster behind for long periods reduces obedience."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0b113000_167b",
        "s0b113000_0927"
      ],
      "related": [
        "field-skill-inheritance"
      ]
    },
    {
      "id": "field-packing",
      "kind": "mechanic",
      "game": "dqm1",
      "title": "Pack for a Travelers’ Gate",
      "summary": "Terry can carry up to 30 items. Leave space if you plan to collect treasure or accept gifts.",
      "details": [
        "A Seek Herb reveals the map, a Mommonja Tail indicates the gateway direction and a Return Staff takes you straight there.",
        "Keep a Chimera Wing to return to GreatTree. Use a Travel Bookmark to save away from a normal save point."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0b1d9000_016f",
        "s0adf7000_227b",
        "s0afae000_09c1",
        "m_exe_08ba3c"
      ],
      "related": [
        "item-47",
        "item-31",
        "item-40",
        "item-41",
        "item-43"
      ]
    },
    {
      "id": "field-breed",
      "kind": "mechanic",
      "game": "both",
      "title": "Prepare a pair for breeding",
      "summary": "Bring a male and a female, each at level 10 or higher, to the Starry Shrine.",
      "details": [
        "In GreatLog, win the Kids’ Class for permission to use the shrine. Finish Water World and return when the line has cleared.",
        "Breeding leaves an egg. Both parents leave, so keep another monster ready to travel with you.",
        "Choose the pedigree parent deliberately and check the ordered pair in the breeding calculator. The offspring can inherit skills from both parents.",
        "Trying for Killing Machine 2 (Roboster2)? Two Killing Machines at +5 and +6 produce another Killing Machine at the PlayStation shrine. At least one parent must reach +8. In the title-screen Breeding room, the same pair from two different Adventure Logs produces Killing Machine 2 at lower + values."
      ],
      "aliases": [
        "Roboster2 recipe",
        "Killing Machine 2 breeding",
        "Game Boy breeding differences"
      ],
      "species_ids": [
        252,
        253
      ],
      "spoiler": "none",
      "source_ids": [
        "v0a08bc_01e3",
        "v0a08bc_0605",
        "s0ab53000_1027",
        "s003f6800_0c8c",
        "s0ab53000_0e61",
        "PSX shrine rule 8004AB80 and two-save override 8004B05C",
        "s003f6800_1bac",
        "s003f6800_1c4c",
        "m_exe_090738"
      ],
      "related": [
        "field-eggs",
        "field-skill-inheritance",
        "field-two-save-breeding",
        "npc-monster-professor"
      ]
    },
    {
      "id": "field-skill-inheritance",
      "kind": "mechanic",
      "game": "both",
      "title": "How do offspring inherit and learn skills?",
      "summary": "A hatchling can learn its own species’ natural skills, both parents’ natural skills and the skills its parents actually knew. It must still meet each skill’s learning requirements.",
      "details": [],
      "sections": [
        {
          "title": "What passes to the egg",
          "intro": "These are the original PlayStation rules. Breeding creates a pool of possible skills; it does not give a level-1 hatchling every move immediately.",
          "rows": [
            [
              "Natural skills",
              "The child’s three species skills and each parent species’ three skills enter the pool. A parent does not need to have learned its own natural skills first. Check Natural skills on each species page."
            ],
            [
              "Learned skills",
              "Both parents’ retained skills also enter the pool, converted to the base forms of their upgrade chains. The child learns and upgrades them as it meets the requirements."
            ],
            [
              "Keeping a skill through generations",
              "An unlearned inherited skill is not copied from a parent’s possible-skill pool. If it is not natural to either new parent or the new child, teach it to a parent and keep it among that parent’s learned skills before breeding again."
            ],
            [
              "Eight learned skills",
              "A monster can retain eight learned skills at once. Its breeding pool has 25 candidate slots, including duplicates and empty slots; that is not a 25-move limit for its battle menu."
            ]
          ]
        },
        {
          "title": "Why a monster has not learned a skill yet",
          "intro": "A skill’s level requirement is only one part of the check. Open its page in Skills to see the required stats, earlier skill or combination prerequisites.",
          "rows": [
            [
              "Stats and level",
              "The monster must reach every listed requirement. The game checks its base maximum HP, maximum MP, Attack, Defense, Agility and Intelligence; an accessory’s immediate stat bonus does not satisfy a missing base-stat requirement."
            ],
            [
              "Upgrades and combinations",
              "Some skills evolve from a move the monster already knows. Others require a combination of learned skills as well as their own learning requirements."
            ],
            [
              "After farm training",
              "Awake farm monsters can gain levels and stats without running the party’s skill-learning checks. Bring the monster into the active party and gain a level in battle. The check considers all eligible candidates against its current stats and level, so several learning prompts can appear together."
            ]
          ]
        }
      ],
      "aliases": [
        "move inheritance",
        "inherited skills",
        "skill breeding",
        "unlearned skills",
        "farm learning",
        "ranch skills",
        "eight skills",
        "8 moves",
        "why has my monster not learned a skill"
      ],
      "spoiler": "none",
      "source_ids": [
        "PSX BreedCreateChild · 80049094 · 9 species candidates + 16 retained-parent skills",
        "PSX results overlay 104 · 801222DC / 80122724 · learning requirements",
        "PSX results overlay 104 · 8011E950 / 8011FB38 / 801200D4 · farm and party level-ups"
      ],
      "related": [
        "field-breed",
        "field-farm",
        "field-growth",
        "field-equipment"
      ]
    },
    {
      "id": "field-two-save-breeding",
      "kind": "mechanic",
      "game": "both",
      "title": "Can monsters breed between Adventure Logs?",
      "summary": "Yes. Choose Breeding on the game’s title screen to pair monsters from two different masters’ saved Adventure Logs.",
      "details": [
        "The original PlayStation game already supports this separate breeding room. It is different from the Starry Shrine in an adventure and from wagering monsters in Colosseum battles.",
        "Breeding between Terry’s adventure and Cobi or Tara’s adventure requires game completion. The game checks the selected Adventure Logs before allowing the session.",
        "Both offered parents leave their respective saves. Each participant receives an egg, and the session overwrites both Adventure Logs. Let the game finish saving before removing either memory card or turning off the console."
      ],
      "aliases": [
        "cross campaign breeding",
        "cross-game breeding",
        "two memory cards",
        "two saves",
        "multiplayer breeding",
        "Terry Cobi Tara breeding"
      ],
      "spoiler": "none",
      "source_ids": [
        "s0a736000_1170",
        "s0a736000_118d",
        "s0a736000_11b4",
        "s0a736000_140e",
        "s0a736000_1429"
      ],
      "related": [
        "field-breed",
        "field-eggs",
        "field-skill-inheritance",
        "field-colosseum-prizes"
      ]
    },
    {
      "id": "field-battle-text-speed",
      "kind": "mechanic",
      "game": "both",
      "title": "How can I slow down battle messages?",
      "summary": "Choose Tactics → Text Speed → 8 to make paced battle messages wait for confirmation under normal input conditions.",
      "details": [
        "Settings 1–7 use fixed waits. Setting 8 selects a button wait for the pacing control used by messages such as meat-feeding results. The menu labels the range Fast to Slow without explaining this difference.",
        "Avoid holding the confirm button or fast-forwarding while reading. This setting controls the tested message-pacing path; it does not promise that every animation or message waits for a button.",
        "This manual mode exists in the Japanese PlayStation game too. The English patch retains the native pacing settings. Text wrapping and page layout are separate from how long a battle message remains visible."
      ],
      "aliases": [
        "text speed 8",
        "battle messages too fast",
        "meat message",
        "pause dialogue",
        "slow battle text",
        "reading speed"
      ],
      "spoiler": "none",
      "source_ids": [
        "m_exe_08d9ec",
        "e0af718_206c",
        "e0af718_207b",
        "PSX original and v1.0.73 PACE_WAIT · 80035074 / 800C70E0"
      ],
      "related": [
        "field-recruitment",
        "field-movement-settings"
      ]
    },
    {
      "id": "field-eggs",
      "kind": "mechanic",
      "game": "both",
      "title": "Appraise, bless and hatch an egg",
      "summary": "Have the egg appraised before hatching if you want to choose the hatchling’s sex.",
      "details": [
        "The appraiser can tell you traits of the hatchling. A blessing changes its sex while it is in the egg.",
        "Hatching has its own fee. If you lack the gold, you can leave the egg unhatched."
      ],
      "spoiler": "none",
      "source_ids": [
        "s003f6800_0473",
        "s0ab53000_5e6e",
        "v0a08bc_00df",
        "v0a08bc_0150"
      ],
      "related": [
        "field-breed"
      ]
    },
    {
      "id": "field-equipment",
      "kind": "mechanic",
      "game": "dqm2",
      "title": "Equip and recover accessories",
      "summary": "Each monster can hold one accessory. Choose between immediate stat bonuses, resistances, recovery and improved growth.",
      "details": [
        "Recovery rings work while walking. Growth rings affect gains when the wearer levels up.",
        "At the GreatLog shrine a breeding parent’s accessory can go to storage. Make room before breeding if the service reports that storage is full."
      ],
      "spoiler": "none",
      "source_ids": [
        "s003f6800_04d2",
        "s003f6800_06b9",
        "s003f6800_0709",
        "s003f6800_0cc7",
        "s003f6800_0d08"
      ],
      "related": [
        "item-64",
        "item-65",
        "item-83",
        "item-84",
        "item-85",
        "item-86"
      ]
    },
    {
      "id": "field-generated-keys",
      "kind": "mechanic",
      "game": "dqm2",
      "title": "Appraise and read magic keys",
      "summary": "Take an unnamed key to GreatLog’s Key Appraiser and pay the quoted fee before using it at the Magic Door.",
      "details": [
        "Each key leads to a particular world. A family name such as Slime in the key name is a clue to the monsters that live there.",
        "Leave room on your key ring before accepting a reward. GreatLog’s arena receptionist can hold a prize in some situations, while another prize service requires another victory."
      ],
      "spoiler": "none",
      "source_ids": [
        "s003f6800_032d",
        "s003f6800_038a",
        "s003f6800_0b2e",
        "s0038d800_0049",
        "s0039f000_2801",
        "s0039f000_2846",
        "v0a21ac_0143",
        "v0a21ac_0321"
      ]
    },
    {
      "id": "field-medals",
      "kind": "mechanic",
      "game": "both",
      "title": "Collect and exchange Tiny Medals",
      "summary": "Bring Tiny Medals to the local collector. Early rewards use your cumulative medal total.",
      "details": [
        "The exchange menu becomes available after the cumulative reward track. Make room in your bag or on your farm before claiming a prize.",
        "In GreatLog there is a separate offer from the talking pot on Main Street. It offers a single magic key in exchange for one Tiny Medal."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0ab53000_59ee",
        "medal_0aadc0_0029",
        "medal_0aadc0_0133",
        "medal_0aadc0_02a3",
        "medal_0aadc0_02f2",
        "medal_0aadc0_031e",
        "s00419800_0197",
        "s00419800_0345",
        "s00419800_0372"
      ],
      "related": [
        "item-44",
        "item-30"
      ]
    },
    {
      "id": "field-personality",
      "kind": "mechanic",
      "game": "both",
      "title": "Shape personality and obedience",
      "summary": "A master’s orders gradually change a monster’s personality, which influences its battle behavior.",
      "details": [
        "To steer a trait more directly, read the matching personality book. It may take more than one.",
        "A higher-level recruit tends to be wilder. A newly hatched monster follows orders."
      ],
      "spoiler": "none",
      "source_ids": [
        "s003f6800_0221",
        "s0039f000_306a",
        "s0afae000_1197"
      ],
      "related": [
        "item-19",
        "item-20",
        "item-21",
        "item-22",
        "item-23",
        "item-24"
      ]
    },
    {
      "id": "field-growth",
      "kind": "mechanic",
      "game": "both",
      "title": "Raise a monster’s growth limit",
      "summary": "An offspring’s maximum level is its species’ base level limit plus three times its + value, capped at level 99.",
      "details": [
        "For example, a species with a base limit of 40 can reach level 55 at +5, or level 70 at +10. The + value beside the offspring’s name matters; it is not simply the number of times you have bred a monster.",
        "Ordinary recruits use a different cap table from bred offspring. The skill and growth planner distinguishes both, including the usual recruitment range. Seeds and nuts raise the corresponding stat when used, rather than raising its level limit.",
        "Learn any inherited skills you want to carry forward before breeding the monster again. Farm training can raise its stats, but skill learning is checked when it gains a level in your active party."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0ab53000_0de3",
        "s003f6800_027c",
        "PSX BreedCreateChild · 80049094 · maxLevel = min(99, species base + 3 × plus)"
      ],
      "related": [
        "field-breed",
        "field-skill-inheritance",
        "item-13",
        "item-14",
        "item-15",
        "item-16",
        "item-17",
        "item-18"
      ]
    },
    {
      "id": "field-arena-items",
      "kind": "mechanic",
      "game": "both",
      "title": "Prepare for an arena class",
      "summary": "Prepare before entering. Both arenas forbid item use and count fleeing as a loss.",
      "details": [
        "GreatTree requires three wins. Direct orders are unavailable, so take monsters whose behavior and skills fit the team.",
        "GreatLog’s Kids’ Class also requires three wins. A full key ring can interfere with collecting the prize."
      ],
      "spoiler": "none",
      "source_ids": [
        "s0adf7000_df8b",
        "s0039f000_23af",
        "s0039f000_2801"
      ]
    },
    {
      "id": "field-triangle",
      "kind": "mechanic",
      "game": "dqm2",
      "title": "Use Triangle to cross water, break rock and fly",
      "summary": "Bring each recovered treasure to Warubou to gain its field ability.",
      "details": [
        "With the Sea Bell’s power, press Triangle near the water to cross. With the Mirror of Destruction’s power, face a suitable rock and press Triangle to break it. With the Sky Shield’s power, press Triangle at a gap you can fly across."
      ],
      "spoiler": "story",
      "source_ids": [
        "s003b7800_0dab",
        "s003b7800_1201",
        "s003b7800_1955",
        "s003b7800_1a2d"
      ],
      "related": [
        "item-54",
        "item-55",
        "item-56"
      ]
    },
    {
      "id": "field-damage-and-resistance",
      "kind": "mechanic",
      "game": "both",
      "topic": "battle",
      "title": "Damage, Defense and resistance",
      "summary": "Use Attack and Defense for normal hits, and the target’s resistance for damage spells and breaths. The same move can have different damage ranges when your monster and a wild enemy use it.",
      "details": [],
      "spoiler": "none",
      "aliases": [
        "damage formula",
        "physical damage",
        "spell damage",
        "breath damage",
        "elemental resistance",
        "damage calculator",
        "weakness",
        "immunity"
      ],
      "source_ids": [
        "PSX retail and v1.0.73 verified normal-attack and damage handlers; docs/combat-evidence.md",
        "PSX retail and v1.0.73 monster unpacking and equipment restoration; docs/save-planner-evidence.md"
      ],
      "related": [
        "field-equipment",
        "field-skill-inheritance"
      ],
      "sections": [
        {
          "id": "battle-inputs",
          "title": "Start with the monster and encounter you actually have",
          "paragraphs": [
            "Import your save once in My game, then select a monster in the Damage calculator. Its Attack and Defense include its equipped accessory, and its individual resistance replaces the unbred species defaults. Calculator edits do not change your roster or save.",
            "Choose the adventure, area, floor band and enemy. Ordinary wild enemies roll their stats from 80% to 110% of the encounter’s base values, rounded down and subject to stat limits. Two appearances of the same species can therefore have different damage ranges. Bosses and arena opponents need their own battle data."
          ],
          "links": [
            "field-equipment"
          ]
        },
        {
          "id": "normal-attacks",
          "title": "Normal attacks: Attack against Defense",
          "paragraphs": [
            "For an ordinary successful hit, halve the target’s Defense and round down. Subtract that from the attacker’s Attack, halve the result and round down again. This gives the center of the usual damage range; the game then adds a small random variation.",
            "For example, 100 Attack against 100 Defense deals 23–27 damage. Very low damage uses special rules: 16 Attack against 26 Defense deals 0–1. High Defense alone does not guarantee that every normal attack deals zero."
          ]
        },
        {
          "id": "spell-breath-ranges",
          "title": "Spells and breaths have their own damage ranges",
          "intro": "The supported damage moves do not use the normal Attack-versus-Defense calculation. Start with the move’s range, apply the target’s relevant resistance and round down. These examples are before resistance and other modifiers, per target.",
          "table": {
            "caption": "Base damage in ordinary wild battles",
            "columns": [
              "Move",
              "Your monster uses it",
              "Wild enemy uses it"
            ],
            "rows": [
              [
                "Blaze",
                "12–15",
                "7–12"
              ],
              [
                "Fire Breath",
                "14–22",
                "10–16"
              ]
            ]
          },
          "links": [
            "skill-e0c10",
            "skill-e0d4d"
          ]
        },
        {
          "id": "resistance",
          "title": "Read resistance as damage taken",
          "intro": "A lower percentage means less damage: 100% takes the full amount; 0% is immune to that damage channel. Spell and breath reductions use different scales. Your monsters also have finer resistance steps than ordinary wild enemies.",
          "table": {
            "caption": "Possible damage percentages after resistance",
            "columns": [
              "Target",
              "Spell scale",
              "Breath scale"
            ],
            "rows": [
              [
                "Your monster",
                "100, 85, 75, 65, 50, 30, 15, 0%",
                "100, 80, 70, 60, 40, 30, 10, 0%"
              ],
              [
                "Ordinary wild enemy",
                "100, 75, 30, 0%",
                "100, 70, 30, 0%"
              ]
            ]
          },
          "paragraphs": [
            "For example, your Blaze against a wild target taking 75% spell damage deals 9–11. A wild enemy’s Blaze against your monster taking 85% deals 5–10. The attacker’s version of the move and the defender’s scale both matter.",
            "Check the resistance to the selected move, rather than treating resistance as one overall stat. A bred monster can differ from its species baseline. An imported save supplies its current individual values; without one, select a known reduction in the calculator."
          ]
        },
        {
          "id": "level-and-family",
          "title": "Level and family can change the result",
          "rows": [
            [
              "Wind Sickle, Vacuum Wave and Lightning",
              "These moves use level-dependent formulas. Enter the attacker’s actual level; their damage is not a fixed range at every level."
            ],
            [
              "Grand Cross",
              "Deals 30% extra damage to Zombie-family targets. The family increase is rounded down before resistance. Against a wild Zombie taking 70% damage, your monster’s Grand Cross deals 163–191."
            ],
            [
              "Gigaslash",
              "Deals 30% extra damage when its user belongs to the Dragon family. Resistance is applied first, then the family increase, with each step rounded down."
            ]
          ],
          "links": [
            "skill-e0d84",
            "skill-e0e51",
            "skill-e0e59"
          ]
        },
        {
          "id": "calculator-scope",
          "title": "What the calculator’s range means",
          "paragraphs": [
            "The calculator covers normal attacks and 36 supported damage moves in ordinary wild battles. A range describes a successful, unguarded hit on one target. It does not predict hit chance, AI choices, or whether a monster has learned the selected move or has enough MP.",
            "Critical hits, guarding, charge, temporary buffs and debuffs, reflection, repeated-skill bonuses, multi-hit rules and special battle settings are outside these calculations. Use the skill’s own page for effects that the damage calculator does not cover."
          ],
          "links": [
            "field-skill-inheritance"
          ],
          "sources": [
            {
              "label": "Verified PSX combat rules and calculation scope",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/combat-evidence.md"
            },
            {
              "label": "Imported stats, equipment and resistance",
              "url": "https://github.com/dqm-psx/guide/blob/main/docs/save-planner-evidence.md"
            }
          ]
        }
      ]
    }
  ],
  "skill_requirements": {
    "1": {
      "level": 1,
      "mp": 7,
      "intelligence": 20
    },
    "2": {
      "level": 13,
      "mp": 46,
      "intelligence": 64
    },
    "3": {
      "level": 28,
      "mp": 112,
      "intelligence": 146
    },
    "4": {
      "level": 3,
      "mp": 11,
      "intelligence": 23
    },
    "5": {
      "level": 10,
      "mp": 34,
      "intelligence": 52
    },
    "6": {
      "level": 26,
      "mp": 96,
      "intelligence": 122
    },
    "7": {
      "level": 4,
      "mp": 13,
      "intelligence": 26
    },
    "8": {
      "level": 14,
      "mp": 50,
      "intelligence": 68
    },
    "9": {
      "level": 29,
      "mp": 120,
      "intelligence": 158
    },
    "10": {
      "level": 2,
      "mp": 10,
      "intelligence": 21
    },
    "11": {
      "level": 10,
      "mp": 38,
      "intelligence": 56
    },
    "12": {
      "level": 21,
      "mp": 104,
      "intelligence": 134
    },
    "13": {
      "level": 6,
      "mp": 20,
      "intelligence": 35
    },
    "14": {
      "level": 15,
      "mp": 54,
      "intelligence": 72
    },
    "15": {
      "level": 30,
      "mp": 128,
      "intelligence": 170
    },
    "16": {
      "level": 5,
      "mp": 16,
      "intelligence": 30
    },
    "17": {
      "level": 12,
      "mp": 42,
      "intelligence": 60
    },
    "18": {
      "level": 25,
      "mp": 88,
      "intelligence": 110
    },
    "19": {
      "level": 16,
      "mp": 58,
      "intelligence": 76
    },
    "20": {
      "level": 24,
      "mp": 80,
      "intelligence": 98
    },
    "21": {
      "level": 28,
      "mp": 40,
      "defense": 140,
      "intelligence": 6
    },
    "22": {
      "level": 1,
      "mp": 7,
      "intelligence": 6
    },
    "23": {
      "level": 10,
      "mp": 52,
      "intelligence": 48
    },
    "24": {
      "level": 16,
      "mp": 82,
      "intelligence": 80
    },
    "25": {
      "level": 20,
      "mp": 140,
      "intelligence": 120
    },
    "26": {
      "level": 28,
      "mp": 196,
      "intelligence": 160
    },
    "27": {
      "level": 1,
      "mp": 55,
      "intelligence": 6
    },
    "28": {
      "level": 10,
      "mp": 82,
      "intelligence": 48
    },
    "29": {
      "level": 16,
      "mp": 120,
      "intelligence": 120
    },
    "30": {
      "level": 14,
      "mp": 63,
      "intelligence": 54
    },
    "31": {
      "level": 27,
      "mp": 174,
      "intelligence": 152
    },
    "32": {
      "level": 32,
      "mp": 188,
      "intelligence": 176
    },
    "33": {
      "level": 5,
      "mp": 21,
      "intelligence": 20
    },
    "34": {
      "level": 6,
      "mp": 24,
      "intelligence": 26
    },
    "35": {
      "level": 8,
      "mp": 30,
      "intelligence": 22
    },
    "36": {
      "level": 7,
      "mp": 27,
      "intelligence": 24
    },
    "37": {
      "level": 2,
      "mp": 14,
      "intelligence": 12
    },
    "38": {
      "level": 6,
      "mp": 27,
      "intelligence": 24
    },
    "39": {
      "level": 4,
      "mp": 18,
      "intelligence": 15
    },
    "40": {
      "level": 8,
      "mp": 36,
      "intelligence": 32
    },
    "41": {
      "level": 1,
      "mp": 10,
      "intelligence": 8
    },
    "42": {
      "level": 5,
      "mp": 24,
      "intelligence": 20
    },
    "43": {
      "level": 3,
      "mp": 16,
      "intelligence": 14
    },
    "44": {
      "level": 7,
      "mp": 32,
      "intelligence": 28
    },
    "45": {
      "level": 17,
      "mp": 72,
      "intelligence": 66
    },
    "46": {
      "level": 10,
      "mp": 47,
      "intelligence": 41
    },
    "47": {
      "level": 4,
      "mp": 24,
      "intelligence": 16
    },
    "48": {
      "level": 11,
      "mp": 52,
      "intelligence": 46
    },
    "49": {
      "level": 13,
      "mp": 58,
      "intelligence": 28
    },
    "50": {
      "level": 7,
      "mp": 32,
      "intelligence": 52
    },
    "51": {
      "level": 9,
      "mp": 44,
      "intelligence": 38
    },
    "52": {
      "level": 12,
      "mp": 56,
      "intelligence": 49
    },
    "53": {
      "level": 15,
      "mp": 62,
      "intelligence": 58
    },
    "54": {
      "level": 16,
      "mp": 68,
      "intelligence": 62
    },
    "55": {
      "level": 20,
      "mp": 84,
      "intelligence": 78
    },
    "56": {
      "level": 18,
      "mp": 76,
      "intelligence": 70
    },
    "57": {
      "level": 19,
      "mp": 80,
      "intelligence": 74
    },
    "58": {
      "level": 21,
      "mp": 92,
      "intelligence": 88
    },
    "59": {
      "level": 23,
      "mp": 72,
      "intelligence": 90
    },
    "60": {
      "level": 40,
      "mp": 224,
      "intelligence": 236
    },
    "61": {
      "level": 38,
      "mp": 210,
      "intelligence": 224
    },
    "62": {
      "level": 36,
      "hp": 196,
      "mp": 196,
      "intelligence": 208
    },
    "63": {
      "level": 34,
      "hp": 184,
      "mp": 184,
      "intelligence": 224
    },
    "64": {
      "level": 3,
      "hp": 21
    },
    "65": {
      "level": 10,
      "hp": 70
    },
    "66": {
      "level": 20,
      "hp": 140
    },
    "67": {
      "level": 20,
      "hp": 210
    },
    "68": {
      "level": 3,
      "hp": 21
    },
    "69": {
      "level": 10,
      "hp": 70
    },
    "70": {
      "level": 20,
      "hp": 140
    },
    "71": {
      "level": 20,
      "hp": 210
    },
    "72": {
      "level": 13,
      "hp": 74,
      "attack": 60,
      "agility": 84
    },
    "73": {
      "level": 19,
      "hp": 112,
      "attack": 114,
      "agility": 132
    },
    "74": {
      "level": 10,
      "hp": 65,
      "attack": 90,
      "agility": 52
    },
    "75": {
      "level": 16,
      "hp": 124,
      "attack": 102
    },
    "76": {
      "level": 13,
      "hp": 74,
      "attack": 60,
      "agility": 84
    },
    "77": {
      "level": 19,
      "hp": 112,
      "attack": 114,
      "agility": 132
    },
    "78": {
      "level": 17,
      "hp": 84,
      "mp": 42,
      "agility": 68,
      "intelligence": 54
    },
    "79": {
      "level": 23,
      "hp": 128,
      "mp": 64,
      "agility": 82,
      "intelligence": 74
    },
    "80": {
      "level": 11,
      "hp": 77,
      "mp": 34,
      "attack": 66,
      "intelligence": 42
    },
    "81": {
      "level": 11,
      "hp": 77,
      "mp": 34,
      "attack": 66,
      "intelligence": 42
    },
    "82": {
      "level": 11,
      "hp": 77,
      "mp": 34,
      "attack": 66,
      "intelligence": 42
    },
    "83": {
      "level": 11,
      "hp": 77,
      "mp": 34,
      "attack": 66,
      "intelligence": 42
    },
    "84": {
      "level": 12,
      "hp": 62,
      "attack": 68,
      "agility": 72
    },
    "85": {
      "level": 12,
      "hp": 62,
      "attack": 72,
      "agility": 62
    },
    "86": {
      "level": 12,
      "hp": 62,
      "attack": 68,
      "agility": 62
    },
    "87": {
      "level": 12,
      "hp": 62,
      "attack": 68,
      "agility": 72
    },
    "88": {
      "level": 12,
      "hp": 68,
      "attack": 72,
      "agility": 62
    },
    "89": {
      "level": 12,
      "hp": 68,
      "attack": 62,
      "agility": 72
    },
    "90": {
      "level": 12,
      "hp": 64,
      "attack": 58,
      "agility": 62,
      "intelligence": 48
    },
    "91": {
      "level": 12,
      "hp": 64,
      "attack": 58,
      "agility": 62,
      "intelligence": 48
    },
    "92": {
      "level": 12,
      "hp": 68,
      "attack": 72,
      "agility": 62
    },
    "93": {
      "level": 12,
      "hp": 68,
      "attack": 72,
      "agility": 62
    },
    "94": {
      "level": 12,
      "hp": 68,
      "attack": 72,
      "agility": 62
    },
    "95": {
      "level": 5,
      "hp": 35,
      "attack": 50,
      "intelligence": 30
    },
    "96": {
      "level": 9,
      "hp": 63,
      "attack": 54,
      "intelligence": 54
    },
    "97": {
      "level": 7,
      "hp": 49,
      "attack": 42,
      "intelligence": 42
    },
    "98": {
      "level": 12,
      "hp": 72,
      "attack": 68,
      "agility": 82
    },
    "99": {
      "level": 19,
      "hp": 98,
      "attack": 88,
      "agility": 112
    },
    "100": {
      "level": 24,
      "hp": 124,
      "attack": 112,
      "agility": 136
    },
    "101": {
      "level": 15,
      "hp": 92,
      "attack": 90,
      "agility": 96
    },
    "102": {
      "level": 28,
      "hp": 154,
      "mp": 140,
      "attack": 168,
      "agility": 168,
      "intelligence": 148
    },
    "103": {
      "level": 33,
      "hp": 231,
      "mp": 164,
      "attack": 198,
      "agility": 198,
      "intelligence": 198
    },
    "104": {
      "level": 14,
      "hp": 98,
      "defense": 84
    },
    "105": {
      "level": 12,
      "hp": 74,
      "attack": 82,
      "defense": 68
    },
    "106": {
      "level": 20,
      "hp": 75,
      "attack": 70,
      "agility": 48
    },
    "107": {
      "level": 15,
      "hp": 106,
      "attack": 90
    },
    "108": {
      "level": 12,
      "hp": 84,
      "attack": 72,
      "agility": 72
    },
    "109": {
      "level": 8,
      "hp": 80,
      "attack": 80
    },
    "110": {
      "level": 14,
      "hp": 98,
      "attack": 84,
      "defense": 84
    },
    "111": {
      "level": 12,
      "hp": 70,
      "agility": 70
    },
    "112": {
      "level": 18,
      "hp": 126,
      "attack": 108,
      "defense": 108
    },
    "113": {
      "level": 10,
      "hp": 70,
      "intelligence": 60
    },
    "114": {
      "level": 16,
      "hp": 112,
      "intelligence": 96
    },
    "115": {
      "level": 9,
      "hp": 63,
      "intelligence": 54
    },
    "116": {
      "level": 14,
      "hp": 98,
      "intelligence": 84
    },
    "117": {
      "level": 15,
      "mp": 65,
      "agility": 82,
      "intelligence": 82
    },
    "118": {
      "level": 10,
      "hp": 54,
      "mp": 27,
      "agility": 63,
      "intelligence": 49
    },
    "119": {
      "level": 12,
      "hp": 68,
      "mp": 39,
      "agility": 85,
      "intelligence": 61
    },
    "120": {
      "level": 13,
      "hp": 74,
      "agility": 78,
      "intelligence": 78
    },
    "121": {
      "level": 20,
      "hp": 140,
      "mp": 72,
      "agility": 120,
      "intelligence": 120
    },
    "122": {
      "level": 14,
      "hp": 84,
      "agility": 98
    },
    "123": {
      "level": 30,
      "hp": 210,
      "agility": 180,
      "intelligence": 180
    },
    "124": {
      "level": 18,
      "hp": 114,
      "agility": 130,
      "intelligence": 96
    },
    "125": {
      "level": 9,
      "hp": 63,
      "agility": 54
    },
    "126": {
      "level": 10,
      "hp": 70,
      "agility": 70
    },
    "127": {
      "level": 12,
      "mp": 42,
      "agility": 72,
      "intelligence": 72
    },
    "128": {
      "level": 14,
      "mp": 65,
      "agility": 84,
      "intelligence": 84
    },
    "129": {
      "level": 23,
      "mp": 130,
      "intelligence": 170
    },
    "130": {
      "level": 21,
      "mp": 110,
      "intelligence": 150
    },
    "131": {
      "level": 20,
      "mp": 100,
      "intelligence": 140
    },
    "132": {
      "level": 22,
      "mp": 120,
      "intelligence": 160
    },
    "133": {
      "level": 20,
      "mp": 70,
      "intelligence": 90
    },
    "134": {
      "level": 25,
      "mp": 100,
      "intelligence": 120
    },
    "135": {
      "level": 30,
      "mp": 130,
      "intelligence": 150
    },
    "136": {
      "level": 35,
      "mp": 160,
      "intelligence": 180
    },
    "137": {
      "level": 17,
      "hp": 119,
      "defense": 102
    },
    "138": {
      "level": 18,
      "hp": 126,
      "defense": 108,
      "agility": 108,
      "intelligence": 108
    },
    "139": {
      "level": 7,
      "hp": 55,
      "agility": 67
    },
    "140": {
      "level": 13,
      "hp": 81,
      "agility": 94
    },
    "141": {
      "level": 6,
      "hp": 32,
      "attack": 31,
      "agility": 48
    },
    "142": {
      "level": 12,
      "hp": 66,
      "attack": 63,
      "agility": 77
    },
    "143": {
      "level": 10,
      "attack": 60,
      "agility": 60
    },
    "144": {
      "level": 14,
      "hp": 120
    },
    "145": {
      "level": 22,
      "hp": 140,
      "mp": 120,
      "attack": 120,
      "agility": 120,
      "intelligence": 120
    },
    "146": {
      "level": 16,
      "hp": 100,
      "agility": 120
    },
    "147": {
      "level": 17,
      "hp": 120,
      "attack": 100,
      "agility": 140
    },
    "148": {
      "level": 14,
      "hp": 98,
      "defense": 84
    },
    "149": {
      "level": 18,
      "hp": 126,
      "attack": 108,
      "defense": 108,
      "agility": 108
    },
    "150": {
      "level": 14,
      "hp": 98,
      "attack": 84,
      "defense": 84,
      "agility": 84
    },
    "151": {
      "level": 5,
      "hp": 35,
      "defense": 30,
      "agility": 30
    },
    "152": {
      "level": 12,
      "hp": 84,
      "defense": 72,
      "agility": 72
    },
    "153": {
      "level": 11,
      "hp": 75,
      "defense": 84,
      "agility": 70
    },
    "154": {
      "level": 19,
      "hp": 140,
      "defense": 126,
      "agility": 140
    },
    "155": {
      "level": 20,
      "hp": 100,
      "mp": 94,
      "defense": 84,
      "intelligence": 110
    },
    "156": {
      "level": 35,
      "hp": 87,
      "mp": 160,
      "intelligence": 220
    },
    "157": {
      "level": 13,
      "hp": 91,
      "defense": 78
    },
    "158": {
      "level": 21,
      "hp": 147,
      "mp": 147,
      "attack": 126,
      "defense": 126,
      "agility": 126,
      "intelligence": 126
    },
    "159": {
      "level": 26,
      "hp": 182,
      "defense": 156,
      "intelligence": 156
    },
    "160": {
      "level": 27,
      "hp": 198,
      "mp": 94,
      "agility": 145,
      "intelligence": 162
    },
    "161": {
      "level": 24,
      "hp": 116,
      "mp": 96,
      "agility": 78,
      "intelligence": 140
    },
    "162": {
      "level": 4,
      "mp": 28,
      "intelligence": 24
    },
    "163": {
      "level": 4,
      "mp": 28,
      "intelligence": 24
    },
    "164": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    },
    "165": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    },
    "166": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    },
    "167": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    },
    "168": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    },
    "169": {
      "level": 10,
      "mp": 40,
      "intelligence": 34
    }
  }
};

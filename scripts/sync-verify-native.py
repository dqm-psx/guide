"""Optional read-only verification of shipped monster facts against retail PSX.

Usage: python scripts/sync-verify-native.py --bin /path/to/original-japanese.bin
No disc, executable, asset, user path, or personal metadata is written.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
RETAIL_SHA256 = 'a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29'
PARAM_BASE = 0x80114CB8
POINTERS = 0x80124518
GROWTH = 0x801277C4
STATS = ('hp', 'mp', 'attack', 'defense', 'agility', 'intelligence')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def extent(image, lba, size):
    require(lba >= 0 and size > 0 and (lba + (size + 2047) // 2048) * 2352 <= len(image), 'Disc extent outside input')
    chunks = []
    for sector in range(lba, lba + (size + 2047) // 2048):
        raw = image[sector * 2352:(sector + 1) * 2352]
        require(raw[:12] == b'\x00' + b'\xff' * 10 + b'\x00' and raw[15] == 2 and raw[16:20] == raw[20:24] and not raw[18] & 0x20, 'Invalid mode-2 form-1 sector')
        chunks.append(raw[24:2072])
    return b''.join(chunks)[:size]


def decompress(data):
    require(len(data) >= 4, 'Truncated library resource')
    size = struct.unpack_from('<I', data)[0]
    require(size <= 0x1000000, 'Invalid decoded size')
    bitpos = 32

    def bits(count):
        nonlocal bitpos
        require(bitpos + count <= len(data) * 8, 'Truncated compressed bits')
        value = int.from_bytes(data[bitpos // 8:bitpos // 8 + 5], 'little') >> (bitpos % 8)
        bitpos += count
        return value & ((1 << count) - 1)

    output, width, mask = bytearray(), 0, 0
    while len(output) < size:
        if bits(1) == 0:
            output.append(bits(8))
        else:
            distance, length = bits(width), bits(4)
            require(length > 0 and distance <= len(output), 'Invalid back-reference')
            for _ in range(min(length, size - len(output))):
                output.append(output[-distance] if distance else 0)
        if width < 10 and mask < len(output):
            while mask < len(output):
                mask = mask * 2 + 1
                width += 1
    return bytes(output)


def verify(image, baseline):
    require(hashlib.sha256(image).hexdigest() == RETAIL_SHA256, 'Expected the supported original Japanese SLPM-87050 disc')
    exe = extent(image, 93985, 899072)

    def resource(index):
        offset, size = struct.unpack_from('<II', exe, 0x7EA10 + index * 8)
        require(offset % 2048 == 0, 'Invalid archive extent')
        return extent(image, 23 + offset // 2048, size)

    params = resource(104)
    for span in baseline['metadata']['native_evidence']['resource_104_spans']:
        start, end = int(span['start'], 16), int(span['end'], 16)
        actual = hashlib.sha256(params[start - PARAM_BASE:end - PARAM_BASE]).hexdigest()
        require(actual == span['sha256'], f'Native parameter evidence differs at {span["start"]}')
    pointers = struct.unpack_from('<11I', params, POINTERS - PARAM_BASE)
    verified = 0
    identities = {}
    for species in baseline['species']:
        family, member = species['family_id'], species['member']
        if family is None:
            continue
        identities[(family, member)] = species
        at = pointers[family] - PARAM_BASE + member * 12
        end = (pointers[family + 1] if family < 10 else POINTERS) - PARAM_BASE
        require(0 <= at and at + 12 <= end, 'Species parameter outside native table')
        row = params[at:at + 12]
        stats = species['stats']
        if stats['status'] != 'verified':
            require(row[1] == 0, 'A native parameter row was incorrectly marked as a placeholder')
            continue
        require(stats['base_level_limit'] == row[1] and stats['experience_curve'] == row[2], 'Native limit or XP curve differs')
        for offset, name in enumerate(STATS):
            selector = row[offset + 6]
            require(stats['growth_selectors'][name] == selector, 'Native growth selector differs')
            gains = [params[GROWTH - PARAM_BASE + level * 32 + selector] for level in range(1, 100)]
            require(stats['growth'][name] == gains, f'Native {name} gains differ for species {species["index"]}')
        for skills in species['skills'].values():
            require([skill['id'] for skill in skills] == [v for v in row[3:6] if v != 255], 'Native skill identities differ')
        verified += 1
    library = struct.unpack_from('<312I', exe, 0x8008DCB8 - 0x8000F800)
    for position, resource_id in enumerate(library):
        raw = decompress(resource(resource_id))
        header, traits = struct.unpack_from('<II', raw)
        identity = ((header >> 6) & 15, header & 63)
        species = identities[identity]
        require(traits & 0x1FF == position, 'Library ordinal differs')
        require(species['library']['source']['text_id'] == f'library_monster_{position:03d}', 'Library caption mapped to the wrong species')
        require(species['library']['source']['archive_index'] == resource_id, 'Library archive identity differs')
        for game, ids in [('terry', raw[6:9]), ('cobi', raw[9:12]), ('tara', raw[9:12])]:
            require([s['id'] for s in species['skills'][game]] == [v for v in ids if v != 255], 'Library skill identity differs')
    return verified


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin', required=True)
    args = parser.parse_args()
    baseline = json.loads((ROOT / 'data/monster-baseline.json').read_text(encoding='utf8'))
    count = verify(Path(args.bin).read_bytes(), baseline)
    print(f'Verified {count} native stat profiles (315 standard species), all growth values, natural skill IDs, and all 312 library mappings against the authenticated retail PSX disc.')

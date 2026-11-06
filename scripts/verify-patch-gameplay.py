"""Compare guide mechanics with a locally built, release-manifest-matched patch.

Reads disc bytes locally. Writes only version identifiers, hashes, and counts;
never copies game assets, release notes, or filesystem paths into the guide.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_verifier', ROOT / 'scripts/sync-verify-native.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
require = native.require


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical_digest(value):
    return digest(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))


def verify_patch(image, release, baseline, breeding):
    require(re.fullmatch(r'v\d+\.\d+\.\d+', release['version']), 'Invalid release version')
    require(release['edition'] == 'current', 'Expected the current English edition')
    require(re.fullmatch(r'[a-f0-9]{40}', release['source_commit']), 'Invalid source revision')
    require(release['original_bin_sha256'] == native.RETAIL_SHA256, 'Unexpected original disc')
    for value in [release['patched_bin_sha256'], release['archive']['sha256']]:
        require(re.fullmatch(r'[a-f0-9]{64}', value), 'Invalid release hash')
    profiles = native.verify(image, baseline, release['patched_bin_sha256'])
    exe = native.extent(image, 93985, 899072)

    def resource(index):
        offset, size = struct.unpack_from('<II', exe, 0x7EA10 + index * 8)
        require(offset % 2048 == 0, 'Invalid archive offset')
        return native.extent(image, 23 + offset // 2048, size)

    def verify_span(raw, start, end, expected):
        require(0 <= start < end <= len(raw), 'Evidence span is outside input')
        require(digest(raw[start:end]) == expected, f'Gameplay code changed at offset {start:#x}')

    for span in baseline['metadata']['native_evidence']['executable_spans']:
        verify_span(exe, int(span['start'], 16) - 0x8000F800,
                    int(span['end'], 16) - 0x8000F800, span['sha256'])
    rules = breeding['runtime_rules']
    for span in rules['verification']:
        verify_span(exe, int(span['start_pc'], 16) - 0x8000F800,
                    int(span['end_pc_exclusive'], 16) - 0x8000F800, span['sha256'])
    contexts = rules['context_verification']['verification']
    for span in contexts:
        if span['kind'] == 'executable':
            verify_span(exe, int(span['start_pc'], 16) - 0x8000F800,
                        int(span['end_pc_exclusive'], 16) - 0x8000F800, span['sha256'])
        else:
            require(span['kind'] == 'archive_resource', 'Unknown source evidence kind')
            verify_span(resource(span['archive_index']), int(span['start_offset'], 16),
                        int(span['end_offset_exclusive'], 16), span['sha256'])

    # Reconstruct all compact runs and compare every ordered outcome with the
    # guide, rather than assuming an unchanged table hash proves the JS data.
    packed = resource(breeding['metadata']['provenance']['breeding_resource']['archive_index'])
    expected = breeding['metadata']['provenance']['breeding_resource']
    require(digest(packed) == expected['resource_sha256'], 'Breeding resource changed')
    raw = native.decompress(packed)
    require(digest(raw) == expected['decoded_sha256'], 'Breeding encoding changed')
    families = struct.unpack_from('<12H', exe, 0x8008A040 - 0x8000F800)
    dimension = len(breeding['matrix'])
    require(dimension == 326, 'Unexpected matrix dimension')
    offsets = struct.unpack_from('<326H', raw)
    pairs = 0
    for row, start in enumerate(offsets):
        end = offsets[row + 1] if row + 1 < dimension else len(raw)
        require(652 <= start < end <= len(raw) and (end - start) % 4 == 0, 'Invalid matrix run extent')
        column = 0
        require(len(breeding['matrix'][row]) == dimension, 'Unexpected matrix row width')
        for at in range(start, end, 4):
            boundary, value = struct.unpack_from('<HH', raw, at)
            family, member_offset = value & 255, value >> 8
            require(family < 11 and column < boundary <= dimension, 'Invalid matrix run')
            species = families[family] + member_offset
            require(all(result == species for result in breeding['matrix'][row][column:boundary]),
                    f'Guide breeding result differs in row {row}')
            pairs += boundary - column
            column = boundary
        require(column == dimension, 'Incomplete matrix row')

    return {
        'schema_version': 1, 'version': release['version'], 'edition': release['edition'],
        'source_revision': release['source_commit'],
        'patched_bin_sha256': release['patched_bin_sha256'],
        'package_sha256': release['archive']['sha256'],
        'baseline_sha256': canonical_digest(baseline),
        'breeding_sha256': canonical_digest(breeding),
        'verified': {
            'ordered_pairings': pairs, 'stat_profiles': profiles,
            'standard_stat_profiles': sum(s['index'] < 315 and s['stats']['status'] == 'verified' for s in baseline['species']),
            'library_mappings': 312, 'rule_code_spans': len(rules['verification']),
            'context_code_spans': len(contexts),
        },
        'scope': 'Release-matched disc verification of all ordered breeding outcomes, native special-rule and breeding-context code, base level limits, six-stat growth, natural skill IDs, and library identity mappings. Encounter coverage, acquisition, and resistance meanings are not reverified by this check.',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin', required=True)
    parser.add_argument('--release-manifest', required=True)
    parser.add_argument('--output', default=str(ROOT / 'data/gameplay-verification.json'))
    args = parser.parse_args()
    release = json.loads(Path(args.release_manifest).read_text(encoding='utf-8-sig'))
    baseline = json.loads((ROOT / 'data/monster-baseline.json').read_text(encoding='utf-8'))
    script = (ROOT / 'data/breeding-data.js').read_text(encoding='utf-8').strip()
    prefix = 'globalThis.DATA = '
    require(script.startswith(prefix) and script.endswith(';'), 'Unexpected breeding data format')
    breeding = json.loads(script[len(prefix):-1])
    proof = verify_patch(Path(args.bin).read_bytes(), release, baseline, breeding)
    Path(args.output).write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Verified {proof['version']}: {proof['verified']['ordered_pairings']} pairings, {proof['verified']['stat_profiles']} stat profiles, 312 library mappings, and native breeding rule/context evidence.")

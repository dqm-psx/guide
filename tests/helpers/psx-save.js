// Synthetic save writer for reader tests. Contains no player saves or artwork.
function finishBlock(bytes) {
  bytes.writeUInt32LE(0, 0x120);
  const sum = bytes.subarray(0, 0x1fe8).reduce((a, b) => a + b, 0) - bytes[0x1fc7];
  bytes.writeUInt32LE(sum, 0x120);
  return bytes;
}

function block(variant = 0) {
  const bytes = Buffer.alloc(8192);
  bytes.set([0x53, 0x43, 0x11, 1]);
  bytes.write('DQM1/2 MAIN SAVE BLOCK BY YOK\0', 0x100, 'ascii');
  bytes.writeUInt16LE(19, 0x124);
  bytes[0x126] = 12;
  bytes[0x12c] = variant | 4;
  bytes[0x171] = variant << 2;
  bytes.writeUInt16LE(2 | (31 << 5) | (31 << 10), 0x14c);
  bytes[0x150] = 1;
  for (let i = 0; i < 50; i++) bytes.fill(0xff, 0x250 + 136 * i + 0x7c, 0x250 + 136 * i + 0x86);
  function monster(i, packed, flags, name) {
    const at = 0x250 + 136 * i;
    bytes[at + 0x7c] = 0x0a;
    bytes.writeUInt32LE(packed >>> 0, at + 4);
    bytes.writeUInt16LE(flags, at + 0x1c);
    bytes.set(name, at + 0x81);
  }
  monster(0, (1 << 4) | (9 << 10) | (1 << 17) | (10 << 18), 0x2000, [0xe5]);
  monster(2, 1 | (1 << 4) | (12 << 10) | (30 << 18), 0x2000, [0x0b, 0x4e, 0x41]);
  monster(30, (2 << 4) | (5 << 18), 0x1000, [0x10]);
  monster(31, 1 << 4, 0x8000, [0x11]);
  monster(32, 1 << 4, 0x4000, [0x11]);
  monster(33, 1 << 4, 0x2100, [0x11]);
  monster(34, 15, 0x1000, [0x11]);
  return finishBlock(bytes);
}

function card(slots) {
  const bytes = Buffer.alloc(131072);
  bytes.write('MC');
  for (const [physical, slot, block] of slots) {
    const at = physical * 128;
    bytes[at] = 0x51;
    bytes.writeUInt32LE(8192, at + 4);
    bytes.writeUInt16LE(0xffff, at + 8);
    bytes.write('BISLPM-87050DQM-S' + String(slot).padStart(2, '0'), at + 10, 'ascii');
    bytes[at + 127] = bytes.subarray(at, at + 127).reduce((a, b) => a ^ b, 0);
    bytes.set(block, physical * 8192);
  }
  return bytes;
}
module.exports = {block, card, finishBlock};

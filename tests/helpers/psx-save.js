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
function putBits(bytes, at, first, count, value) {
  for(let bit=0;bit<count;bit++) {
    const offset=at+((first+bit)>>3),mask=1<<((first+bit)&7);
    bytes[offset]=(bytes[offset]&~mask)|(((value>>bit)&1)?mask:0);
  }
}
function planningBlock(variant=0) {
  const bytes=block(variant);
  for(const slot of [0,2,30]) {
    const at=0x250+slot*136;
    putBits(bytes,at+4,25,7,55);
    putBits(bytes,at+8,0,10,237);putBits(bytes,at+8,10,10,85);
    [450,220,180,155,300,277].forEach((value,i)=>putBits(bytes,at+0x0c+Math.floor(i/2)*4,(i%2)*10,10,value));
    putBits(bytes,at+0x18,8,5,5); // Ice Fang: +50 Attack, no base-stat change.
    const resistance=Array.from({length:27},(_,i)=>i%8);
    for(let i=0;i<16;i++)putBits(bytes,at+8+Math.floor(i/4)*4,20+(i%4)*3,3,resistance[i]);
    for(let i=16;i<22;i++)putBits(bytes,at+0x18,13+(i-16)*3,3,resistance[i]);
    for(let i=22;i<27;i++)putBits(bytes,at+0x1c,16+(i-22)*3,3,resistance[i]);
    for(let i=0;i<9;i++)putBits(bytes,at+0x40,i*3,3,i>=3?4:0); // No parental candidates.
    bytes.set([4,10,23],at+0x48);
    bytes.fill(255,at+0x20,at+0x25);bytes[at+0x45]=255;
    putBits(bytes,at+0x20,0,5,9);putBits(bytes,at+0x45,0,1,0); // First direct candidate: skill 4.
    putBits(bytes,at+0x20,5,5,0);putBits(bytes,at+0x45,1,1,0);bytes[at+0x86]=2; // Special selector 0.
  }
  return finishBlock(bytes);
}
function candidateBlock(delta=4) {
  const bytes=planningBlock(2),at=0x250+2*136;
  for(let i=0;i<3;i++)putBits(bytes,at+0x40,i*3,3,i===0?delta:4);
  bytes.fill(0,at+0x48,at+0x58);
  bytes.fill(255,at+0x20,at+0x25);bytes[at+0x45]=255;bytes[at+0x86]=0;
  return finishBlock(bytes);
}
// Two active monsters and one in storage. Direct candidates outside the eight
// learned selectors must never be counted as battle commands.
function comboBlock({variant=0, first=[15,3], second=[15,18], farm=[103], firstMp=85, secondMp=85, firstHp=237, secondHp=237}={}) {
  const bytes=planningBlock(variant);
  bytes.writeUInt16LE(2 | (31 << 10),0x14c);
  bytes[0x150]=2;
  for (const [slot,skills,hp,mp] of [[2,first,firstHp,firstMp],[0,second,secondHp,secondMp],[30,farm,237,85]]) {
    const at=0x250+slot*136;
    putBits(bytes,at+8,0,10,hp);
    putBits(bytes,at+8,10,10,mp);
    bytes.fill(0,at+0x48,at+0x58);
    bytes.set([...skills,103],at+0x48);
    bytes.fill(255,at+0x20,at+0x25);
    bytes[at+0x45]=255;
    bytes[at+0x86]=0;
    skills.forEach((_,i)=>{
      putBits(bytes,at+0x20,i*5,5,9+i);
      putBits(bytes,at+0x45,i,1,0);
    });
  }
  return finishBlock(bytes);
}
function adventureBlock(variant = 0) {
  const bytes = planningBlock(variant);
  putBits(bytes, 0x14c, 15, 17, 12345);
  putBits(bytes, 0x150, 12, 20, 543210);
  putBits(bytes, 0x150, 2, 5, 4);
  [1, 44, 1, 69, 6].forEach((id, i) => putBits(bytes, 0x157, 7 * i, 7, id));
  [2, 44].forEach((id, i) => putBits(bytes, 0x172, 7 * i, 7, id));
  [24, 3].forEach((n, i) => putBits(bytes, 0x1ca, 7 * i, 7, n));
  // First/last actual library species, two family boundaries and a member 32.
  for (const bit of [1, 26, 28, 91, 322]) putBits(bytes, 0x222, bit, 1, 1);
  bytes[0x1f38] = 17;
  bytes[0x1ef0] = 0x0b; // Warubou's first keys, Pirate Key, and Sky Key.
  putBits(bytes, 0x1ce0 + 12 * 16 + 4, 14, 2, 3);
  putBits(bytes, 0x1ce0 + 31 * 16 + 4, 14, 2, 1);
  // Aibou has a named internal record outside the standard breeding roster.
  const at = 0x250 + 35 * 136;
  bytes[at + 0x7c] = 10;
  bytes.writeUInt16LE(0x2000, at + 0x1c);
  bytes.writeUInt32LE((34 << 4) | 10 | (11 << 10) | (1 << 17) | (20 << 18), at + 4);
  return finishBlock(bytes);
}

function pedigreeBlock() {
  const bytes=planningBlock(2),at=0x250+2*136;
  putBits(bytes,at+0x58,0,24,0x123456);putBits(bytes,at+0x5b,0,24,273);
  bytes[at+0x18]=22;bytes.set([192,96,0],at+0x25);
  for(const [i,member,family,plus,sex] of [[0,1,0,7,1],[1,1,1,15,0]]){
    const bit=i*18;
    putBits(bytes,at+0x72,bit,6,member);putBits(bytes,at+0x72,bit+6,4,family);
    putBits(bytes,at+0x72,bit+10,7,plus);putBits(bytes,at+0x72,bit+17,1,sex);
  }
  bytes.set([10,11,255,255,255,12,13,255,255,255],at+0x68);
  putBits(bytes,at+0x72,36,6,2);
  putBits(bytes,at+0x72,69,6,1);putBits(bytes,at+0x72,79,1,1);
  return finishBlock(bytes);
}
module.exports = {block, card, finishBlock, putBits, planningBlock, candidateBlock, comboBlock, adventureBlock, pedigreeBlock};

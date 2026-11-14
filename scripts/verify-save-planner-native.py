"""Compare the shipped JavaScript importer with native UnpackSaveFile using synthetic saves."""
import argparse
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin',type=Path,required=True)
    parser.add_argument('--original-bin',type=Path,required=True)
    parser.add_argument('--python-packages',type=Path)
    args=parser.parse_args()
    if args.python_packages:sys.path.insert(0,str(args.python_packages))
    from unicorn import Uc,UC_ARCH_MIPS,UC_MODE_MIPS32,UC_MODE_LITTLE_ENDIAN,UC_HOOK_MEM_INVALID
    from unicorn import mips_const as reg
    spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build-save-reference.py')
    builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
    current,original=args.bin.read_bytes(),args.original_bin.read_bytes()
    disc_hash=builder.world.digest(current)
    builder.build(current,original,expected_disc_hash=disc_hash)
    program="""
      require('./data/breeding-data');require('./data/save-reference');
      const {planningBlock,putBits,finishBlock}=require('./tests/helpers/psx-save');
      const {read}=require('./js/save-import');const cases=[];
      for(let campaign=0;campaign<3;campaign++)for(let accessory=0;accessory<32;accessory++){
        const bytes=planningBlock(campaign);
        for(const slot of [0,2,30]){const at=0x250+slot*136;putBits(bytes,at+0x18,8,5,accessory);
          putBits(bytes,at+8,0,10,slot===30?0:slot*53);
          putBits(bytes,at+8,10,10,slot===2?0:accessory*6);
          if(accessory%2)putBits(bytes,at+0x10,0,10,990);
          // Both parents, upgraded natural candidates, the last direct slot,
          // special selector 33 (high bit), and all eight learned slots.
          if(accessory%3===0){
            putBits(bytes,at+0x72,0,6,1);putBits(bytes,at+0x72,6,4,0);
            putBits(bytes,at+0x72,18,6,1);putBits(bytes,at+0x72,24,4,1);
            for(let i=3;i<9;i++)putBits(bytes,at+0x40,i*3,3,i===3?1:0);
            bytes[at+0x57]=169;bytes[at+0x86]=128;
            [0,3,6,9,10,11,24,33].forEach((selector,i)=>{putBits(bytes,at+0x20,i*5,5,selector&31);putBits(bytes,at+0x45,i,1,selector>>5);});
          }}
        finishBlock(bytes);cases.push({campaign,accessory,bytes:Array.from(bytes),entries:read(bytes,DATA.species,SAVE_REFERENCE).saves[0].entries});
      }console.log(JSON.stringify(cases));
    """
    cases=json.loads(subprocess.check_output(['node','-e',program],cwd=ROOT,text=True))
    reports=[]
    for label,image in [('retail Japanese',original),(builder.ENGLISH_DISCS[disc_hash],current)]:
        disc=builder.world.Disc(image)
        cpu=Uc(UC_ARCH_MIPS,UC_MODE_MIPS32|UC_MODE_LITTLE_ENDIAN)
        def invalid(cpu,access,address,size,value,user):
            print(f'Unmapped native access at {address:#x}, PC {cpu.reg_read(reg.UC_MIPS_REG_PC):#x}',file=sys.stderr,flush=True)
            return False
        cpu.hook_add(UC_HOOK_MEM_INVALID,invalid)
        cpu.mem_map(0,0x200000);cpu.mem_write(0x10000,disc.exe[0x800:])
        # Only environmental allocation, reset and party movement are stubbed.
        # UnpackSaveFile, skill selectors, GetSpeciesIndex and RestoreEquipment execute unchanged.
        for address in [0x12F90,0x20CF4,0x13474]:cpu.mem_write(address,struct.pack('<II',0x03E00008,0x00001021))
        cpu.mem_write(0x20C28,struct.pack('<IIII',0x3C028018,0x34423000,0x03E00008,0))
        checked=0
        for case in cases:
            cpu.mem_write(0xCACD0,bytes(50*256))
            cpu.mem_write(0x180000,bytes(case['bytes']))
            cpu.mem_write(0x170000,disc.resource(3655 if case['campaign']==0 else 3656))
            cpu.mem_write(0xC75B4,struct.pack('<I',0x80170000))
            for register,value in [('A0',0x80180000),('RA',0x80001000),('SP',0x801FF000),('GP',0x800C7050)]:cpu.reg_write(getattr(reg,'UC_MIPS_REG_'+register),value)
            try:cpu.emu_start(0x8002667C,0x80001000,count=3000000)
            except Exception as error:
                raise ValueError('Native execution stopped at '+hex(cpu.reg_read(reg.UC_MIPS_REG_PC))+' '+str({key:hex(cpu.reg_read(getattr(reg,'UC_MIPS_REG_'+key))) for key in ['A0','A1','V0','V1','RA','S0','S1']})) from error
            builder.world.require(cpu.reg_read(reg.UC_MIPS_REG_PC)==0x80001000,'UnpackSaveFile did not finish')
            builder.world.require(cpu.reg_read(reg.UC_MIPS_REG_V0)==0,'Synthetic save rejected by native checksum')
            for entry,slot in zip(case['entries'],[2,0,30]):
                row=bytes(cpu.mem_read(0xCACD0+slot*256,256));actual=entry['saveDetails']
                expected={'baseStats':dict(zip(['hp','mp','attack','defense','agility','intelligence'],struct.unpack_from('<6H',row,0xB4))),
                          'currentHp':struct.unpack_from('<H',row,0xA0)[0],'currentMp':struct.unpack_from('<H',row,0xA4)[0],
                          'battleStats':dict(zip(['hp','mp','attack','defense','agility','intelligence'],[struct.unpack_from('<H',row,at)[0] for at in [0xA2,0xA6,0xA8,0xAA,0xAC,0xAE]])),
                          'resistances':list(row[0xC0:0xDB]),'levelCap':row[0x9B],
                          'knownSkills':list(dict.fromkeys(v for v in row[0x78:0x80] if v)),
                          'inheritedSkills':list(dict.fromkeys(v for v in row[0x80:0x99] if v)),
                          'equipmentId':row[0xDB] or None}
                for field,value in expected.items():
                    builder.world.require(actual[field]==value,f'{label}, campaign {case["campaign"]}, accessory {case["accessory"]}, slot {slot}: {field}: JS {actual[field]} != native {value}')
                checked+=1
        reports.append({'disc':label,'saveCases':len(cases),'monsterComparisons':checked})
    print(json.dumps({'passed':True,'discs':reports},indent=2))


if __name__=='__main__':main()

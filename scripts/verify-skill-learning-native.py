"""Execute native threshold and candidate scans on retail and English v1.0.73."""
import argparse
import importlib.util
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin',type=Path,required=True)
    parser.add_argument('--original-bin',type=Path,required=True)
    parser.add_argument('--python-packages',type=Path)
    args=parser.parse_args()
    if args.python_packages:sys.path.insert(0,str(args.python_packages))
    from unicorn import Uc,UC_ARCH_MIPS,UC_MODE_MIPS32,UC_MODE_LITTLE_ENDIAN
    from unicorn import mips_const as reg
    spec=importlib.util.spec_from_file_location('skill_builder',ROOT/'scripts/build-skill-learning-reference.py')
    builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
    current,original=args.bin.read_bytes(),args.original_bin.read_bytes()
    data=builder.build(current,original)
    reports=[]
    offsets={'level':0x9a,'hp':0xb4,'mp':0xb6,'attack':0xb8,'defense':0xba,'agility':0xbc,'intelligence':0xbe}
    for label,image in [('retail Japanese',original),('English v1.0.73',current)]:
        disc=builder.world.Disc(image);raw=disc.resource(104)
        cpu=Uc(UC_ARCH_MIPS,UC_MODE_MIPS32|UC_MODE_LITTLE_ENDIAN)
        cpu.mem_map(0,0x200000);cpu.mem_write(0x10000,disc.exe[0x800:]);cpu.mem_write(0x114CB8,raw)
        def monster(values,known=(),candidates=()):
            row=bytearray(256)
            row[0x78:0x80]=bytes(list(known)+[0]*(8-len(known)))
            row[0x80:0x99]=bytes(list(candidates)+[0]*(25-len(candidates)))
            for field,value in values.items():
                if field=='level':row[offsets[field]]=value
                else:struct.pack_into('<H',row,offsets[field],value)
            cpu.mem_write(0x180000,bytes(row))
        def registers(values):
            for name,value in values.items():cpu.reg_write(getattr(reg,'UC_MIPS_REG_'+name),value)
        def threshold(pointer,values):
            monster(values)
            registers({'A0':pointer,'A1':0x80180000,'RA':0x80001000,'SP':0x801FF000})
            cpu.emu_start(0x80122724,0x80001000,count=2000)
            builder.require(cpu.reg_read(reg.UC_MIPS_REG_PC)==0x80001000,'Native threshold did not finish')
            return cpu.reg_read(reg.UC_MIPS_REG_V0)
        def scan(values,known=(),candidates=()):
            monster(values,known,candidates)
            cpu.mem_write(0x181000,b'\xff'*256);cpu.mem_write(0x110BA8,b'\xff'*256)
            registers({'A0':0x80181000,'A1':0x80180000,'RA':0x80001000,'SP':0x801FF000})
            cpu.emu_start(0x801222DC,0x80001000,count=30000)
            builder.require(cpu.reg_read(reg.UC_MIPS_REG_PC)==0x80001000,'Native scan did not finish')
            output=bytes(cpu.mem_read(0x181000,256));events=[];pos=0
            while output[pos]!=255:
                tag,value=output[pos:pos+2];pos+=2
                events.append(('natural' if tag==254 else 'combination' if tag==252 else 'upgrade',value))
            return events,list(cpu.mem_read(0x180078,8))
        records=[]
        for skill in data['skills']:
            pointer=struct.unpack_from('<I',raw,0x80128AA4-builder.BASE+skill['skillId']*4)[0]
            records.append((pointer,skill['requirements']))
        combo_pointers=struct.unpack_from('<34I',raw,0x80128F6C-builder.BASE)
        pos=0x801290A0-builder.BASE;index=0
        while raw[pos]!=255:
            pos+=1
            while raw[pos]!=253:pos+=1
            pos+=1;target=raw[pos];pos+=1
            combo=data['skills'][target-1]['combinations'][0]
            records.append((combo_pointers[index],combo['requirements']));index+=1
        threshold_cases=0
        for pointer,requirements in records:
            builder.require(threshold(pointer,requirements)==255,'Exact native minimum failed');threshold_cases+=1
            for field,value in requirements.items():
                builder.require(threshold(pointer,{**requirements,field:value-1})==list(offsets).index(field)+1,
                                'Native boundary differs');threshold_cases+=1
        route_cases=0;order_interactions=0
        maximum={key:(99 if key=='level' else 999) for key in offsets}
        for skill in data['skills']:
            events,_=scan(maximum,candidates=[skill['skillId']])
            builder.require(('natural',skill['skillId']) in events,'Native direct candidate not offered');route_cases+=1
            if skill['upgradesFrom'] is not None:
                events,_=scan(maximum,known=[skill['upgradesFrom']])
                builder.require(('upgrade',skill['skillId']) in events,'Native upgrade not offered');route_cases+=1
            for combo in skill['combinations']:
                for values in [combo['requirements'],maximum]:
                    events,after=scan(values,known=combo['requiredSkillIds'])
                    expected=all(required in after for required in combo['requiredSkillIds']) and skill['skillId'] not in after
                    if (('combination',skill['skillId']) in events)!=expected:
                        builder.require(skill['skillId']==135 and values==combo['requirements'] and expected and not events,
                                        'Unexpected native combination-order difference')
                        order_interactions+=1
                    route_cases+=1
        builder.require(order_interactions==1,'Expected native ordering fixture changed')
        repaired={**data['skills'][134]['combinations'][0]['requirements']}
        for key,value in data['skills'][97]['combinations'][0]['requirements'].items():repaired[key]=max(repaired.get(key,0),value)
        events,_=scan(repaired,known=[42,104,133])
        builder.require(('combination',135) in events,'Meeting earlier combination did not restore the later offer')
        route_cases+=1
        reports.append({'disc':label,'thresholdRecords':len(records),'thresholdBoundaryCases':threshold_cases,'candidateRouteCases':route_cases,'combinationOrderInteractions':order_interactions})
    print(json.dumps({'passed':True,'discs':reports},indent=2))


if __name__=='__main__':main()

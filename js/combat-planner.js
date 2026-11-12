/* Successful-hit ranges from the PSX native handlers. See docs/combat-evidence.md. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DQMCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const scales = Object.freeze({
    spell: Object.freeze({saved: Object.freeze([100,85,75,65,50,30,15,0]), wild: Object.freeze([100,75,30,0])}),
    breath: Object.freeze({saved: Object.freeze([100,80,70,60,40,30,10,0]), wild: Object.freeze([100,70,30,0])}),
  });
  const supportedIds = new Set([...Array.from({length:18},(_,i)=>i+1),...Array.from({length:16},(_,i)=>i+62),102,103]);
  function integer(value,min,max,name) {
    if (!Number.isInteger(value) || value<min || value>max) throw new RangeError(name+' must be a whole number from '+min+' to '+max+'.');
    return value;
  }
  function range(value,max,name) {
    if (!Array.isArray(value) || value.length!==2) throw new TypeError(name+' must be a two-value range.');
    value.forEach(v=>integer(v,0,max,name));
    if (value[0]>value[1]) throw new RangeError(name+' range is reversed.');
    return value;
  }
  function physicalUnchecked(attack,defense) {
    const base=Math.floor((attack-Math.floor(defense/2))/2);
    if (base<=0) return [0,1];
    if (base<=Math.floor(attack/16)) return [0,Math.floor(attack/16)];
    const width=Math.floor(base/16);
    return [base-width-1,base+width+1];
  }
  function physicalRange(attack,defense) {
    integer(attack,0,999,'Attack'); integer(defense,0,999,'Defense');
    return physicalUnchecked(attack,defense);
  }
  function physicalEnvelope(attacks,defenses) {
    range(attacks,999,'Attack'); range(defenses,999,'Defense');
    // Low-damage branches are not monotone; checking two corners loses outcomes.
    let low=Infinity,high=0;
    for(let a=attacks[0];a<=attacks[1];a++) for(let d=defenses[0];d<=defenses[1];d++) {
      const values=physicalUnchecked(a,d); low=Math.min(low,values[0]); high=Math.max(high,values[1]);
    }
    return [low,high];
  }
  function wildStatRange(base,stat) {
    integer(base,0,65535,'Encounter base stat');
    if (!['hp','mp','attack','defense','agility','intelligence'].includes(stat)) throw new RangeError('Unknown combat stat.');
    const low=Math.floor(base*8/10),high=Math.floor(base*11/10),cap=stat==='hp'?32767:999;
    if ((low|high)&0x8000) return [1,1];
    return [Math.max(1,Math.min(cap,low)),Math.max(1,Math.min(cap,high))];
  }
  function skillOutcome(skill,options={}) {
    if (!skill || !supportedIds.has(skill.skillId)) return {kind:'unsupported'};
    const {target,user=null,wildTarget=true,enemyUser=false,level=1,resistanceCode}=options;
    if (typeof wildTarget!=='boolean' || typeof enemyUser!=='boolean') throw new TypeError('Target and user modes must be booleans.');
    const channelId=integer(skill.resistanceChannelId,1,27,'Resistance channel');
    const percentages=scales[skill.scale]?.[wildTarget?'wild':'saved'];
    if (!percentages) throw new RangeError('Unknown damage scale.');
    const overriddenResistance=resistanceCode!==undefined;
    const code=integer(overriddenResistance?resistanceCode:target?.[wildTarget?'wildResistances':'savedResistances']?.[channelId-1],0,wildTarget?3:7,'Resistance');
    let baseRange=range(skill[enemyUser?'enemyRange':'playerRange'],65535,'Base damage');
    const formula=skill.levelFormula;
    if (formula) {
      integer(level,1,99,'Level');
      const base=enemyUser?Math.floor(level*formula.enemyNumerator/formula.enemyDenominator):level*formula.playerMultiplier+formula.playerConstant;
      const width=Math.floor(base*formula.widthNumerator/formula.widthDenominator);
      baseRange=[base-width,base+width];
    }
    const bonus=skill.familyBonus;
    let bonusApplies=false;
    if (bonus) {
      const subject=bonus.subject==='target'?target:user;
      integer(subject?.familyId,0,10,'Bonus subject family');
      bonusApplies=subject.familyId===bonus.familyId;
    }
    const percent=percentages[code];
    const values=baseRange.map(value=>{
      if (bonusApplies && bonus.stage==='beforeResistance') value=Math.floor(value*bonus.numerator/bonus.denominator);
      value=Math.floor(value*percent/100);
      if (bonusApplies && bonus.stage==='afterResistance') value=Math.floor(value*bonus.numerator/bonus.denominator);
      return value;
    });
    return {kind:'damage',range:values,baseRange:[...baseRange],percent,code,scale:skill.scale,channelId,bonusApplies,overriddenResistance};
  }
  return Object.freeze({physicalRange,physicalEnvelope,wildStatRange,skillOutcome,scales});
});

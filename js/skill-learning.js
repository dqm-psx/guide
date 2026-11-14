/* Native PSX training and skill-route planning. See docs/skill-learning-evidence.md. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DQMSkillLearning=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const campaigns=['terry','cobi','tara'];
  function integer(value,min,max,label){
    if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(label+' must be a whole number from '+min+' to '+max+'.');
    return value;
  }
  function create(reference){
    if(reference?.schemaVersion!==1)throw new TypeError('Unsupported skill learning reference.');
    const species=new Map(reference.species.map(row=>[row.speciesIndex,row]));
    const skills=new Map(reference.skills.map(row=>[row.skillId,row]));
    const statKeys=[...reference.statKeys];
    const getSpecies=id=>{if(!species.has(id))throw new RangeError('This species has no supported ordinary growth record.');return species.get(id);};
    const getSkill=id=>{if(!skills.has(id))throw new RangeError('Unknown skill ID.');return skills.get(id);};
    const getCampaign=value=>{if(!campaigns.includes(value))throw new RangeError('Unknown adventure.');return value;};
    function skillList(values,max,label){
      if(!Array.isArray(values)||values.length>max)throw new RangeError(label+' must contain at most '+max+' skills.');
      for(const id of values)getSkill(id);
      if(new Set(values).size!==values.length)throw new RangeError(label+' must not contain duplicate skills.');
      return [...values];
    }
    function readStats(stats={}){
      if(!stats||typeof stats!=='object'||Array.isArray(stats))throw new TypeError('Enter base statistics as an object.');
      if(Object.keys(stats).some(key=>!statKeys.includes(key)))throw new RangeError('Unknown statistic.');
      return Object.fromEntries(statKeys.map(key=>[key,stats[key]==null?null:integer(stats[key],0,999,key)]));
    }
    function project(options){
      const mon=getSpecies(options.speciesIndex);
      const level=integer(options.level,1,99,'Current level');
      const target=integer(options.targetLevel,level,99,'Target level');
      const stats=readStats(options.stats);
      const origin=options.origin??'recruited';
      if(!['bred','recruited'].includes(origin))throw new RangeError('Unknown monster origin.');
      const plus=integer(options.plus??0,0,99,'Breeding plus');
      let min,max,source;
      if(options.levelCap!=null){
        min=max=integer(options.levelCap,level,99,'Actual level limit');source='individual';
      }else if(origin==='bred'){
        min=max=Math.min(99,mon.baseLevelCap+3*plus);source='bred';
        if(level>max)throw new RangeError('Current level exceeds this bred level limit; enter the individual limit if it differs.');
      }else{
        min=Math.max(level,1,Math.min(99,mon.recruitLevelCapCenter-2));
        max=Math.max(level,1,Math.min(99,mon.recruitLevelCapCenter+2));source='ordinary-recruit';
      }
      const gains={},projectedStats={};
      for(const key of statKeys){
        let gain=0;
        for(let next=level+1;next<=target;next++)gain+=reference.growthByLevel[next][mon.growthCurveIndices[key]];
        gains[key]=gain;
        projectedStats[key]=stats[key]==null?null:Math.min(999,stats[key]+gain);
      }
      const curve=mon.experienceCurveIndex;
      const currentExperience=reference.experienceByLevel[level][curve];
      const targetExperience=reference.experienceByLevel[target][curve];
      return {gains,projectedStats,experience:targetExperience-currentExperience,currentExperience,targetExperience,
        cap:{min,max,source,status:target>max?'above':target>min?'uncertain':'within'}};
    }
    function requirements(required,level,stats){
      return Object.entries(required).filter(([,minimum])=>minimum>0).map(([stat,minimum])=>{
        const value=stat==='level'?level:stats[stat];
        return {stat,minimum,value,status:value==null?'unknown':value<minimum?'short':'met',
          shortfall:value==null?null:Math.max(0,minimum-value)};
      });
    }
    function supersedes(known,target){
      const seen=new Set();
      while(known!=null&&!seen.has(known)){
        if(known===target)return true;
        seen.add(known);known=getSkill(known).upgradesFrom;
      }
      return false;
    }
    function check(options){
      const mon=getSpecies(options.speciesIndex),skill=getSkill(options.skillId);
      const campaign=getCampaign(options.campaign??'terry');
      const level=integer(options.level,1,99,'Level');
      const stats=readStats(options.stats);
      const known=skillList(options.knownSkills??[],8,'Retained learned skills');
      const inherited=skillList(options.inheritedSkills??[],25,'Inherited candidate skills');
      // A restored save already contains the complete CURRENT candidate pool.
      // Its first nine slots can have been removed or advanced, so adding the
      // species' original natural skills would resurrect unavailable routes.
      const currentPool=options.candidateSkills===undefined?null:skillList(options.candidateSkills,25,'Current candidate skills');
      const candidates=currentPool??[...mon.naturalSkills[campaign],...inherited];
      const location=options.location??'party';
      if(!['party','farm','hibernation'].includes(location))throw new RangeError('Unknown training location.');
      if(options.atLevelCap!=null&&typeof options.atLevelCap!=='boolean')throw new TypeError('Level-limit setting must be true or false.');
      const routes=[];
      // The native scan upgrades each retained slot once before testing exact
      // combination prerequisites. It does not walk a whole upgrade chain.
      const automaticUpgrades=[];
      const knownAfterUpgrades=known.map(id=>{
        const next=reference.skills.find(row=>row.upgradesFrom===id);
        if(next&&requirements(next.requirements,level,stats).every(row=>row.status==='met')){
          automaticUpgrades.push({from:id,to:next.skillId});return next.skillId;
        }
        return id;
      });
      function route(kind,requiredSkillIds,thresholds,accessibleOverride){
        const retained=kind==='combination'?knownAfterUpgrades:known;
        const missingSkillIds=requiredSkillIds.filter(id=>!retained.includes(id));
        const rows=requirements(thresholds,level,stats);
        routes.push({kind,requiredSkillIds:[...requiredSkillIds],missingSkillIds,
          accessible:accessibleOverride??missingSkillIds.length===0,
          prerequisiteUpgrades:kind==='combination'?automaticUpgrades.filter(row=>requiredSkillIds.includes(row.from)):[],
          requirements:rows,thresholdsMet:rows.every(row=>row.status==='met')});
      }
      if(currentPool===null&&mon.naturalSkills[campaign].includes(skill.skillId))route('natural',[],skill.requirements,true);
      if((currentPool??inherited).includes(skill.skillId))route('inherited',[],skill.requirements,true);
      if(skill.upgradesFrom!=null)route('upgrade',[skill.upgradesFrom],skill.requirements);
      for(const combo of skill.combinations)route('combination',combo.requiredSkillIds,combo.requirements);
      // Still show the numerical requirements when no source route is present.
      const numericalRequirements=requirements(skill.requirements,level,stats);
      // Native recipe scanning advances the threshold index twice when a
      // recipe has its prerequisite skills but fails its stat check. Later
      // recipes can consequently read different requirements. Flag that
      // interaction instead of presenting the ordinary recipe as a promise.
      const orderedCombinations=reference.skills.flatMap(row=>row.combinations.map(combo=>({...combo,skillId:row.skillId})));
      const pending=new Set(candidates.filter(id=>
        !known.includes(id)&&requirements(getSkill(id).requirements,level,stats).every(row=>row.status==='met')));
      for(const change of automaticUpgrades){pending.add(change.from);pending.add(change.to);}
      let requirementIndex=0,uncertainEarlier=false,combinationOrder=false,combinationUnknown=false;
      for(let index=0;index<orderedCombinations.length;index++){
        const combo=orderedCombinations[index];
        if(combo.requiredSkillIds.some(id=>!knownAfterUpgrades.includes(id))||knownAfterUpgrades.includes(combo.skillId)||pending.has(combo.skillId)){
          requirementIndex++;continue;
        }
        if(combo.skillId===skill.skillId){
          combinationOrder=requirementIndex!==index;
          combinationUnknown=uncertainEarlier;
          break;
        }
        const current=orderedCombinations[requirementIndex];
        if(!current){uncertainEarlier=true;requirementIndex++;continue;}
        const rows=requirements(current.requirements,level,stats);
        if(rows.some(row=>row.status==='short'))requirementIndex+=2;
        else{
          if(rows.some(row=>row.status==='unknown'))uncertainEarlier=true;
          requirementIndex++;
        }
      }
      const supersededBy=known.find(id=>id!==skill.skillId&&supersedes(id,skill.skillId))??null;
      const alreadyKnown=known.includes(skill.skillId)||supersededBy!==null;
      const accessible=routes.filter(row=>row.accessible);
      const ordinaryReady=accessible.some(row=>row.thresholdsMet&&row.kind!=='combination');
      const ready=ordinaryReady||(!combinationOrder&&!combinationUnknown&&accessible.some(row=>row.thresholdsMet));
      const warnings=[];
      if(combinationOrder&&!ordinaryReady)warnings.push('An earlier combination has the required skills but fails its stat check. The original game then reads different requirements for later combinations; this planner cannot confirm the displayed recipe will be offered in this check.');
      if(combinationUnknown&&!ordinaryReady)warnings.push('An earlier combination can affect this check. Enter all six base stats to check its requirements too.');
      const blockedBy=[];
      if(location!=='party')blockedBy.push(location);
      if(options.atLevelCap)blockedBy.push('level-cap');
      if(!accessible.length)blockedBy.push('missing-route');
      else if(!ready){
        if(combinationOrder)blockedBy.push('combination-order');
        if(combinationUnknown||accessible.some(row=>row.requirements.some(req=>req.status==='unknown')))blockedBy.push('unknown-stats');
        if(accessible.every(row=>row.requirements.some(req=>req.status==='short')))blockedBy.push('requirements-short');
      }
      const status=alreadyKnown?'already-known':blockedBy.find(reason=>['farm','hibernation','level-cap'].includes(reason))
        ??(ready?'ready':!accessible.length?'missing-route':blockedBy.includes('combination-order')?'combination-order':blockedBy.includes('unknown-stats')?'unknown-stats':'requirements-short');
      return {status,learnableNow:status==='ready',alreadyKnown,supersededBy,routes,numericalRequirements,blockedBy,
        knownAfterUpgrades,automaticUpgrades,warnings,candidateSource:currentPool===null?'species-and-inherited':'current',
        learnedSkillSlotsUsed:known.length,replacementRequired:ready&&known.length===8&&!alreadyKnown&&!routes.some(row=>row.kind==='upgrade'&&row.accessible&&row.thresholdsMet),
        learningTiming:'party-level-up'};
    }
    // Ordinary saved candidates have a stable numerical threshold. For later
    // upgrades/recipes the player may keep different moves before reaching it.
    function upcoming(monster){
      if (!species.has(monster.speciesIndex) || monster.level == null || monster.levelCap == null ||
          !campaigns.includes(monster.campaign) || monster.inheritedSkills == null || monster.knownSkills == null) return null;
      if (monster.level >= monster.levelCap) return {atCap:true, skills:[]};
      const level = monster.level + 1;
      const projection = project({speciesIndex:monster.speciesIndex, level:monster.level, targetLevel:level,
        levelCap:monster.levelCap, stats:monster.baseStats});
      const growth = [projection.projectedStats];
      for (let future = level+1; future <= monster.levelCap; future++) {
        growth.push(project({speciesIndex:monster.speciesIndex, level:future-1, targetLevel:future,
          levelCap:monster.levelCap, stats:growth[growth.length-1]}).projectedStats);
      }
      const ids = new Set(monster.inheritedSkills);
      for (const skill of skills.values()) {
        if (monster.knownSkills.includes(skill.upgradesFrom) || skill.combinations.length) ids.add(skill.skillId);
      }
      const moves = [];
      for (const skillId of ids) {
        const result = check({speciesIndex:monster.speciesIndex, campaign:monster.campaign, level,
          stats:projection.projectedStats, knownSkills:monster.knownSkills, candidateSkills:monster.inheritedSkills, skillId});
        const routes = result.routes.filter(route => route.accessible);
        if (result.alreadyKnown || !routes.length) continue;
        const direct = routes.find(route => route.kind === 'inherited');
        let projectedLevel = null, beyondCap = false;
        if (direct) {
          const required = getSkill(skillId).requirements;
          const index = growth.findIndex((stats,i) => requirements(required,level+i,stats).every(row => row.status === 'met'));
          if (index >= 0) projectedLevel = level + index;
          else beyondCap = requirements(required, monster.levelCap, growth[growth.length-1]).some(row => row.status === 'short');
        }
        moves.push({skillId, ready:result.learnableNow, status:result.status, projectedLevel, beyondCap,
          replacementRequired:result.replacementRequired, routes});
      }
      return {atCap:false, level, skills:moves};
    }
    function inherit(options){
      const child=getSpecies(options.offspringSpeciesIndex),campaign=getCampaign(options.campaign??'terry');
      if(!Array.isArray(options.parents)||options.parents.length!==2)throw new RangeError('Choose exactly two parents.');
      const parents=options.parents.map(parent=>({species:getSpecies(parent.speciesIndex),
        skills:skillList(parent.knownSkills??[],8,'Parent retained learned skills')}));
      const pad=(values,count)=>[...values,...Array(Math.max(0,count-values.length)).fill(0)];
      const candidateSlots=[...pad(child.naturalSkills[campaign],3),
        ...parents.flatMap(parent=>pad(parent.species.naturalSkills[campaign],3)),
        ...parents.flatMap(parent=>pad(parent.skills.map(id=>getSkill(id).baseSkillId),8))];
      return {candidateSlots,candidateSkills:[...new Set(candidateSlots.filter(Boolean))],
        naturalSkills:[...child.naturalSkills[campaign]],
        inheritedSkills:[...new Set(candidateSlots.slice(3).filter(Boolean))]};
    }
    return Object.freeze({project,check,upcoming,inherit,statKeys:Object.freeze(statKeys)});
  }
  return Object.freeze({create});
});

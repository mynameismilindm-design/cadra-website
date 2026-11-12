export const RUN_TYPES = {
 easy: {label:'Easy', hint:'Comfortable effort', description:'Keep a conversational effort. Add your own pace range if useful.', fields:[['duration','Duration · min',1,600,1]], defaults:{duration:30,fast:'',slow:''}},
 long: {label:'Long run',hint:'Time on your feet',description:'A steady distance session. Optional reminders use active running time.',fields:[['distance','Distance · km',.1,200,.1],['reminder','Reminder · min (0 = off)',0,180,1]],defaults:{distance:10,reminder:20}},
 tempo: {label:'Tempo',hint:'Sustained effort',description:'Warm up, hold a controlled tempo effort, then cool down. Choose your own pace range.',fields:[['warm','Warm-up · min',0,120,1],['work','Tempo block · min',1,180,1],['cool','Cool-down · min',0,120,1]],defaults:{warm:10,work:20,cool:10,fast:'',slow:''}},
 interval: {label:'Intervals',hint:'Work + recovery',description:'Each repeat includes work and recovery, including the final repeat. Warm-up and cool-down are optional.',fields:[['warm','Warm-up · min',0,120,1],['reps','Repeats',1,30,1],['work','Work · min',.25,60,.25],['recovery','Recovery · min',.25,60,.25],['cool','Cool-down · min',0,120,1]],defaults:{warm:10,reps:6,work:1,recovery:2,cool:5}},
 recovery: {label:'Recovery',hint:'Keep it gentle',description:'Relaxed effort, without pace targets. Keep this session comfortable.',fields:[['duration','Duration · min',1,180,1]],defaults:{duration:20}},
 progression: {label:'Progression',hint:'Build gradually',description:'Start easy, settle into a steady effort, then finish stronger while staying controlled.',fields:[['easy','Easy stage · min',1,180,1],['steady','Steady stage · min',1,180,1],['strong','Stronger stage · min',1,180,1]],defaults:{easy:10,steady:10,strong:10}},
}
export function paceSeconds(value) {
 if(typeof value !== 'string' || !/^\d{1,2}:[0-5]\d$/.test(value)) return null
 const [m,s]=value.split(':').map(Number); return m*60+s || null
}
export function buildPlan(type, values) {
 const def=RUN_TYPES[type]; if(!def || !values || typeof values!=='object') return {error:'Choose a valid run type.'}
 const v={}
 for(const [key,label,min,max,step] of def.fields){const n=Number(values[key]);if(values[key]==='' || values[key]==null || !Number.isFinite(n)||n<min||n>max||Math.abs(n/step-Math.round(n/step))>1e-6)return {error:`Check ${label}: ${min}–${max}, in steps of ${step}.`};v[key]=n}
 let pace=null
 if(type==='easy'||type==='tempo'){
  v.fast=String(values.fast||'').trim();v.slow=String(values.slow||'').trim()
  if(v.fast||v.slow){const fast=paceSeconds(v.fast),slow=paceSeconds(v.slow);if(!fast||!slow||fast>slow)return {error:'Enter both pace limits as m:ss /km, faster first.'};pace={fast,slow}}
 }
 const phases=[];const add=(label,min,cue,work=false)=>{if(min>0)phases.push({label,seconds:min*60,cue,work})}
 if(type==='easy')add('Easy',v.duration,'Keep a comfortable, conversational effort.')
 if(type==='recovery')add('Recovery',v.duration,'Keep your effort relaxed. No pace chasing.')
 if(type==='long')phases.push({label:'Long run',seconds:null,cue:'Settle into a steady effort.'})
 if(type==='tempo'){add('Warm-up',v.warm,'Warm up at an easy effort.');add('Tempo',v.work,'Settle into your controlled tempo effort.',true);add('Cool-down',v.cool,'Ease into your cool-down.')}
 if(type==='interval'){add('Warm-up',v.warm,'Warm up at an easy effort.');for(let i=1;i<=v.reps;i++){add(`Work ${i}/${v.reps}`,v.work,`Repeat ${i} of ${v.reps}. Work.`,true);add(`Recover ${i}/${v.reps}`,v.recovery,`Repeat ${i} of ${v.reps}. Recover.`)}add('Cool-down',v.cool,'Ease into your cool-down.')}
 if(type==='progression'){add('Easy',v.easy,'Start easy and relaxed.');add('Steady',v.steady,'Move into a steady effort.');add('Stronger',v.strong,'Finish stronger, while keeping control.',true)}
 return {plan:{version:1,type,label:def.label,values:v,pace,phases,distanceKm:type==='long'?v.distance:null,reminderSeconds:type==='long'?v.reminder*60:0,totalSeconds:type==='long'?null:phases.reduce((n,p)=>n+p.seconds,0)}}
}
export function validatePlan(raw){if(!raw || raw.version!==1)return null;return buildPlan(raw.type,raw.values).plan||null}
export function phaseAt(plan,activeSeconds,distanceKm=0){
 const t=Math.max(0,Number(activeSeconds)||0)
 if(plan.distanceKm)return distanceKm>=plan.distanceKm?{complete:true,index:1,remaining:0}:{...plan.phases[0],index:0,complete:false,remaining:Math.max(0,plan.distanceKm-distanceKm)}
 let start=0;for(let i=0;i<plan.phases.length;i++){const p=plan.phases[i];if(t<start+p.seconds)return {...p,index:i,complete:false,remaining:start+p.seconds-t};start+=p.seconds}
 return {complete:true,index:plan.phases.length,remaining:0}
}

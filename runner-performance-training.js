import {dom,title,block,note,button,select,input,group,metrics,action,read,write,decimal,paint} from './runner-performance-ui.js';
import {localDateKey,addDays,WEEKDAYS,createTrainingCalendar,moveTrainingSession,setTrainingSessionStatus,rebalanceTrainingCalendar,sessionMinutes} from './runner-performance-calendar.js';
import {targetPacerSummary,formatPacerTime} from './runner-performance-pacer.js';
import {gear} from './runner-performance-gear.js';

function confirmation(container,label,callback) {
  const msg=note('');const box=block(dom('h3',label),msg);
  box.append(group(action('Confirm',async()=>{await callback();box.remove();},msg),button('Cancel',()=>box.remove())));
  container.prepend(box);box.querySelector('button').focus();
}
function formSubmit(form,label,handler,status){
  const submit=dom('button',label,'pf-button pf-primary');submit.type='submit';form.append(submit);
  form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;status.textContent='';
    try{await handler();}catch(err){status.textContent=err.message||'Please retry.';}finally{submit.disabled=false;}};
}
function cardsTabs(ctx,tab){
  const nav=dom('nav',null,'pf-tabs');nav.setAttribute('aria-label','Training tools');
  for(const [key,label] of [['calendar','Training calendar'],['pacer','Target pacer'],['gear','Shoe rotation'],['compare','Compare efforts']]){
    const b=button(label,()=>ctx.navigate('training',{tab:key}),'pf-tab');if(key===tab)b.setAttribute('aria-current','page');nav.append(b);}
  return nav;
}
export async function render(ctx){
  const tab=['calendar','pacer','gear','compare'].includes(ctx.params?.tab)?ctx.params.tab:'calendar';
  const content=dom('div',null,'pf-stack');paint(ctx,title('Training studio'),cardsTabs(ctx,tab),content);content.append(note('Loading…'));
  if(tab==='gear'){await gear(ctx,content);return;}
  const access=await read(ctx.client.rpc('get_premium_access'));
  if(!ctx.active())return;
  if(!access?.preview_enabled){content.replaceChildren(note('The training calendar and target pacer require Cadra training access.'));return;}
  if(tab==='compare'){const {comparisons}=await import('./runner-performance-compare.js');await comparisons(ctx,content);return;}
  if(tab==='pacer')await pacer(ctx,content);else await calendar(ctx,content);
}
async function calendar(ctx,content){
  let saved=await read(ctx.client.rpc('premium_get_training_plans'));
  if(!ctx.active())return;
  let id=null,plan=null,selectedWeek=0,saving=false;
  const picker=dom('div'),editor=dom('div'),detail=dom('div',null,'pf-stack');
  const msg=note('');content.replaceChildren(picker,editor,detail);
  function choose(savedPlan){id=savedPlan?.id||null;plan=savedPlan?.plan||null;selectedWeek=0;editor.replaceChildren();renderList();renderPlan();if(!plan)settings();}
  function renderList(){
    const list=group();
    for(const row of saved){
      const b=button(row.plan?.title||'Saved calendar',()=>choose(row));if(row.id===id)b.setAttribute('aria-pressed','true');list.append(b);}
    list.append(button('New calendar',()=>choose(null),'pf-button pf-primary'));
    picker.replaceChildren(block(dom('h3','Your calendars'),saved.length?list:group(note('Set a goal and choose your running days.'),list)));
  }
  function settings(){
    const form=dom('form',null,'pf-plan-form'),today=localDateKey();
    const distance=select('Goal distance',[['5','5 km'],['10','10 km'],['21.1','Half marathon']]);
    const start=input('Start date','date',today,{required:'',min:today}),event=input('Goal date','date',addDays(today,56),{required:''});
    const goal=input('Goal time (minutes)','number',28,{required:'',min:1,step:'.5'});
    const recent=input('Recent 5 km time (minutes)','number',30,{required:'',min:15,max:90,step:'.5'});
    const minutes=input('Weekly running (minutes)','number',90,{required:'',min:45,max:300});
    const build=select('Weekly duration change',[['0','Keep steady'],['2','Increase 2%'],['5','Increase 5%']]);
    form.append(group(distance.field,goal.field,recent.field),group(start.field,event.field),group(minutes.field,build.field));
    const week=dom('fieldset',null,'pf-days');week.append(dom('legend','Running days (choose 2–5)'));
    const days=WEEKDAYS.map((d,i)=>{const lbl=dom('label'),day=dom('input');day.type='checkbox';day.checked=[2,4,6].includes(i);lbl.append(day,document.createTextNode(d));week.append(lbl);return day;});
    form.append(week,msg);
    formSubmit(form,'Preview calendar',()=>{
      const result=createTrainingCalendar({startDate:start.input.value,eventDate:event.input.value,distanceKm:+distance.input.value,goalMinutes:+goal.input.value,current5kMinutes:+recent.input.value,weeklyMinutes:+minutes.input.value,buildPercent:+build.input.value,availableDays:days.flatMap((d,i)=>d.checked?[i]:[])});
      if(result.error)throw new Error(result.error);
      plan=result.plan;id=null;selectedWeek=0;renderPlan();detail.scrollIntoView({block:'start'});
    },msg);editor.replaceChildren(block(dom('h3','Plan your weeks'),form));
  }
  async function persist(updated,expectedId=id){
    if(saving)throw new Error('Wait for the current save to finish.');
    saving=true;
    try{
      const result=await write(ctx,()=>ctx.client.rpc('premium_save_training_plan',{p_plan:updated,p_plan_id:expectedId}));
      const row=Array.isArray(result)?result[0]:result;
      if(!row?.id||!row.plan)throw new Error('The saved calendar could not be confirmed.');
      saved=[row,...saved.filter(item=>item.id!==row.id)];
      if(id===expectedId){id=row.id;plan=row.plan;editor.replaceChildren();renderList();renderPlan();}
    }finally{saving=false;}
  }
  async function change(result){if(result.error)throw new Error(result.error);if(id)await persist(result.plan);else{plan=result.plan;renderPlan();}}
  function renderPlan(){
    detail.replaceChildren();if(!plan?.settings||!Array.isArray(plan.sessions))return;
    const sheet=block(dom('h3',plan.title),note(id?'Saved to your Cadra account.':'Preview. Save this calendar to sync it to the app.'));
    const tools=group(),status=note('');
    if(!id)tools.append(action('Save calendar',()=>persist(plan),status));
    tools.append(button('Review missed sessions',()=>{
      const next=rebalanceTrainingCalendar(plan);
      if(!next.changed){status.textContent='Your calendar needs no changes.';return;}
      confirmation(detail,'Skip missed sessions and lighten upcoming sessions? '+next.changed+' sessions will change.',()=>change(next));
    }));
    if(id)tools.append(button('Delete calendar',()=>{
      const removing=id;
      confirmation(detail,'Delete this training calendar?',async()=>{
        const deleted=await write(ctx,()=>ctx.client.rpc('premium_delete_training_plan',{p_plan_id:removing}));
        if(!deleted)throw new Error('Deletion was not confirmed. Reload and retry.');
        saved=saved.filter(row=>row.id!==removing);choose(null);
      });
    }));
    sheet.append(metrics([['Goal date',plan.settings.eventDate],['Completed',plan.sessions.filter(s=>s.status==='completed').length+' / '+plan.sessions.length]]),tools,status);
    const weeks=new Map();for(const s of plan.sessions){const w=Math.floor((Date.parse(s.date+'T12:00Z')-Date.parse(plan.settings.startDate+'T12:00Z'))/604800000)+1;if(!weeks.has(w))weeks.set(w,[]);weeks.get(w).push(s);}
    const keys=[...weeks.keys()].sort((a,b)=>a-b);if(!keys.length){detail.append(sheet);return;}
    selectedWeek=Math.max(0,Math.min(selectedWeek,keys.length-1));const pick=select('View week',keys.map((k,i)=>[String(i),'Week '+k]),String(selectedWeek));
    pick.input.onchange=()=>{selectedWeek=+pick.input.value;renderPlan();};const list=dom('div',null,'pf-list');
    for(const s of weeks.get(keys[selectedWeek])){
      const row=dom('article',null,'pf-session'),head=dom('div');head.append(dom('small',s.date+' · '+s.status),dom('h4',s.title));
      const duration=sessionMinutes(s);if(duration!=null)head.append(dom('p',duration+' minutes'));
      const actions=group();
      for(const [key,label] of [['completed','Complete'],['skipped','Skip'],['planned','Restore']])if((s.status==='planned'&&key!=='planned')||(s.status!=='planned'&&key==='planned'))actions.append(action(label,()=>change(setTrainingSessionStatus(plan,s.id,key)),status));
      if(s.status==='planned'&&s.kind!=='event'){
        const move=dom('details',null,'pf-edit');move.append(dom('summary','Move session'));
        const date=input('New date','date',s.date,{min:localDateKey(),max:addDays(plan.settings.eventDate,-1)});
        move.append(group(date.field,action('Move to this day',()=>change(moveTrainingSession(plan,s.id,date.input.value)),status)));row.append(head,actions,move);
      }else row.append(head,actions);
      list.append(row);
    }
    sheet.append(pick.field,list);detail.append(sheet);
  }
  choose(saved[0]||null);
}
async function pacer(ctx,content){
  let targets=await read(ctx.client.rpc('get_pacer_targets'));if(!ctx.active())return;
  let selected=null;
  function draw(){
    const list=group();for(const row of targets)list.append(button(row.name||'Pace target',()=>{selected=row;draw();}));
    list.append(button('New target',()=>{selected=null;draw();}));const form=dom('form');
    const name=input('Target name','text',selected?.name||'',{maxlength:60});
    const distance=input('Distance (km)','number',selected?.distance_km||5,{required:'',min:'.1',max:100,step:'.001'});
    const minutes=input('Finish time (minutes)','number',selected?selected.target_seconds/60:25,{required:'',min:1,max:1440,step:'any'});
    const strategy=select('Pacing strategy',[['even','Even pace'],['negative','Faster second half']],selected?.strategy);
    const live=dom('div'),status=note('');
    const config=()=>({version:1,name:name.input.value.trim(),distanceKm:+distance.input.value,targetSeconds:Math.round(+minutes.input.value*60),strategy:strategy.input.value});
    function preview(){const p=targetPacerSummary(config());live.replaceChildren(...(p?[metrics([['Average',formatPacerTime(p.averagePace)+'/km'],['First half',formatPacerTime(p.firstHalfPace)+'/km'],['Second half',formatPacerTime(p.secondHalfPace)+'/km']])]:[note('Enter a valid distance and finish time.')]));}
    form.addEventListener('input',preview);form.append(group(name.field,distance.field),group(minutes.field,strategy.field),live,status);preview();
    formSubmit(form,'Save pace target',async()=>{const conf=config(),editing=selected;
      if(!targetPacerSummary(conf))throw new Error('Enter a valid distance and time.');
      const saved=await write(ctx,()=>ctx.client.rpc('save_pacer_target',{p_id:editing?.id||null,p_name:conf.name||decimal(conf.distanceKm)+' km target',p_distance_km:conf.distanceKm,p_target_seconds:conf.targetSeconds,p_strategy:conf.strategy}));
      const row=Array.isArray(saved)?saved[0]:saved;if(!row?.id)throw new Error('Your save was not confirmed.');
      targets=[row,...targets.filter(item=>item.id!==row.id)];selected=row;draw();
    },status);
    if(selected)form.append(button('Delete target',()=>{const removing=selected.id;confirmation(content,'Delete this pace target?',async()=>{
      const ok=await write(ctx,()=>ctx.client.rpc('delete_pacer_target',{p_id:removing}));if(!ok)throw new Error('Deletion was not confirmed.');
      targets=targets.filter(item=>item.id!==removing);selected=null;draw();
    });}));
    content.replaceChildren(block(dom('h3','Saved targets'),list),block(dom('h3',selected?'Edit pace target':'Set a pace target'),form));
  }
  draw();
}

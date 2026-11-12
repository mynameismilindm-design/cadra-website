import {dom,title,block,note,button,select,input,group,metrics,action,read,write,decimal,day} from './runner-performance-ui.js';

const fields='id,user_id,brand,model,nickname,category,purchase_date,purchase_price,max_km,status,is_primary,terrain_tag,retired_at,updated_at';
const categories=[['daily_trainer','Daily trainer'],['tempo','Tempo'],['racer','Racer'],['trail','Trail'],['minimalist','Minimalist'],['other','Other']];
const terrains=['road','trail','track','mixed'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]);
const legacy=s=>s.brand==='Legacy'&&s.model==='Imported activities';
const name=s=>s.nickname||[s.brand,s.model].join(' ');
export async function gear(ctx,content){
  const [pairs,wear]=await Promise.all([
    read(ctx.client.from('shoes').select(fields).eq('user_id',ctx.user.id).order('updated_at',{ascending:false})),
    read(ctx.client.from('v_shoe_mileage').select('shoe_id,total_km,total_runs,longest_run_km,fastest_pace_sec_per_km,last_run_at').eq('user_id',ctx.user.id))
  ]);
  if(!ctx.active())return;
  let shoes=pairs,editing,showRetired=false,busy=false;
  const mileage=new Map(wear.map(s=>[s.shoe_id,s]));
  function remember(row){shoes=[row,...shoes.filter(s=>s.id!==row.id)];}
  async function update(shoe,data){
    const row=await write(ctx,()=>ctx.client.from('shoes').update(data).eq('id',shoe.id).eq('user_id',ctx.user.id).eq('status',shoe.status).select(fields).single());
    remember(row);return row;
  }
  async function mutate(fn){
    if(busy)throw new Error('Please wait for the current change.');
    busy=true;try{await fn();draw();}finally{busy=false;}
  }
  async function promote(next){
    const previous=shoes.find(s=>s.is_primary&&s.status==='active');
    if(previous?.id===next.id)return;
    if(previous)await update(previous,{is_primary:false});
    try{await update(next,{is_primary:true});}
    catch(error){if(previous&&ctx.active()){try{await update(previous,{is_primary:true});}catch{/* A concurrent promotion may already have succeeded. */}}throw error;}
  }
  function edit(shoe){
    const form=dom('form'),brand=input('Brand','text',shoe?.brand,{required:'',maxlength:80});
    const model=input('Model','text',shoe?.model,{required:'',maxlength:100});
    const nick=input('Nickname','text',shoe?.nickname,{maxlength:80});
    const category=select('Category',categories,shoe?.category),terrain=select('Terrain',terrains,shoe?.terrain_tag);
    const limit=input('Mileage limit (km)','number',shoe?.max_km||700,{required:'',min:1,step:1});
    const purchased=input('Purchase date','date',shoe?.purchase_date);
    const price=input('Price paid','number',shoe?.purchase_price,{min:0,step:'.01'});
    const msg=note(''),submit=dom('button','Save pair','pf-button pf-primary');submit.type='submit';
    form.append(group(brand.field,model.field,nick.field),group(category.field,terrain.field,limit.field),group(purchased.field,price.field),group(submit,button('Cancel',()=>{editing=undefined;draw();})),msg);
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled)return;submit.disabled=true;
      try{await mutate(async()=>{
        const values={brand:brand.input.value.trim(),model:model.input.value.trim(),nickname:nick.input.value.trim()||null,category:category.input.value,terrain_tag:terrain.input.value,max_km:Number(limit.input.value),purchase_date:purchased.input.value||null,purchase_price:price.input.value?Number(price.input.value):null};
        if(!values.brand||!values.model)throw new Error('Enter the brand and model.');
        if(shoe)await update(shoe,values);
        else{
          const isFirst=!shoes.some(s=>s.status==='active'&&!legacy(s));
          remember(await write(ctx,()=>ctx.client.from('shoes').insert({...values,user_id:ctx.user.id,status:'active',is_primary:isFirst}).select(fields).single()));
        }
        editing=undefined;showRetired=shoe?.status==='retired';
      });}catch(error){msg.textContent=error.message;}finally{submit.disabled=false;}
    };
    return block(dom('h3',shoe?'Edit pair':'Add a pair'),form);
  }
  function draw(){
    if(!ctx.active())return;
    const list=shoes.filter(s=>(s.status==='retired')===showRetired&&(!legacy(s)||showRetired));
    const buttons=group();for(const [retired,label] of [[false,'Active'],[true,'Retired']]){
      const b=button(label,()=>{showRetired=retired;editing=undefined;draw();});b.setAttribute('aria-pressed',String(retired===showRetired));buttons.append(b);}
    buttons.append(button('Add a pair',()=>{editing=null;draw();},'pf-button pf-primary'));
    content.replaceChildren(title('Shoe rotation'),buttons);
    if(editing!==undefined)content.append(edit(editing));
    if(!list.length)content.append(block(note(showRetired?'No retired shoes in your rotation.':'Add your first pair to track wear across your runs.')));
    for(const s of list.sort((a,b)=>Number(b.is_primary)-Number(a.is_primary))){
      const km=Number(mileage.get(s.id)?.total_km||0),m=mileage.get(s.id),msg=note('');
      const card=block(dom('small',s.is_primary?'Primary pair':s.status==='retired'?'Retired pair':'Active pair','pf-kicker'),dom('h3',name(s)));
      const progress=dom('progress');progress.max=100;progress.value=s.max_km>0?Math.min(100,km*100/s.max_km):0;progress.setAttribute('aria-label','Shoe mileage used');
      card.append(note([s.nickname?[s.brand,s.model].join(' '):null,categories.find(v=>v[0]===s.category)?.[1],s.terrain_tag].filter(Boolean).join(' · ')),progress,
        metrics([['Mileage',decimal(km)+' / '+decimal(s.max_km)+' km'],['Assigned runs',m?.total_runs||0],['Longest run',m?.longest_run_km?decimal(m.longest_run_km)+' km':'—'],['Last run',day(m?.last_run_at)||'—']]));
      if(!legacy(s)){
        const actions=group(button('Edit pair',()=>{editing=s;draw();}));
        if(s.status==='active'&&!s.is_primary)actions.append(action('Make primary',()=>mutate(()=>promote(s)),msg));
        if(s.status==='active'){
          const more=dom('details',null,'pf-edit');more.append(dom('summary','Retire pair'),note('Keep the mileage history and remove this pair from active rotation.'));
          more.append(action('Confirm retirement',()=>mutate(async()=>{
            await update(s,{status:'retired',is_primary:false,retired_at:new Date().toISOString()});
            const replacement=shoes.find(pair=>pair.status==='active'&&!legacy(pair));
            if(s.is_primary&&replacement){try{await promote(replacement);}catch{draw();content.prepend(note('The pair was retired. Choose a primary pair from your rotation.'));}}
          }),msg));card.append(actions,more);
        }else{actions.append(action('Return to rotation',()=>mutate(()=>update(s,{status:'active',retired_at:null})),msg));card.append(actions);}
      }
      card.append(msg);content.append(card);
    }
  }
  draw();
}

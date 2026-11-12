export function dom(tag, text, cls) {
  const out=document.createElement(tag);
  if(text!=null)out.textContent=text;
  if(cls)out.className=cls;
  return out;
}
export function block(...children) {
  const el=dom('section',null,'pf-panel');el.append(...children);return el;
}
export function title(label,sub) {
  const box=dom('header',null,'pf-heading');box.append(dom('h2',label));
  if(sub)box.append(dom('p',sub,'pf-note'));return box;
}
export function note(text) { const p=dom('p',text,'pf-note');p.setAttribute('role','status');return p; }
export function button(text,click,css='pf-button'){
  const b=dom('button',text,css);b.type='button';
  b.addEventListener('click',click);return b;
}
export function select(label, options, selected){
  const field=dom('label',null,'pf-field');field.append(dom('span',label));
  const input=dom('select');
  for(const [value,text] of options){const opt=dom('option',text);opt.value=value;input.append(opt);}
  if(selected!=null)input.value=selected;
  field.append(input);return {field,input};
}
export function input(label,type,value,attributes={}){
  const field=dom('label',null,'pf-field');field.append(dom('span',label));
  const control=dom('input');control.type=type;control.value=value??'';
  for(const [key,val] of Object.entries(attributes))control.setAttribute(key,val);
  field.append(control);return {field,input:control};
}
export function group(...children){const container=dom('div',null,'pf-controls');container.append(...children);return container;}
export function metrics(pairs){const list=dom('dl',null,'pf-metrics');
  for(const [label,value] of pairs){const item=dom('div');item.append(dom('dt',label),dom('dd',value));list.append(item);}return list;}
export function action(text,fn,message){
  return button(text,async event=>{const b=event.currentTarget;if(b.disabled)return;b.disabled=true;
    try{await fn();}catch(e){message.textContent=e.message||'Could not save. Please try again.';}
    finally{b.disabled=false;}
  });
}
export async function read(builder) { const {data,error}=await builder;if(error)throw new Error('Cadra could not load this information. Please retry.');return data; }
export async function write(ctx,builder){
  await ctx.verify();const {data,error}=await builder();
  if(error)throw new Error('Cadra could not save this change. Check your access and try again.');
  if(!ctx.active())throw new Error('This view is closed.');return data;
}
export const decimal = value => value==null || !Number.isFinite(Number(value))?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
export const day = value => value && Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'';
export function paint(ctx,...children){if(ctx.active())ctx.root.replaceChildren(...children);}

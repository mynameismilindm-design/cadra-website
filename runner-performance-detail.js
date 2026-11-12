import {dom,block,title,note,button,select,group,metrics,read,write,decimal,day,paint,action} from './runner-performance-ui.js';
import {buildRunAnalysis,analysisRouteSegments,formatAnalysisTime as time,nearestAnalysisPoint} from './runner-performance-analysis.js';

const pace = value => Number.isFinite(value) ? time(value) + '/km' : '—';
function lineCanvas(label) {
  const c=dom('canvas',label,'pf-chart');c.width=960;c.height=300;c.setAttribute('aria-label',label);return c;
}
function renderChart(model){
  const card=block(dom('h3','Pace through your run'));
  if(!model.pacePoints.length){card.append(note('This recording has no continuous pace samples. Recorded kilometre splits appear below.'));return card;}
  const canvas=lineCanvas('Pace across the run. Use the slider to inspect each recorded point.');
  const axis=select('Horizontal axis',[['distance','Distance'],['time','Elapsed time']]);
  const overlay=dom('label',null,'pf-check'), elevation=dom('input');
  elevation.type='checkbox';overlay.append(elevation,document.createTextNode(' Elevation overlay'));
  const controls=group(axis.field);if(model.hasElevation)controls.append(overlay);
  const slider=dom('input',null,'pf-scrub');slider.type='range';slider.min=0;slider.max=model.points.length-1;
  slider.value=model.points.findIndex(x=>x.pace!=null);slider.setAttribute('aria-label','Explore recorded pace samples');
  const readout=dom('output',null,'pf-readout');
  function draw(){
    const c=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
    const left=68,right=width-24,top=22,bottom=height-45;
    const axisField=axis.input.value==='time'?'elapsedS':'distanceM';
    const xMax=Math.max(model.points.at(-1)[axisField],1);
    const paces=model.pacePoints.map(p=>p.pace);const lo=Math.min(...paces)-5,hi=Math.max(...paces)+5;
    const x=p=>left+p[axisField]/xMax*(right-left), y=p=>top+(p.pace-lo)/(hi-lo)*(bottom-top);
    c.clearRect(0,0,width,height);c.fillStyle='#18281f';c.fillRect(0,0,width,height);c.font='16px monospace';
    for(let i=0;i<4;i++){const yy=top+i*(bottom-top)/3;c.beginPath();c.strokeStyle='#3c4a40';c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#e0e7db';c.fillText(time(lo+(hi-lo)*i/3),7,yy+6);}
    function line(points,projectY,color){
      c.strokeStyle=color;c.lineWidth=3;c.beginPath();let prev=null;
      for(const p of points){if(!prev||p.segment!==prev.segment||p.breakBefore)c.moveTo(x(p),projectY(p));else c.lineTo(x(p),projectY(p));prev=p;}c.stroke();
    }
    if(elevation.checked && model.hasElevation){const heights=model.elevationPoints.map(p=>p.altitudeM),min=Math.min(...heights),max=Math.max(...heights);
      line(model.elevationPoints,p=>bottom-(p.altitudeM-min)/Math.max(1,max-min)*(bottom-top),'#6ab9bd');}
    line(model.pacePoints,y,'#d5fa85');
    const point=model.points[+slider.value];
    c.strokeStyle='#fff5ce';c.lineWidth=1;c.beginPath();c.moveTo(x(point),top);c.lineTo(x(point),bottom);c.stroke();
    c.fillStyle='#dde4da';c.fillText('0',left,height-12);
    c.textAlign='right';c.fillText(axisField==='elapsedS'?time(xMax):decimal(xMax/1000)+' km',right,height-12);c.textAlign='left';
    readout.textContent=[decimal(point.distanceM/1000)+' km',time(point.elapsedS)+' elapsed',pace(point.pace),elevation.checked&&point.altitudeM!=null?Math.round(point.altitudeM)+' m altitude':null].filter(Boolean).join(' · ');
  }
  slider.oninput=draw;axis.input.onchange=draw;elevation.onchange=draw;
  canvas.onclick=e=>{const bounds=canvas.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,((e.clientX-bounds.left)*canvas.width/bounds.width-68)/(canvas.width-92)));
    const ax=axis.input.value,last=model.points.at(-1);slider.value=nearestAnalysisPoint(model.points,ratio*(ax==='time'?last.elapsedS:last.distanceM),ax);draw();};
  card.append(controls,canvas,slider,readout);draw();return card;
}
function renderRoute(segments) {
  const coordinates=segments.flat();
  if(coordinates.length<2)return null;
  const c=lineCanvas('Recorded route outline');c.height=260;
  // Local projection only; account locations stay inside the runner's browser.
  const bounds=coordinates.reduce((b,[lat,lng])=>[Math.min(b[0],lat),Math.min(b[1],lng),Math.max(b[2],lat),Math.max(b[3],lng)],[90,180,-90,-180]);
  const correction=Math.max(.001,Math.cos((bounds[0]+bounds[2])*Math.PI/360));
  const dx=(bounds[3]-bounds[1])*correction,dy=bounds[2]-bounds[0],scale=Math.min((c.width-60)/(dx||1e-9),(c.height-52)/(dy||1e-9));
  const xy=([lat,lng])=>[(c.width-dx*scale)/2+(lng-bounds[1])*correction*scale,(c.height+dy*scale)/2-(lat-bounds[0])*scale];
  const g=c.getContext('2d');g.fillStyle='#edf1e6';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#cbd7c7';g.lineWidth=1;
  for(let x=0;x<c.width;x+=44){g.beginPath();g.moveTo(x,0);g.lineTo(x,c.height);g.stroke();}
  for(let y=0;y<c.height;y+=44){g.beginPath();g.moveTo(0,y);g.lineTo(c.width,y);g.stroke();}
  g.strokeStyle='#156956';g.lineWidth=4;g.lineJoin='round';g.beginPath();
  for(const line of segments){line.forEach((p,i)=>i?g.lineTo(...xy(p)):g.moveTo(...xy(p)));}g.stroke();
  g.fillStyle='#214337';g.beginPath();g.arc(...xy(coordinates[0]),5,0,2*Math.PI);g.fill();
  return block(dom('h3','Route outline'),c);
}
function downloadRoute(race,segments){
  const xml=value=>String(value).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
  const data='<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Cadra" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+xml(race.title||'Cadra run')+'</name>'+
    segments.map(line=>'<trkseg>'+line.map(([lat,lng])=>'<trkpt lat="'+Number(lat)+'" lon="'+Number(lng)+'"/>').join('')+'</trkseg>').join('')+'</trk></gpx>';
  const url=URL.createObjectURL(new Blob([data],{type:'application/gpx+xml'}));const a=dom('a');a.href=url;a.download='cadra-'+race.id+'.gpx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function splitsView(m) {
  const box=block(dom('h3','Kilometre splits'));
  if(!m.splits.length){box.append(note('There are no saved splits for this activity.'));return box;}
  const list=dom('div',null,'pf-list');for(const s of m.splits){
    const row=dom('div',null,'pf-row');row.append(dom('strong',s.label),dom('span',pace(s.pace)),dom('small',time(s.seconds)));list.append(row);}
  box.append(list);
  if(m.fastest)box.append(metrics([['Fastest full kilometre',m.fastest.label+' · '+pace(m.fastest.pace)],['Split variation',m.variationPct==null?'—':decimal(m.variationPct)+'%']]));
  return box;
}
async function shoePicker(ctx,race) {
  const created=Date.parse(race.created_at||race.started_at);
  if(!Number.isFinite(created)||Date.now()-created>=8*86400000)return null;
  const shoes=await read(ctx.client.from('shoes').select('id,brand,model,nickname,status').eq('user_id',ctx.user.id).eq('status','active').order('is_primary',{ascending:false}));
  if(!shoes.length)return null;
  const current=shoes.find(s=>s.id===race.shoe_id);
  const chooser=select('Running shoes',[['','Choose a pair'],...shoes.map(s=>[s.id,s.nickname||s.brand+' '+s.model])],current?.id||'');
  const msg=note('');
  return block(dom('h3','Shoes for this run'),group(chooser.field,action('Assign pair',async()=>{
    if(!shoes.some(s=>s.id===chooser.input.value))throw new Error('Choose a pair from your rotation.');
    await write(ctx,()=>ctx.client.from('races').update({shoe_id:chooser.input.value}).eq('user_id',ctx.user.id).eq('id',race.id).select('id').single());
    msg.textContent='Pair saved for this run.';},msg)),msg);
}
export async function render(ctx){
  const id=ctx.params?.id;if(!id){paint(ctx,note('Open a run from your activity log.'));return;}
  const race=await read(ctx.client.from('races').select('id,user_id,title,description,started_at,created_at,distance_km,duration_secs,moving_time_secs,pace_sec_per_km,elevation_gain_m,calories_kcal,splits,route_points,shoe_id').eq('id',id).eq('user_id',ctx.user.id).maybeSingle());
  if(!ctx.active())return;
  if(!race||race.user_id!==ctx.user.id){paint(ctx,note('This run is unavailable for your account.'));return;}
  const {data:recording,error}=await ctx.client.from('activity_analysis').select('analysis').eq('race_id',id).eq('user_id',ctx.user.id).maybeSingle();
  if(!ctx.active())return;
  const model=buildRunAnalysis(race,recording?.analysis);
  const parts=[title(race.title||'Saved run',[day(race.started_at),race.description].filter(Boolean).join(' · ')),metrics([['Distance',decimal(race.distance_km)+' km'],['Average pace',pace(model.averagePace)],['Elapsed',time(model.elapsedS)],['Elevation gain',race.elevation_gain_m==null?'—':decimal(race.elevation_gain_m)+' m']])];
  if(error)parts.push(note('The detailed recording could not be loaded.'),button('Retry recording',()=>ctx.navigate('activity',{id})));
  else if(recording?.analysis?.truncated||recording?.analysis?.decimated)parts.push(note('This long run retained a reduced recording. The chart shows the available samples.'));
  parts.push(renderChart(model),splitsView(model));
  if(model.halves)parts.push(block(dom('h3','First and second half'),metrics([['First half',pace(model.halves.firstPace)],['Second half',pace(model.halves.secondPace)],['Difference',time(Math.abs(model.halves.deltaSeconds))]])));
  let segments=analysisRouteSegments(model.points);
  if(!segments.length){const pts=(Array.isArray(race.route_points)?race.route_points:[]).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180);
    if(pts.length>1)segments=[pts.map(p=>[p.lat,p.lng])];}
  const route=renderRoute(segments);if(route){route.append(button('Download GPX',()=>downloadRoute(race,segments)));parts.push(route);}
  const edit=dom('details',null,'pf-edit'),field=dom('label',null,'pf-field'),text=dom('textarea'),result=note('');
  text.value=race.description||'';text.rows=4;field.append(dom('span','Activity note'),text);
  edit.append(dom('summary','Edit activity note'),field,action('Save note',async()=>{
    const value=text.value.trim();
    await write(ctx,()=>ctx.client.from('races').update({description:value}).eq('user_id',ctx.user.id).eq('id',race.id).select('id').single());
    race.description=value;parts[0].replaceWith(parts[0]=title(race.title||'Saved run',[day(race.started_at),value].filter(Boolean).join(' · ')));
    result.textContent='Activity note saved.';
  },result),result);
  parts.push(block(edit));paint(ctx,...parts);
  try{const shoes=await shoePicker(ctx,race);if(ctx.active() && shoes)ctx.root.append(shoes);}catch{if(ctx.active())ctx.root.append(note('Shoe assignment is temporarily unavailable.'));}
}

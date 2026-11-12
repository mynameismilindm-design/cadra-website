import {dom,block,note,button,select,group,metrics,read,decimal,day} from './runner-performance-ui.js';
import {formatRaceSeconds,makeRaceTimeline,compareRaceTimelines,comparableRunTrends,similarRoutes} from './runner-performance-insights.js';
export async function comparisons(ctx,content){
  const rows=await read(ctx.client.from('races').select('id,title,distance_km,duration_secs,moving_time_secs,splits,started_at').eq('user_id',ctx.user.id).not('finished_at','is',null).gt('distance_km',0).order('started_at',{ascending:false}).limit(100));
  if(!ctx.active())return;
  const eligible=rows.map(r=>({...r,track:makeRaceTimeline(r)})).filter(r=>r.track);
  const options=eligible.map(r=>[r.id,day(r.started_at)+' · '+decimal(r.distance_km)+' km · '+(r.title||'Run')]);
  const a=select('First effort',options),b=select('Second effort',options,eligible.find((r,i)=>i>0&&r.track.basis===eligible[0].track.basis)?.id||'');
  const distance=select('Compare distance',[['1','1 km'],['5','5 km'],['10','10 km'],['21.1','Half marathon']],5);
  const basis=select('Time basis',[['active','Moving time'],['elapsed','Elapsed time']]);
  const table=dom('div'),summary=dom('div'),route=dom('div');let revision=0;
  function trend(){
    const runs=comparableRunTrends(rows,+distance.input.value).filter(r=>r.basis===basis.input.value);
    if(!runs.length){table.replaceChildren(note('No comparable runs at this distance and time basis.'));return;}
    const list=dom('div',null,'pf-list'),best=Math.min(...runs.map(r=>r.seconds)),last=runs.at(-1);
    table.replaceChildren(metrics([['Best',formatRaceSeconds(best)],['Latest',formatRaceSeconds(last.seconds)],['Runs',runs.length]]));
    for(const r of [...runs].reverse()){
      const row=button('',()=>ctx.navigate('activity',{id:r.id}),'pf-trend-row'),bar=dom('progress');
      bar.max=1;bar.value=best/r.seconds;bar.setAttribute('aria-label','Relative speed');row.append(dom('span',day(r.startedAt)),bar,dom('strong',(r.estimated?'≈ ':'')+formatRaceSeconds(r.seconds)));list.append(row);
    }
    table.append(list,note('Includes runs up to 6% longer than the selected distance. An approximate time uses interpolation.'));
  }
  function compare(){
    const rev=++revision;route.replaceChildren();
    const first=eligible.find(r=>r.id===a.input.value),second=eligible.find(r=>r.id===b.input.value);
    if(!first||!second||first.id===second.id||first.track.basis!==second.track.basis){summary.replaceChildren(note('Choose two different efforts with the same time basis.'));return;}
    const common=Math.min(first.track.maxDistanceM,second.track.maxDistanceM);
    const slider=dom('input',null,'pf-scrub');slider.type='range';slider.min=0;slider.max=1000;slider.value=500;slider.setAttribute('aria-label','Compare efforts at distance');
    const at=dom('output',null,'pf-readout'),results=dom('div');
    function inspect(){const meters=common*Number(slider.value)/1000,delta=compareRaceTimelines(first.track,second.track,meters);
      at.textContent=decimal(meters/1000)+' km';results.replaceChildren(metrics([['First effort',formatRaceSeconds(delta?.firstSeconds)],['Second effort',formatRaceSeconds(delta?.secondSeconds)],['Time gap',delta?formatRaceSeconds(Math.abs(delta.gapSeconds)):'—']]));}
    slider.oninput=inspect;inspect();
    const check=button('Check route similarity',async()=>{
      check.disabled=true;route.replaceChildren(note('Checking the recorded routes…'));
      try{
        const routes=await Promise.all([first,second].map(r=>read(ctx.client.from('races').select('route_points').eq('id',r.id).eq('user_id',ctx.user.id).single())));
        if(!ctx.active()||rev!==revision)return;
        const match=similarRoutes(routes[0]?.route_points,routes[1]?.route_points);
        route.replaceChildren(note(match===null?'Both routes need at least eight recorded points.':match?'The recorded routes follow a similar path.':'The recorded routes follow different paths.'));
      }catch{if(ctx.active()&&rev===revision)route.replaceChildren(note('Route comparison is unavailable. Please retry.'));}
      finally{check.disabled=false;}
    });
    summary.replaceChildren(slider,at,results,note(first.track.coarse||second.track.coarse?'At least one effort only has a recorded total. Intermediate times are estimates.':'Times between recorded split markers are interpolated.'),check);
  }
  distance.input.onchange=trend;basis.input.onchange=trend;a.input.onchange=compare;b.input.onchange=compare;
  trend();compare();content.replaceChildren(block(dom('h3','Compare recorded efforts'),group(a.field,b.field),summary,route),block(dom('h3','Distance trends'),group(distance.field,basis.field),table));
}

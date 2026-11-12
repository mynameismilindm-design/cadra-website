import {dom,title,block,note,button,select,group,decimal,read,paint} from './runner-performance-ui.js';
import {formatAnalysisTime as clock} from './runner-performance-analysis.js';

const types=[
 ['km','Distance'],['points','Score'],['count','Runs'],['5K','5 km PB'],['1K','1 km PB'],['10K','10 km PB'],['HALF','Half marathon PB'],['MARATHON','Marathon PB'],
 ['100m','100 m'],['400m','400 m'],['800m','800 m'],['mile','Mile'],['pace','Fastest average pace'],['climb','Elevation gain']
];
const sprints={ '100m':[.08,.12],'400m':[.36,.44],'800m':[.72,.88],mile:[1.55,1.65] };
const pbCategories=new Set(['1K','5K','10K','HALF','MARATHON']);
const overall={km:'total_distance',points:'total_score',count:'total_races'};
function displayValue(metric,value){
  if(metric==='pace')return clock(value)+'/km';
  if(metric==='km')return decimal(value)+' km';
  if(metric==='climb')return decimal(value)+' m';
  if(metric==='points'||metric==='count')return decimal(value);
  return clock(value);
}
async function membership(ctx,scope){
  const {client,user}=ctx;
  if(scope==='friends'){
    const list=await read(client.from('follows').select('following_id').eq('follower_id',user.id).eq('status','accepted'));
    return [user.id,...list.map(r=>r.following_id)];
  }
  if(scope!=='clubs')return null;
  const mine=await read(client.from('club_memberships').select('club_id').eq('user_id',user.id));
  if(!mine.length)return [];
  const peers=await read(client.from('club_memberships').select('user_id').in('club_id',mine.map(row=>row.club_id)));
  return [...new Set(peers.map(row=>row.user_id))];
}
async function getRows(ctx,metric,scope,profile){
  const ids=await membership(ctx,scope);if(ids&&!ids.length)return [];
  const pb=pbCategories.has(metric);
  const table=overall[metric]?'rankings':pb?'personal_bests':'races';
  const col=overall[metric] || (pb?'time_secs':sprints[metric]?'duration_secs':metric==='pace'?'pace_sec_per_km':'elevation_gain_m');
  let q=ctx.client.from(table).select('user_id,'+col+',profiles!inner(username)').gt(col,0);
  if(pb)q=q.eq('category',metric);
  if(sprints[metric])q=q.gte('distance_km',sprints[metric][0]).lte('distance_km',sprints[metric][1]);
  if(metric==='pace')q=q.gte('distance_km',1).gt(col,120).lt(col,1200);
  if(scope==='country')q=q.eq('profiles.country',profile.country);
  if(scope==='city')q=q.ilike('profiles.city',String(profile.city).replace(/[\\%_]/g,'\\$&'));
  if(ids)q=q.in('user_id',ids);
  const values=await read(q.order(col,{ascending:pb||!!sprints[metric]||metric==='pace'}).order('user_id').limit(metric==='climb'?1000:table==='races'?100:30));
  const unique=new Map();
  for(const row of values){
    if(!row.user_id||!row.profiles?.username)continue;
    if(!unique.has(row.user_id))unique.set(row.user_id,{id:row.user_id,name:row.profiles.username,value:Number(row[col])});
    else if(metric==='climb')unique.get(row.user_id).value+=Number(row[col]);
  }
  const ordered=[...unique.values()];if(metric==='climb')ordered.sort((a,b)=>b.value-a.value);
  // The app's public ranking aggregates have broader SELECT privileges than profiles.
  // Resolve the same block- and follow-aware profile RPC before displaying any entry.
  const allowed=[];
  for(let i=0;i<Math.min(100,ordered.length)&&allowed.length<20&&ctx.active();i+=5){
    const slice=ordered.slice(i,i+5);
    const checked=await Promise.all(slice.map(async(row,j)=>{
      const p=await read(ctx.client.rpc('get_user_profile',{p_username:row.name}));
      if(p?.id!==row.id||p.relationship?.is_blocked_by||p.relationship?.is_blocking)return null;
      if(p.is_private&&p.id!==ctx.user.id&&!p.relationship?.is_following)return null;
      return {...row,place:i+j+1,name:p.display_name||p.username,username:p.username,city:p.city};
    }));allowed.push(...checked.filter(Boolean));
  }
  return allowed.slice(0,20);
}
export async function render(ctx){
  const mine=await read(ctx.client.from('profiles').select('city,country').eq('id',ctx.user.id).maybeSingle());
  const scopes=[['global','Worldwide'],...(mine?.country?[['country',mine.country]]:[]),...(mine?.city?[['city',mine.city]]:[]),['friends','Following'],['clubs','My clubs']];
  const scope=select('Running circle',scopes),metric=select('Rank by',types),rows=dom('div');
  const panel=block(group(scope.field,metric.field),rows);
  paint(ctx,title('Rankings','Choose a running circle and a metric to see how runners compare.'),panel);
  let stamp=0;
  async function update(){
    const op=++stamp,m=metric.input.value,s=scope.input.value;rows.replaceChildren(note('Loading rankings…'));
    try{const data=await getRows(ctx,m,s,mine);
      if(!ctx.active()||op!==stamp)return;
      if(!data.length){rows.replaceChildren(note('There are no qualifying runners to show in this circle.'));return;}
      const listing=dom('ol',null,'pf-ranklist');
      for(const r of data){
        const li=dom('li'),line=button('',()=>ctx.navigate('people',{profileId:r.id}),'pf-ranking');
        const name=dom('span',null,'pf-runner');name.append(dom('strong',r.name+(r.id===ctx.user.id?' (you)':'')),dom('small',[r.username?'@'+r.username:null,r.city].filter(Boolean).join(' · ')));
        line.append(dom('b',String(r.place).padStart(2,'0'),'pf-position'),name,dom('strong',displayValue(m,r.value)));li.append(line);listing.append(li);
      }
      rows.replaceChildren(listing);
      if(m==='climb') rows.append(note('Climb totals use up to 1,000 qualifying activities, as in the app.'));
    }catch{if(ctx.active()&&op===stamp)rows.replaceChildren(note('Rankings are unavailable right now.'),button('Retry rankings',update));}
  }
  scope.input.onchange=update;metric.input.onchange=update;await update();
}

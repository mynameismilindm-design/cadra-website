(() => {'use strict';
 const $=id=>document.getElementById(id), make=(tag,txt,cls)=>{let e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;};
 const named={overview:'Overview',history:'Activity history',people:'Find runners',community:'Community',clubs:'Clubs',messages:'Messages',training:'Training',rankings:'Rankings',activity:'Activity detail',gear:'Gear', 'club-verification':'Club verification',profile:'My profile',notifications:'Notifications',settings:'Settings','club-admin':'Club organizer','club-register':'Create a club','club-pro':'Club organizer',leagues:'Private leagues','club-detail':'Club detail','club-discovery':'Explore clubs','edit-profile':'Edit profile',media:'Your photos',trophies:'Trophies','athlete-stats':'Athlete stats','account-delete':'Account deletion',rules:'Community rules',safety:'Safety','shoe-detail':'Shoe details'};
 let active=null,version=0,weekVersion=0,stateView='overview',viewParams={},dispose=null,weekOffset=0,inFrame=null,weekSelection=-1,historyDepth=0,latestAt=null,weekHasActivity=null;
 const c=$('ds-page');
 const fmt=n=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(n);
 const local=(d)=>[d.getFullYear(),d.getMonth(),d.getDate()].join('-');
 function detach(){if(dispose){try{dispose();}catch{}}dispose=null;inFrame=null;c.replaceChildren();}
 function clear(){latestAt=null;weekHasActivity=null;$('week-jump').hidden=true;active=null;version++;weekVersion++;weekOffset=0;weekSelection=-1;historyDepth=0;detach();stateView='overview';viewParams={};$('ds-page').hidden=true;$('ds-overview').hidden=false;$('ds-search').value='';$('week-chart').replaceChildren();$('week-total').textContent='—';$('week-range').textContent='';$('week-caption').textContent='';$('ds-avatar').textContent='C';window.CadraExtras?.clearTheme();}
 function path(view,p){const u=new URL(location.href);u.search='';u.hash='';if(view==='people'&&p.username)u.searchParams.set('runner',p.username);else if(view!=='overview'){u.searchParams.set('view',view);for(const k of ['id','userId','username','tab','profileId','postId','query'])if(p[k])u.searchParams.set(k,String(p[k]).slice(0,128));}return u;}
 function initial(){const q=new URLSearchParams(location.search);if(q.get('runner'))return ['people',{username:q.get('runner').slice(0,128)}];const v=q.get('view');return [Object.hasOwn(named,v)?v:'overview',Object.fromEntries([...q].filter(([k])=>['id','userId','username','tab','profileId','postId','query'].includes(k)).map(([k,v])=>[k,v.slice(0,128)]))];}
 function resizeFrame(frame,h){frame.height=String(Math.ceil(Math.max(360,Math.min(1450,h+40))));}
 function bridge(host,ctx){
  const {view,params:p}=ctx;const paths={'club-admin':'/club-pro','club-register':'/club-pro?new=1','club-pro':p.id?'/club-pro?club='+encodeURIComponent(p.id):'/club-pro',leagues:'/leagues','edit-profile':'/profile/edit',media:'/media',trophies:'/trophies','athlete-stats':'/stats','account-delete':'/account/delete',rules:'/community-rules',safety:'/sos','club-detail':'/clubs/'+encodeURIComponent(p.id||''),'shoe-detail':'/gear/'+encodeURIComponent(p.id||'')};
  const top=make('div',null,'ds-section');const back=make('button','← Back to studio','ds-inline');back.onclick=()=>navigate('overview');top.append(back,make('h2',named[view]));const frame=make('iframe',null,'ds-tool-frame');frame.title=named[view];frame.referrerPolicy='no-referrer';frame.height=620;const url=paths[view];inFrame={frame,ctx,url};host.replaceChildren(top,frame);frame.src='field-tools/view.html';return ()=>{if(inFrame?.frame===frame)inFrame=null;frame.remove();};
 }
 window.CadraToolBridge=Object.freeze({attach(child){if(!active||!inFrame||inFrame.frame.contentWindow!==child)return null;const {frame,ctx,url}=inFrame;const alive=()=>active?.user===ctx.user&&inFrame?.frame===frame;
 return Object.freeze({client:ctx.client,user:ctx.user,path:url,profileChanged:(p)=>{if(alive()&&p?.id===ctx.user.id){profile({displayName:p.display_name,username:p.username});$('runner-title').textContent=p.display_name||p.username||'Your studio.';$('profile-line').textContent=[p.username?'@'+p.username:null,[p.city,p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');$('bio').textContent=p.bio||'';}},theme:document.documentElement.dataset.runnerTheme==='dark'?'dark':'light',resize:(n)=>{if(alive()&&Number.isFinite(n))resizeFrame(frame,n);},signOut:()=>{if(alive())$('signout').click();},route:(path,qs)=>{if(!alive())return;const q=new URLSearchParams(qs);let m;
 if(path==='/studio-back')return navigate(viewParams.from||({'club-detail':'clubs','club-pro':'clubs','club-register':'clubs',leagues:'community','athlete-stats':'profile','edit-profile':'profile',media:'profile',trophies:'profile',safety:'settings','account-delete':'settings','shoe-detail':'training'})[stateView]||'overview');
 if((m=path.match(/^\/profile\/([^/]+)\/(followers|following)$/)))return navigate('people',{username:decodeURIComponent(m[1]),tab:m[2]});
 if((m=path.match(/^\/profile\/([^/]+)$/)))return navigate('people',{username:decodeURIComponent(m[1])});
 if(path==='/community')return navigate('community',q.has('tab')?{tab:q.get('tab')}:{});
 if(path==='/history' && q.get('race'))return navigate('activity',{id:q.get('race')});
 if((m=path.match(/^\/activity\/([^/]+)\/analysis$/)))return navigate('activity',{id:m[1]});
 if((m=path.match(/^\/clubs\/([^/]+)$/)))return navigate('club-detail',{id:m[1]});
 if(path==='/gear')return navigate('training',{tab:'gear'});if(path==='/follow-requests')return navigate('people',{tab:'requests'});
 return navigate(({'/history':'history','/clubs/discover':'clubs','/clubs':'clubs','/club-pro':'club-pro','/leagues':'leagues','/profile':'profile','/rankings':'rankings','/settings':'settings','/search':'people','/account/delete':'account-delete','/profile/edit':'edit-profile','/community-rules':'rules','/premium':'training','/notifications':'notifications'})[path]||'overview');}});
 }});
 function offsetOf(d){const now=new Date();const mondayUTC=x=>Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()-(x.getDay()+6)%7);return Math.round((mondayUTC(d)-mondayUTC(now))/604800000);}
 function syncJump(){const off=latestAt==null?0:offsetOf(new Date(latestAt));$('week-jump').hidden=off>0||off===weekOffset||weekHasActivity!==false||!latestAt;}
 function latest(at){latestAt=at&&Number.isFinite(Date.parse(at))?Date.parse(at):null;syncJump();}
 async function week(){weekHasActivity=null;syncJump();
   if(!active)return;const t=++weekVersion,{client,user}=active,now=new Date(),from=new Date(now.getFullYear(),now.getMonth(),now.getDate());from.setDate(from.getDate()-((from.getDay()+6)%7)+weekOffset*7);
   const days=Array.from({length:8},(_,i)=>new Date(from.getFullYear(),from.getMonth(),from.getDate()+i));const until=days[7];const dates=days.slice(0,7),buckets=dates.map(()=>({km:0,count:0})),keys=dates.map(local);
   const friday=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});$('week-next').disabled=weekOffset>=0;
   $('week-range').textContent=friday.format(from)+' – '+friday.format(dates[6])+' · '+dates[6].getFullYear();$('week-total').textContent='—';$('week-caption').textContent='Loading weekly distance…';$('week-chart').replaceChildren();
   try{let offset=0;while(true){const size=250;const res=await client.from('races').select('id,started_at,distance_km').eq('user_id',user.id).gte('started_at',from.toISOString()).lt('started_at',until.toISOString()).order('started_at').order('id').range(offset,offset+size-1);if(t!==weekVersion)return;if(res.error)throw res.error;for(const row of res.data){const idx=keys.indexOf(local(new Date(row.started_at)));if(idx<0)continue;const distance=Number(row.distance_km);buckets[idx].count++;if(Number.isFinite(distance)&&distance>0)buckets[idx].km+=distance;}if(res.data.length<size)break;offset+=size;}
   weekHasActivity=buckets.some(d=>d.count>0);syncJump();const total=buckets.reduce((n,d)=>n+d.km,0),max=Math.max(1,...buckets.map(d=>d.km));$('week-total').textContent=fmt(total);weekSelection=weekOffset===0?(now.getDay()+6)%7:buckets.reduce((best,b,i)=>b.km>buckets[best].km?i:best,0);
   function select(i){weekSelection=i;for(const [j,b] of Array.from($('week-chart').children).entries())b.setAttribute('aria-pressed',String(j===i));const n=buckets[i];$('week-caption').textContent=dates[i].toLocaleDateString(undefined,{weekday:'long'})+' · '+fmt(n.km)+' km · '+n.count+' '+(n.count===1?'run':'runs');}
   for(const [i,b] of buckets.entries()){const btn=make('button');btn.type='button';const weekday=dates[i].toLocaleDateString(undefined,{weekday:'short'});btn.setAttribute('aria-label',weekday+', '+fmt(b.km)+' kilometres');btn.onclick=()=>select(i);
     const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 74');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');const rect=document.createElementNS(svg.namespaceURI,'rect'),h=Math.max(2,Math.round(b.km/max*69));for(const [k,v] of Object.entries({x:0,y:74-h,width:40,height:h,rx:2}))rect.setAttribute(k,v);svg.append(rect);btn.append(svg,make('span',weekday));$('week-chart').append(btn);}select(weekSelection);
   }catch{if(t===weekVersion)$('week-caption').textContent='Weekly distance is unavailable. Use Refresh to retry.';}
 }
 function historyView(host,ctx){
   let alive=true,next=0,busy=false;
   const head=make('div',null,'ds-section'), list=make('ol',null,'ds-history-list'),status=make('p'),more=make('button','Load earlier runs ↓','ds-btn');status.setAttribute('role','status');more.type='button';
   head.append(make('p','Training archive','ds-label'),make('h2','Activity history'),make('p','Open any saved run for its pace, splits and activity details.'),list,status,more);host.replaceChildren(head);
   const clock=n=>{if(n==null)return '—';const sec=Math.round(n),h=Math.floor(sec/3600);return (h?h+':':'')+String(Math.floor(sec/60)%60).padStart(h?2:1,'0')+':'+String(sec%60).padStart(2,'0');};
   async function load(){if(busy||next===null)return;busy=true;more.disabled=true;status.textContent='Loading runs…';
    try{const v=await window.CadraRunnerData.more(ctx.client,ctx.user.id,next);if(!alive||!ctx.isActive())return;if(v.errors.activities)throw Error();for(const r of v.activities){const li=make('li'),name=make('button',r.title,'ds-run-link'),details=make('small');name.type='button';name.onclick=()=>ctx.navigate('activity',{id:r.id});const date=new Date(r.startedAt);details.textContent=[r.startedAt&&Number.isFinite(+date)?date.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):null,r.distanceKm==null?null:fmt(r.distanceKm)+' km',r.durationSeconds==null?null:clock(r.durationSeconds),r.paceSecondsPerKm==null?null:clock(r.paceSecondsPerKm)+'/km'].filter(Boolean).join(' · ');li.append(name,details);list.append(li);}next=v.nextOffset;more.hidden=next===null;status.textContent=list.childElementCount?'Showing '+list.childElementCount+(v.activityCount!=null?' of '+v.activityCount:'')+' runs.':'Your saved runs will appear here after they sync.';}
    catch{if(alive){status.textContent='Your activity history could not be loaded.';more.textContent='Try again';}}finally{busy=false;more.disabled=false;}}
   more.onclick=load;load();return ()=>{alive=false;};
 }
 function navigate(view='overview',params={},record=true){
   if(!active||!Object.hasOwn(named,view))return;if(view==='gear'){view='training';params={tab:'gear'};}if(view==='club-discovery'){view='clubs';params={tab:'discover'};}
   const same=view===stateView;detach();stateView=view;viewParams={...params};version++;
   const key=version;if(record){const u=path(view,params);if(u.href!==location.href){history.pushState(null,'',u);historyDepth++;}}
   $('ds-overview').hidden=view!=='overview';c.hidden=view==='overview';$('ds-location').textContent=named[view];
   const group=({history:'overview',activity:'overview','edit-profile':'profile',media:'profile',trophies:'profile','athlete-stats':'profile','club-pro':'clubs','club-admin':'clubs','club-register':'clubs','club-verification':'clubs','club-detail':'clubs',leagues:'community','account-delete':'settings',rules:'settings',safety:'settings','shoe-detail':'training'})[view]||view;
   for(const b of document.querySelectorAll('.ds-rail [data-view]')){if(b.dataset.view===group)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
   if(view!=='overview'){const host=make('div');host.id=view==='people'?'people-content':'studio-view-content';c.append(host);
     const ctx={...active,view,params:{...params},navigate,openMessage:p=>navigate('messages',{userId:p.id,username:p.username}),onProfile:p=>navigate('people',typeof p==='string'?{profileId:p}:p),isActive:()=>key===version&&active!=null};
     function mount(fn){if(key!==version)return;return fn(host,ctx);}
     try{if(view==='history'){dispose=mount(historyView);}
      else if(view==='people'){dispose=params.tab==='blocked'?mount(window.CadraPeople.open):window.CadraSocial.gate(host,ctx,()=>mount(window.CadraPeople.open));}
      else if(['community','clubs','messages'].includes(view))dispose=mount(window.CadraSocial.open);
      else if(['rankings','activity','training'].includes(view))dispose=mount(window.CadraPerformance.open);
      else if(['settings','profile','notifications'].includes(view))dispose=mount(window.CadraExtras.open);
      else if(view==='club-verification')dispose=window.CadraSocial.gate(host,ctx,()=>mount(window.CadraClubVerification.open));
      else if(['club-register','club-admin','club-pro','club-detail','leagues'].includes(view))dispose=window.CadraSocial.gate(host,ctx,()=>mount(bridge));else dispose=mount(bridge);
     }catch{host.replaceChildren(make('p','Could not open this section. Try Refresh.','ds-section'));}
   }
   if(record&&!same){const top=$('ds-location');top.tabIndex=-1;top.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 }
 function start(client,user){if(active?.user.id===user.id)return;clear();active={client,user};window.CadraExtras?.restoreTheme(client,user,()=>active?.user===user);$('ds-date').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long'}).format(new Date());const [v,p]=initial();navigate(v,p,false);week();}
 function profile(p){if(!active)return;$('ds-avatar').textContent=(p?.displayName||p?.username||'C').trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]).join('').toUpperCase();}
 window.addEventListener('cadra:theme',e=>{if(inFrame?.frame.contentDocument?.documentElement)inFrame.frame.contentDocument.documentElement.dataset.theme=e.detail.resolved;});
 document.addEventListener('click',e=>{const b=e.target.closest('#dashboard [data-view]');if(b)navigate(b.dataset.view);});
 $('ds-search-form').onsubmit=e=>{e.preventDefault();const q=$('ds-search').value.trim();if(q.length>=2)navigate('people',{query:q});};
 document.addEventListener('keydown',e=>{if(active&&e.key==='/'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.target.closest('input,textarea,select,[contenteditable="true"]')){e.preventDefault();$('ds-search').focus();}});
 $('week-jump').onclick=()=>{if(latestAt){weekOffset=Math.min(0,offsetOf(new Date(latestAt)));week();}};
 $('week-prev').onclick=()=>{weekOffset--;week();};$('week-next').onclick=()=>{if(weekOffset<0){weekOffset++;week();}};
 window.addEventListener('popstate',()=>{if(active){const [v,p]=initial();navigate(v,p,false);}});
 window.CadraStudio=Object.freeze({start,clear,profile,navigate,latest,refresh:()=>{if(active){navigate(stateView,viewParams,false);week();}}});
})();

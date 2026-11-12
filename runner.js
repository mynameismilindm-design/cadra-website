(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const say = (id, value = '') => { el(id).textContent = value; };
  const visible = (id, show) => { el(id).hidden = !show; };
  const node = (tag, value, cls) => { const n=document.createElement(tag); if(value!=null)n.textContent=value; if(cls)n.className=cls; return n; };
  say('state','Checking your session…');
  const auth=window.CadraAuth, data=window.CadraRunnerData;
  if (!auth || !data || !(window.isSecureContext && location.protocol !== 'file:')) {
    say('state','Sign-in is unavailable here. Open the secure Cadra website or reload this page to try again.'); return;
  }
  let user=null, epoch=0, next=null, pendingMore=false, signingOut=false, recoveryEpoch=0, seen=new Set();
  const num = new Intl.NumberFormat(undefined,{maximumFractionDigits:2});
  const nfmt = n => n==null?'—':num.format(n);
  function duration(s) { if (s==null) return '—'; const n=Math.round(s), h=Math.floor(n/3600), m=Math.floor(n%3600/60), sec=String(n%60).padStart(2,'0'); return h?h+':'+String(m).padStart(2,'0')+':'+sec:m+':'+sec; }
  function date(v){const d=v?new Date(v):null;return d && Number.isFinite(+d)?d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Date unavailable';}
  function resetFlow() {
    ++recoveryEpoch; auth.cancelRecovery(); el('reset-email-form').reset();el('reset-code-form').reset();
    for(const id of ['reset-email-form','reset-code-form'])el(id).querySelector('[type=submit]').disabled=false;
    visible('recover-panel',false); visible('signin-panel',true); visible('reset-email-form',true); visible('reset-code-form',false);say('reset-message');
  }
  function scrub(){
    next=null;pendingMore=false;seen=new Set();
    for (const id of ['stats','ranks','bests','activities']) el(id).replaceChildren();
    for (const id of ['profile-line','bio','dash-status','rank-message','best-message','activity-message']) say(id);
    say('runner-title','Runner dashboard');visible('more',false);el('more').disabled=false;
  }
  function loginScreen(note='',focus=false){
    ++epoch;user=null;window.CadraStudio.clear(); scrub();resetFlow();el('login-form').reset();el('login-password').type='password';
    el('show-password').setAttribute('aria-pressed','false');el('show-password').setAttribute('aria-label','Show password');say('show-password','Show');
    visible('dashboard',false);visible('state',false);visible('welcome',true);say('login-message',note); if(focus)el('login-email').focus();
  }
  function pair(id,k,v){const wrap=node('div');wrap.append(node('dt',k),node('dd',v));el(id).append(wrap);}
  function stat(k,v){const wrap=node('div',null,'r-stat');wrap.append(node('small',k),node('strong',v));el('stats').append(wrap);}
  function runs(list){
    for(const run of list){
      if(seen.has(run.id))continue;seen.add(run.id);
      const li=node('li',null,'r-activity'), head=node('div'), metrics=node('div',null,'r-metrics');
      const detail=node('button',run.title,'ds-run-link');detail.type='button';detail.onclick=()=>window.CadraStudio.navigate('activity',{id:run.id});head.append(detail,node('small',date(run.startedAt)));
      for(const [k,v] of [['Distance',run.distanceKm==null?'—':nfmt(run.distanceKm)+' km'],['Time',duration(run.durationSeconds)],['Avg pace',run.paceSecondsPerKm==null?'—':duration(run.paceSecondsPerKm)+'/km']]){
        const cell=node('span');cell.append(node('small',k),node('b',v));metrics.append(cell);
      }
      li.append(head,metrics);el('activities').append(li);
    }
  }
  function render(v){
    scrub();
    const p=v.profile||{},r=v.ranking||{},e=v.errors||{};
    say('runner-title',p.displayName||'Your studio.');window.CadraStudio.profile(p);
    say('profile-line', [p.username?'@'+p.username:null,[p.city,p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '));
    say('bio',p.bio||'');say('dash-status',e.profile||'');
    stat('Saved runs',nfmt(v.activityCount));stat('Leaderboard distance',r.totalDistanceKm==null?'—':nfmt(r.totalDistanceKm)+' km');stat('Cadra score',nfmt(r.totalScore));
    const ranks=[['Worldwide',r.globalRank],['Country',r.countryRank],['City',r.cityRank]];
    if(ranks.some(([,n])=>n!=null))for(const [k,n] of ranks)pair('ranks',k,n==null?'Unranked':'#'+nfmt(n));
    else say('rank-message',e.ranking||'No score ranking yet.');
    for(const pb of v.bests)pair('bests',({HALF:'Half marathon',MARATHON:'Marathon'})[pb.category]||pb.category,duration(pb.timeSeconds));
    if(!v.bests.length)say('best-message',e.bests||'Your recorded best times will appear here.');
    runs(v.activities);window.CadraStudio.latest(v.activities[0]?.startedAt);next=v.nextOffset;visible('more',next!=null);
    if(!v.activities.length)say('activity-message',e.activities||'No saved runs yet. Complete and sync a run in the app to see it here.');
  }
  async function account(u,force=false){
    if(!u?.id||signingOut||(!force && user?.id===u.id))return;
    const changed=user?.id!==u.id;if(changed)window.CadraStudio.clear();const ticket=++epoch;user=u; scrub();resetFlow();el('login-form').reset();say('login-message');visible('welcome',false);visible('state',false);visible('dashboard',true);
    say('dash-status','Loading your running log…');el('refresh').disabled=true;el('signout').disabled=false;
    try{const verified=await auth.currentUser();if(ticket!==epoch)return;if(verified?.id!==u.id){loginScreen('Please sign in again.');return;}window.CadraStudio.start(auth.client,u);if(force)window.CadraStudio.refresh();const result=await data.load(auth.client,u.id);if(ticket===epoch)render(result);}
    catch{if(ticket===epoch)say('dash-status','Could not verify your account or load your dashboard. Try Refresh, or sign out and sign in again.');}
    finally{if(ticket===epoch)el('refresh').disabled=false;}
  }
  el('refresh').onclick=()=>account(user,true);
  el('more').onclick=async()=>{
    if(pendingMore||!user||next==null)return; const ticket=epoch;
    pendingMore=true; el('more').disabled=true;say('activity-message','Loading earlier runs…');
    try{const v=await data.more(auth.client,user.id,next);if(ticket!==epoch)return;
      if(v.errors.activities){say('activity-message','Earlier runs could not be loaded. Try again.');return;}
      runs(v.activities);next=v.nextOffset;visible('more',next!=null);say('activity-message',next==null?'All saved runs are shown.':'Earlier runs loaded.');
    }catch{if(ticket===epoch)say('activity-message','Could not load earlier runs. Refresh and try again.');}
    finally{if(ticket===epoch){pendingMore=false;el('more').disabled=false;}}
  };
  el('signout').onclick=async()=>{
    if(signingOut)return;signingOut=true;const old=user; ++epoch;window.CadraStudio.clear();scrub();el('signout').disabled=true;el('refresh').disabled=true;
    say('dash-status','Signing out…');
    try{await auth.signOut();history.replaceState(null,'',location.pathname);loginScreen('You’re signed out.',true);}
    catch{if(user?.id===old?.id){say('dash-status','Sign-out did not finish. Check your connection and try Sign out again.');el('signout').disabled=false;el('refresh').disabled=false;}}
    finally{signingOut=false;}
  };
  el('show-password').onclick=()=>{const field=el('login-password'),show=field.type==='password';field.type=show?'text':'password';say('show-password',show?'Hide':'Show');el('show-password').setAttribute('aria-pressed',String(show));el('show-password').setAttribute('aria-label',show?'Hide password':'Show password');};
  el('login-form').onsubmit=async ev=>{
    ev.preventDefault();const b=ev.currentTarget.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;el('forgot').disabled=true;say('login-message','Signing in…');
    try{await account(await auth.signIn(el('login-email').value,el('login-password').value));}
    catch(err){say('login-message',err.message||'Sign-in failed. Please try again.');}finally{b.disabled=false;el('forgot').disabled=false;}
  };
  el('forgot').onclick=()=>{resetFlow();el('reset-email').value=el('login-email').value;el('login-password').value='';visible('signin-panel',false);visible('recover-panel',true);el('reset-email').focus();};
  el('back-login').onclick=()=>{resetFlow();say('login-message');el('login-email').focus();};
  el('restart-reset').onclick=()=>{el('forgot').click();el('reset-email').focus();};
  el('reset-email-form').onsubmit=async ev=>{
    ev.preventDefault();const t=recoveryEpoch,b=ev.currentTarget.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;say('reset-message','Requesting your code…');
    try{await auth.requestRecovery(el('reset-email').value);if(t!==recoveryEpoch)return;visible('reset-email-form',false);visible('reset-code-form',true);say('reset-message');el('reset-code').focus();}
    catch(e){if(t===recoveryEpoch)say('reset-message',e.message);}finally{if(t===recoveryEpoch)b.disabled=false;}
  };
  el('reset-code-form').onsubmit=async ev=>{
    ev.preventDefault();const t=recoveryEpoch,b=ev.currentTarget.querySelector('[type=submit]');if(b.disabled)return;
    if(el('new-password').value!==el('confirm-password').value){say('reset-message','The two passwords do not match.');el('confirm-password').focus();return;}
    b.disabled=true;say('reset-message','Updating your password…');const email=el('reset-email').value;
    try{await auth.resetPassword(email,el('reset-code').value,el('new-password').value);if(t!==recoveryEpoch)return;resetFlow();el('login-email').value=email;say('login-message','Password updated. Sign in with your new password.');el('login-password').focus();}
    catch(e){if(t===recoveryEpoch)say('reset-message',e.message);}finally{if(t===recoveryEpoch)b.disabled=false;}
  };
  auth.onChange((event,u)=>{
    if(event==='INITIAL_SESSION')return;
    if(!u && event==='SIGNED_OUT'){if(user||!el('dashboard').hidden)loginScreen('You’re signed out.');return;}
    if(u && (event==='SIGNED_IN'||event==='TOKEN_REFRESHED'))void account(u);
  });
  async function restore(){
    const t=epoch;try{const u=await auth.currentUser();if(t!==epoch)return;if(u)await account(u);else loginScreen();}
    catch{if(t===epoch)loginScreen('Could not verify your previous session. Check your connection and sign in again.');}
  }
  window.addEventListener('pagehide',()=>{++epoch;user=null;window.CadraStudio.clear();scrub();resetFlow();el('login-form').reset();visible('dashboard',false);visible('welcome',false);visible('state',true);});
  window.addEventListener('pageshow',e=>{if(e.persisted)void restore();});
  void restore();
})();

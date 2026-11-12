/* Profile, preferences and the recipient's activity inbox. */
(() => {
  'use strict';
  const themeChoices = {light:'Light',dark:'Dark',system:'Follow system'};
  const settingsFields = 'private_profile,is_private,ghost_mode,show_last_seen,gear_notifications_enabled,like_notifications_enabled,theme_preference';
  const profileFields = 'id,display_name,username,city,country,bio,avatar_url,tier_level,level,followers_count,following_count,activities_count';
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  let themeUser = null, preference = 'system', themeTicket = 0;
  function stored(key, value) {
    try { if (value !== undefined) localStorage.setItem(key,value); else return localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  }
  function applyTheme() {
    if (!themeUser) return;
    const resolved = preference === 'system' ? (colorScheme.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.runnerTheme = resolved;
    window.dispatchEvent(new CustomEvent('cadra:theme',{detail:{preference,resolved}}));
  }
  colorScheme.addEventListener('change',applyTheme);
  function remember(userId, value) {
    themeUser=userId; preference=Object.hasOwn(themeChoices,value)?value:'system';
    stored('cadra_runner_theme:'+userId,preference);
    stored('velocity_theme_preference',preference); // Cadra's embedded tools use the same preference.
    applyTheme();
  }
  async function restoreTheme(client,user,isCurrent=()=>true) {
    if (!user?.id || !isCurrent()) return;
    const ticket=++themeTicket;
    remember(user.id,stored('cadra_runner_theme:'+user.id));
    try {
      const identity=await client.auth.getUser();
      if(identity.error || identity.data?.user?.id!==user.id || !isCurrent() || themeTicket!==ticket) return;
      const row=await read(client.from('profiles').select('theme_preference').eq('id',user.id).maybeSingle());
      if(isCurrent() && themeTicket===ticket && row && Object.hasOwn(themeChoices,row.theme_preference)) remember(user.id,row.theme_preference);
    } catch { /* Keep the previously synced account preference while offline. */ }
  }
  function clearTheme() {
    ++themeTicket; themeUser=null; preference='system';
    delete document.documentElement.dataset.runnerTheme;
    try { localStorage.removeItem('velocity_theme_preference'); } catch { /* Storage may be disabled. */ }
  }
  async function read(query) {
    const {data,error}=await query;
    if(error) throw error;
    return data;
  }
  function el(tag,cls,label) {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(label!=null) node.textContent=label;
    return node;
  }
  function group(cls,...children) { const box=el('div',cls);box.append(...children);return box; }
  function btn(label,fn,cls='ds-btn') {
    const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;
  }
  function panel(title) {
    const section=el('section','ds-section');section.append(el('h2',null,title));return section;
  }
  function jump(s,label,page,params) { return btn(label,()=>s.navigate(page,params)); }
  function tools(s,entries) {
    const list=el('div','ds-tool-list ex-tiles');
    for(const [label,hint,page,params] of entries) {
      const link=jump(s,'',page,params);link.className='ex-tile';link.append(el('b',null,label),el('small',null,hint));list.append(link);
    }
    return list;
  }
  function external(label,href) { const a=el('a','ex-anchor',label);a.href=href;return a; }
  function alertText(message) {const p=el('p','ex-error',message);p.setAttribute('role','alert');return p;}
  function open(host, opts) {
    const root=el('div','ex-area');host.replaceChildren(root);
    let mounted=true;
    const s={...opts,root,active:()=>mounted&&root.parentElement===host};
    s.verify=async()=>{
      if(!s.active()) throw Error('closed');
      const {data,error}=await s.client.auth.getUser();
      if(error || data?.user?.id!==s.user.id || !s.active()) throw Error('identity');
    };
    let clear=null;
    async function boot() {
      clear?.();clear=null;
      root.replaceChildren(el('p','ex-note','Loading…'));
      try {
        await s.verify();
        if(s.view==='settings') await settings(s);
        else if(s.view==='notifications') clear=notifications(s);
        else await profile(s);
      } catch(error) {
        if(s.active()) root.replaceChildren(alertText(error.message==='identity'?'Please sign in again to view this account.':'Couldn’t load this page. Please try again.'),btn('Try again',boot));
      }
    }
    boot();
    return ()=>{mounted=false;clear?.();root.remove();};
  }
  async function profile(s) {
    const p=await read(s.client.from('profiles').select(profileFields).eq('id',s.user.id).maybeSingle());
    if(!s.active()) return;
    if(!p) {s.root.replaceChildren(el('p','ex-note','Your runner profile is still being set up.'),jump(s,'Edit profile','edit-profile'));return;}
    const name=p.display_name||p.username||'Runner', initial=name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase();
    const portrait=el('div','ex-portrait',initial);portrait.setAttribute('aria-hidden','true');
    try {
      const a=new URL(p.avatar_url);
      if(a.origin==='https://yljlzafmerojiipwbvhq.supabase.co' && /^\/storage\/v1\/object\/(public|sign)\/avatars\//.test(a.pathname)) {
        const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.hidden=true;
        img.onload=()=>{img.hidden=false;};img.onerror=()=>img.remove();img.src=a.href;portrait.append(img);
      }
    } catch { /* Initials also work without a profile photo. */ }
    const title=group('ex-identity',el('h2',null,name));
    const line=[p.username?'@'+p.username:'',[p.city,p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    if(line) title.append(el('p',null,line));
    const hero=el('section','ex-profile'), details=group('ex-profile-head',portrait,title);
    hero.append(details);
    if(p.bio) hero.append(el('p','ex-bio',p.bio));
    if(p.tier_level||p.level) hero.append(el('p','ex-tier',[p.level?'Level '+p.level:null,p.tier_level].filter(Boolean).join(' · ')));
    const links=group('ex-numbers');
    for(const [key,caption,view,params] of [['activities_count','Activities','history'],['followers_count','Followers','people',{tab:'followers'}],['following_count','Following','people',{tab:'following'}]]) {
      const b=jump(s,'',view,params);b.className='ex-stat';b.append(el('strong',null,p[key]??'—'),el('small',null,caption));links.append(b);
    }
    hero.append(links,jump(s,'Edit profile','edit-profile'));
    const library=panel('Your running profile');
    library.append(tools(s,[['Athlete stats','Personal bests and running trends','athlete-stats'],['Activity history','Browse your saved runs','history'],['Media','Photos from your activities','media'],['Trophies','Your earned awards','trophies']]));
    const circle=panel('Your circle');
    circle.append(tools(s,[['Follow requests','Review incoming requests','people',{tab:'requests'}],['Sent requests','View pending follows','people',{tab:'sent'}],['Find runners','Search by name or username','people'],['Account settings','Privacy and preferences','settings']]));
    s.root.replaceChildren(hero,library,circle);
    if(p.username) {
      const share=btn('Share profile',async()=>{
        const url=new URL(location.pathname,location.origin);url.searchParams.set('runner',p.username);
        try { await navigator.clipboard.writeText(url.href); if(s.active())share.textContent='Link copied'; }
        catch {if(s.active()){const input=el('input','ex-share');input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','Your profile link');share.replaceWith(input);input.focus();input.select();}}
      });hero.append(share);
    }
  }
  async function settings(s) {
    let p=await read(s.client.from('profiles').select(settingsFields).eq('id',s.user.id).maybeSingle());
    if(!s.active())return;
    if(!p)throw Error('missing profile');
    const appearance=panel('Appearance'), themes=el('div','ds-chipset'), msg=el('p','ex-status');
    msg.setAttribute('role','status');
    const privacy=panel('Privacy'), notifications=panel('Notification preferences');
    let busy=false;
    const controls=[];
    async function change(patch,control) {
      if(busy||!s.active())return;
      busy=true;controls.forEach(b=>b.disabled=true);msg.textContent='Saving…';
      try {
        await s.verify();
        const saved=await read(s.client.from('profiles').update(patch).eq('id',s.user.id).select(settingsFields).maybeSingle());
        if(!saved)throw Error('missing profile');
        if(!s.active())return;
        p=saved;
        if('theme_preference' in patch){++themeTicket;remember(s.user.id,saved.theme_preference);}
        if('private_profile' in patch || 'ghost_mode' in patch) stored('cadra_race_privacy:'+s.user.id,crypto.randomUUID());
        msg.textContent='Preference saved.';
      } catch {if(s.active())msg.textContent='Couldn’t save that preference. Please try again.';}
      finally {if(s.active()){busy=false;draw();control?.focus();}}
    }
    const drawing=[];
    function draw(){controls.forEach(b=>b.disabled=false);drawing.forEach(update=>update());}
    for(const [value,label] of Object.entries(themeChoices)) {
      const b=btn(label,()=>change({theme_preference:value},b));
      controls.push(b);drawing.push(()=>b.setAttribute('aria-pressed',String((p.theme_preference||'system')===value)));themes.append(b);
    }
    appearance.append(themes);
    const items=[
      [privacy,'Private profile','Only approved followers can see your saved runs. Your live map position is hidden.','private_profile'],
      [privacy,'Ghost mode','Hide your saved runs and live map position from other runners.','ghost_mode'],
      [privacy,'Show last seen','Share when you were online and see when others were last online.','show_last_seen'],
      [notifications,'Gear notifications','Get shoe wear reminders at 80% and 95% of their mileage limit.','gear_notifications_enabled'],
      [notifications,'Kudos notifications','Hear when someone likes one of your activities.','like_notifications_enabled']
    ];
    for(const [section,label,description,key] of items) {
      const row=el('div','ds-setting'), about=group('',el('b',null,label),el('small',null,description));
      const toggle=btn('',()=>{const next=toggle.getAttribute('aria-checked')!=='true';change(key==='private_profile'?{private_profile:next,is_private:next}:{[key]:next},toggle);},'ex-switch');
      toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',label);
      controls.push(toggle);drawing.push(()=>toggle.setAttribute('aria-checked',String(key==='private_profile'?(p.private_profile===true||p.is_private===true):p[key]!==false)));row.append(about,toggle);section.append(row);
    }
    draw();
    privacy.append(jump(s,'Manage blocked runners','people',{tab:'blocked'}));
    const account=panel('Account & support');
    account.append(tools(s,[['Edit profile','Name, bio, profile photo and measurements','edit-profile'],['My gear','Shoe mileage and replacement timing','gear'],['Community rules','Standards for posts and messages','rules'],['Safety','Emergency contacts and SOS options','safety'],['Delete account','Request deletion of your account and data','account-delete']]));
    account.append(group('ex-links',external('Privacy policy','https://cadrarunning.com/privacy.html'),external('Contact Cadra','mailto:milindmylarappa@cadrarunning.com')));
    s.root.replaceChildren(appearance,msg,privacy,notifications,account);
  }
  function notifications(s) {
    let rows=[],joined=[],offset=0,more=false,working=false,marking=false,filter='All',error='',challengeError=false,stopped=false;
    const initial=s.params?.filter;
    const filters=['All','Likes','Comments','Challenges'];
    if(filters.includes(initial))filter=initial;
    const buttons=el('div','ds-chipset'), list=panel('Activity updates'), challenges=panel('Your challenges');
    const top=group('ex-notice-nav',buttons,btn('Refresh notifications',()=>load()));
    const alive=()=>s.active()&&!stopped;
    const visible=()=>rows.filter(n=>filter==='All'||(filter==='Likes'&&n.type==='like')||(filter==='Comments'&&n.type==='comment'));
    for(const label of filters)buttons.append(btn(label,()=>{filter=label;draw();}));
    function drawChallenges() {
      challenges.replaceChildren(el('h2',null,'Your challenges'));
      if(challengeError)challenges.append(alertText('Couldn’t load challenge progress.'),btn('Retry challenges',()=>load()));
      else if(!joined.length)challenges.append(el('p','ex-note','You haven’t joined a challenge yet.'));
      for(const p of joined) {
        const pct=Math.max(0,Math.min(100,Number(p.progress_pct)||0)),item=el('div','ex-progress');
        const bar=el('progress');bar.max=100;bar.value=pct;bar.setAttribute('aria-label',p.challenges.title+' completion');
        const status={completed:'Completed',failed:'Expired',active:'Active'}[p.status]||'Active';
        const title=el('b',null,p.challenges.title);
        item.append(group('ex-progress-head',title,el('small',null,status+' · '+Math.round(pct)+'%')),bar);challenges.append(item);
      }
      challenges.append(jump(s,'Explore challenges','community',{tab:'challenges'}));
    }
    function draw() {
      if(!alive())return;
      buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===filter)));
      top.lastElementChild.disabled=working||marking;
      const shown=visible(),readButton=btn('Mark shown as read',mark);
      readButton.disabled=working||marking||!shown.some(n=>!n.is_read);
      list.replaceChildren(group('ex-list-head',el('h2',null,'Activity updates'),readButton));
      if(error)list.append(alertText(error));
      for(const n of shown)list.append(notice(s,n));
      if(!shown.length&&!error&&!working)list.append(el('p','ex-note',rows.length?'No matching updates in this page of your inbox.':'Your inbox is up to date.'));
      if(working)list.append(el('p','ex-note','Loading updates…'));
      if(more) {const older=btn('Load older updates',()=>load(true));older.disabled=working||marking;list.append(older);}
      challenges.hidden=!['All','Challenges'].includes(filter);list.hidden=filter==='Challenges';drawChallenges();
    }
    async function mark() {
      if(working||marking||!alive())return;
      const ids=visible().filter(n=>!n.is_read).map(n=>n.id);if(!ids.length)return;
      marking=true;error='';draw();
      try {
        await s.verify();
        await read(s.client.from('notifications').update({is_read:true}).eq('recipient_id',s.user.id).eq('is_read',false).in('id',ids));
        if(!alive())return;
        const marked=new Set(ids);rows=rows.map(n=>marked.has(n.id)?{...n,is_read:true}:n);
        window.dispatchEvent(new Event('cadra:notifications-read'));
      } catch {if(alive())error='Couldn’t mark these updates as read. Please try again.';}
      finally {marking=false;draw();}
    }
    async function page(start) {
      const notices=await read(s.client.from('notifications').select('id,sender_id,type,post_title,is_read,created_at,updated_at,feed_item_id,like_count').eq('recipient_id',s.user.id)
        .not('type','like','race*').not('type','like','ghost*')
        .or('scheduled_for.is.null,scheduled_for.lte.'+new Date().toISOString()).order('updated_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(start,start+29));
      const senders=[...new Set(notices.map(n=>n.sender_id).filter(Boolean))];
      const people=senders.length?await read(s.client.from('profiles').select('id,username,display_name').in('id',senders)):[];
      const byId=new Map(people.map(p=>[p.id,p]));
      return notices.map(n=>({...n,sender:byId.get(n.sender_id)}));
    }
    async function load(append=false) {
      if(working||marking||!alive())return;
      working=true;error='';draw();
      const tasks=[page(append?offset:0)];
      if(!append)tasks.push(read(s.client.from('challenge_participants').select('status,progress_pct,challenges(title)').eq('user_id',s.user.id).neq('status','abandoned').order('joined_at',{ascending:false})));
      const [posts,catalog]=await Promise.allSettled(tasks);
      if(!alive())return;
      if(posts.status==='fulfilled'){
        const fresh=posts.value;offset=(append?offset:0)+fresh.length;more=fresh.length===30;
        rows=[...new Map((append?[...rows,...fresh]:fresh).map(n=>[n.id,n])).values()];
      } else error='Couldn’t load notifications. Refresh to try again.';
      if(catalog){challengeError=catalog.status==='rejected';if(!challengeError)joined=catalog.value.filter(p=>p.challenges&&p.status!=='abandoned');}
      working=false;draw();
    }
    s.root.replaceChildren(top,challenges,list);
    draw();load();
    const focus=()=>load();window.addEventListener('focus',focus);
    return ()=>{stopped=true;window.removeEventListener('focus',focus);};
  }
  function notice(s,n) {
    const sender=n.sender?.display_name||n.sender?.username||'A runner';
    const who=n.type==='like'&&Number(n.like_count)>1?sender+' and '+(n.like_count-1)+' '+(n.like_count===2?'other':'others'):sender;
    const names={like:who+' liked your '+(n.post_title||'activity'),comment:sender+' commented on your '+(n.post_title||'activity'),gear_threshold:n.post_title||'Shoe mileage alert',gear_retired:n.post_title||'Shoe retired',follow_request:sender+' requested to follow you',message:sender+' sent you a message'};
    const row=el('article','ds-news ex-notice'+(n.is_read?'':' ex-unread'));
    const stamp=new Date(n.updated_at||n.created_at);
    row.append(el('b',null,names[n.type]||n.post_title||'Activity update'));
    const info=[!n.is_read?'Unread':'',Number.isFinite(stamp.valueOf())?stamp.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):''].filter(Boolean).join(' · ');
    row.append(el('small',null,info));
    const actions=el('div','ex-links');
    if(['like','comment'].includes(n.type))actions.append(jump(s,'View activity','community',n.feed_item_id?{postId:n.feed_item_id}:{}));
    if(n.type.startsWith('gear_'))actions.append(jump(s,'View gear','gear'));
    if(n.type==='follow_request')actions.append(jump(s,'View requests','people',{tab:'requests'}));
    if(n.type==='message')actions.append(jump(s,'Open conversation','messages',{username:n.sender?.username,userId:n.sender_id}));
    if(n.sender?.username)actions.append(jump(s,'@'+n.sender.username,'people',{profileId:n.sender_id,username:n.sender.username}));
    if(n.type==='like'&&n.feed_item_id){
      const list=el('div','ex-likers');
      const b=btn('See who liked this',async()=>{
        b.disabled=true;list.replaceChildren();
        try {
          const result=await read(s.client.rpc('get_feed_likers',{p_feed_item_id:n.feed_item_id,p_limit:100}));
          if(!s.active()||!row.isConnected)return;
          if(!result.length)list.append(el('small',null,'No current likes.'));
          for(const p of result) {
            const label=p.display_name||p.username||'Runner';
            list.append(p.username?jump(s,label,'people',{profileId:p.user_id,username:p.username}):el('small',null,label));
          }
          if(result.length>=100)list.append(el('small',null,'Showing the latest 100 likes.'));
        } catch {if(s.active())list.append(alertText('Couldn’t load likes. Please try again.'));}
        finally {b.disabled=false;}
      });
      actions.append(b);row.append(actions,list);
    } else row.append(actions);
    return row;
  }
  window.CadraExtras=Object.freeze({open,restoreTheme,clearTheme});
})();

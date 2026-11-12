/* Cadra's community screens use the same authenticated RPCs as the mobile app. */
(() => {
  'use strict';

  const RULES_VERSION = '2026-10-23';
  const PAGE = 20;
  const box = (tag, name, text) => {
    const el = document.createElement(tag);
    if (name) el.className = name;
    if (text != null) el.textContent = String(text);
    return el;
  };
  const block = (cls, ...items) => {
    const el = box('div', cls);
    el.append(...items.filter(Boolean));
    return el;
  };
  const title = text => box('h3', '', text);
  const hint = text => box('p', 'cs-hint', text);
  const chip = text => box('span', 'cs-chip', text);
  const format = (value, time = false) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Date(value).toLocaleString(undefined, {
      day:'numeric', month:'short', year:'numeric', ...(time ? {hour:'numeric', minute:'2-digit'} : {})
    });
  };
  function clock(seconds) {
    if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
    const n = Math.max(0, Math.round(seconds));
    return [n >= 3600 ? Math.floor(n / 3600) : null, n >= 3600 ? String(Math.floor(n / 60) % 60).padStart(2, '0') : Math.floor(n / 60), String(n % 60).padStart(2,'0')].filter(x => x != null).join(':');
  }
  async function checked(promise) {
    const {data, error} = await promise;
    if (error) throw error;
    return data;
  }
  async function verify({client, user}) {
    const result = await client.auth.getUser();
    if (result.error || result.data?.user?.id !== user.id) throw new Error('session_changed');
  }
  function message(error) {
    const raw = error?.message || '';
    if (/session_changed|authenticat/i.test(raw)) return 'Your session changed. Sign in again to continue.';
    if (/must_follow_each_other/i.test(raw)) return 'You can send messages once you follow each other.';
    if (/profanity|abusive/i.test(raw)) return 'Please revise the wording before posting.';
    if (/rate.?limit|already_reported/i.test(raw)) return 'A recent report is already recorded, or the daily limit was reached.';
    if (/forbidden|permission denied|not_member|not_found/i.test(raw)) return 'This content is unavailable to your account.';
    return 'Could not complete this request. Check your connection and try again.';
  }
  function button(text, action, cls='cs-button') {
    const el = box('button', cls, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  const named = p => p?.display_name || p?.username || 'Runner';
  function avatar(name, seed = '') {
    const sum = Array.from(seed || name).reduce((v,c) => v+c.codePointAt(0),0);
    return box('span', 'cs-avatar cs-tone-'+sum%4, name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase());
  }
  function identity(p, action) {
    const name = named(p);
    const el = button('', action,'cs-identity');
    const label = box('span');
    label.append(box('b','',name));
    if (p?.username && name !== p.username) label.append(box('small','','@'+p.username));
    el.append(avatar(name,p?.id),label);
    return el;
  }
  function input(placeholder, max, multiline=false) {
    const el = box(multiline?'textarea':'input','cs-field');
    el.placeholder=placeholder; el.setAttribute('aria-label',placeholder);
    if (max) el.maxLength=max;
    if (multiline) el.rows=2;
    return el;
  }
  function formButton(text) {
    const b = box('button','cs-button cs-primary',text);
    b.type='submit';
    return b;
  }
  function status() {
    const el = box('p','cs-status'); el.setAttribute('role','status'); return el;
  }
  function hostState(host, ctx) {
    const root = block('cs-workspace'); host.replaceChildren(root);
    const timers = new Set();
    let open = true;
    const live = () => open && root.parentElement === host;
    const clean = () => {open=false; for(const t of timers) clearInterval(t); timers.clear(); root.remove();};
    const run = async (buttonEl, note, action) => {
      if(!live() || buttonEl.disabled) return;
      buttonEl.disabled=true; note.textContent='';
      try {await verify(ctx); if(live()) await action();}
      catch(error) {if(live()) note.textContent=message(error);}
      finally {if(live()) buttonEl.disabled=false;}
    };
    return {root,live,clean,run,timers,...ctx};
  }

  function gate(host, ctx, start) {
    const s = hostState(host, ctx);
    let contentCleanup=null, disposed=false;
    function enter() {
      if (!s.live()) return;
      s.clean();
      contentCleanup=start();
    }
    async function check() {
      s.root.replaceChildren(hint('Checking your community access…'));
      try {
        await verify(ctx);
        if (!s.live()) return;
        const accepted = await checked(ctx.client.from('community_rules_acceptances').select('version').eq('user_id',ctx.user.id).maybeSingle());
        if (!s.live()) return;
        if (accepted?.version===RULES_VERSION) {enter(); return;}
        const rules=box('ul','cs-rules');
        [
          'No harassment, bullying, threats, hateful content or discrimination.',
          'No sexual exploitation, abusive sexual content, nudity or graphic violence.',
          'No scams, impersonation, spam or promotion of illegal activity.',
          'Share only content you have permission to use. Do not expose someone’s private information or location without permission.',
          'Report a post, comment or profile to flag a concern. You can block a runner from their profile.',
          'Content that breaks the rules may be removed. Access to Cadra may be restricted or suspended.'
        ].forEach(line=>rules.append(box('li','',line)));
        const panel=block('cs-card',title('Our running community'),hint('These rules apply to profiles, photos, activity notes, comments, clubs and messages.'),rules);
        const label=box('label','cs-consent');const tick=box('input');tick.type='checkbox';label.append(tick,' I have read and agree to follow these rules.');
        const note=status(), accept=button('Agree and continue',()=>s.run(accept,note,async()=>{
          await checked(ctx.client.rpc('accept_community_rules',{p_version:RULES_VERSION})); enter();
        }),'cs-button cs-primary');
        accept.disabled=true;tick.addEventListener('change',()=>{accept.disabled=!tick.checked;});
        panel.append(label,accept,note);s.root.replaceChildren(panel);
      } catch(error) {if(s.live()) s.root.replaceChildren(hint(message(error)),button('Retry',check));}
    }
    check();
    return () => {if(disposed)return;disposed=true;s.clean();if(typeof contentCleanup==='function')contentCleanup();};
  }

  function open(host, ctx) {
    return gate(host,ctx,()=>{
      const s = hostState(host,ctx);
      s.params ||= {};
      const content = block('cs-content'); const note=status();
      const tabs=block('cs-tabs');
      const destinations = [['community','Activity feed',{}],['community','Community runs',{tab:'events'}],['community','Challenges',{tab:'challenges'}],['clubs','Run clubs',{}],['messages','Messages',{}]];
      for (const [view,label,params] of destinations) {
        const link=button(label,()=>s.navigate(view,params),'cs-tab');
        if (ctx.view===view && (view!=='community' || (s.params.tab||'feed')===(params.tab||'feed'))) link.setAttribute('aria-current','page');
        tabs.append(link);
      }
      const views={community:()=>s.params.tab==='events'?communityRuns(s,content):s.params.tab==='challenges'?challenges(s,content):feed(s,content),clubs:()=>clubs(s,content),messages:()=>messages(s,content)};
      async function draw(){
        note.replaceChildren();content.replaceChildren(hint('Loading…'));
        try{await views[ctx.view]();}catch(error){if(s.live())content.replaceChildren(hint(message(error)),button('Try again',draw));}
      }
      s.root.append(tabs,note,content);draw();return s.clean;
    });
  }
  // The read and moderation RPCs return author names. Resolve those names
  // through the app's block-aware profile endpoint before rendering a comment.
  async function permittedAuthors(s, rows, activity=false) {
    const names=[...new Set(rows.map(p=>p.username).filter(Boolean))];
    const visible=new Set();
    for(let i=0;i<names.length && s.live();i+=8){
      const group=names.slice(i,i+8);
      await Promise.all(group.map(async name=>{
        const profile=await checked(s.client.rpc('get_user_profile',{p_username:name}));
        if(profile?.id && (!activity || !profile.is_private || profile.relationship?.is_following))visible.add(profile.id);
      }));
    }
    return rows.filter(x=>x.user_id===s.user.id || visible.has(x.user_id));
  }
  function report(s, parent, username, type, id) {
    const holder=block('cs-report');
    const toggle=button('Report '+type,()=>{form.hidden=false;toggle.hidden=true;reason.focus();},'cs-text');
    const form=box('form','cs-composer');form.hidden=true;
    const reason=box('select','cs-field');reason.setAttribute('aria-label','Reason for reporting');
    for(const [v,l] of [['inappropriate_content','Inappropriate content'],['harassment','Harassment'],['spam','Spam'],['impersonation','Impersonation'],['other','Other']]){
      const o=box('option','',l);o.value=v;reason.append(o);
    }
    const detail=input('Additional details (optional)',800,true);
    const send=formButton('Submit report'), note=status(), cancel=button('Cancel',()=>{form.hidden=true;toggle.hidden=false;toggle.focus();},'cs-text');
    form.append(reason, detail,block('cs-actions',send,cancel));form.onsubmit=e=>{e.preventDefault();s.run(send,note,async()=>{
      await checked(s.client.rpc('report_user',{p_username:username,p_reason:reason.value,p_details:type+' ID: '+id+'\n'+detail.value}));
      if(s.live()){form.hidden=true;note.textContent='Report submitted.';}
    });};holder.append(toggle,form,note);parent.append(holder);
  }
  async function feed(s, host) {
    const fields='id,user_id,action_type,highlight_value,badge_text,reactions_count,comments_count,race_id,created_at,profiles!community_feed_user_id_fkey(id,username,display_name,ghost_mode,private_profile,is_private),races!community_feed_race_id_fkey(id,title,description,distance_km,duration_secs,pace_sec_per_km)';
    const list=block('cs-feed'), heading=block('cs-heading',title('Community feed'),button('Find runners',()=>s.navigate('people'), 'cs-text'));
    const note=status();let offset=0;
    const more=button('Show earlier posts',()=>s.run(more,note,load));
    async function load(){
      let query=s.client.from('community_feed').select(fields).order('created_at',{ascending:false}).order('id',{ascending:false});
      if(s.params.postId) query=query.eq('id',s.params.postId);
      const rows=await checked(query.range(offset,offset+PAGE-1));
      if(!s.live())return;
      const posts=rows.filter(p=>p.profiles && (p.user_id===s.user.id || !(p.profiles.ghost_mode||p.profiles.private_profile||p.profiles.is_private)) && (!p.race_id || p.races));
      const likes=posts.length ? await checked(s.client.rpc('get_my_feed_likes',{p_feed_item_ids:posts.map(x=>x.id)})) : [];
      if(!s.live())return;
      const liked=new Set((likes||[]).map(x=>x.feed_item_id));
      if(!offset)host.replaceChildren(heading,list,more,note);
      for(const item of posts)list.append(feedCard(s,item,liked.has(item.id)));
      offset+=rows.length;more.hidden=rows.length<PAGE||!!s.params.postId;
      if(!list.children.length)note.textContent=more.hidden?'No visible posts yet.':'More posts may be available on the next page.';
      else note.textContent='';
    }
    await load();
  }
  function feedCard(s, item, liked) {
    const race=item.races, p=item.profiles;
    const card=box('article','cs-card cs-post');
    const name=identity(p,()=>s.navigate('people',{profileId:item.user_id,username:p.username}));
    card.append(block('cs-byline',name,box('time','cs-micro',format(item.created_at))));
    card.append(title(race?.title || item.highlight_value || (item.action_type==='medal_earned'?'Earned a medal':'Run completed')));
    if(race?.description)card.append(hint(race.description));
    if(race){
      const metrics=block('cs-metrics');
      for(const [label,v] of [['Distance',race.distance_km==null?null:Number(race.distance_km).toLocaleString(undefined,{maximumFractionDigits:2})+' km'],['Avg pace',race.pace_sec_per_km>0?clock(race.pace_sec_per_km)+'/km':null],['Time',race.duration_secs==null?null:clock(race.duration_secs)]]){
        if(v) metrics.append(block('',box('small','',label),box('strong','',v)));
      }card.append(metrics);
    } else if(item.badge_text)card.append(chip(item.badge_text));
    const note=status(), extra=block('cs-extra');
    let count=item.reactions_count||0, comments=item.comments_count||0;
    const like=button('',()=>s.run(like,note,async()=>{
      const response=await checked(s.client.rpc('toggle_feed_like',{p_feed_item_id:item.id}));
      if(!s.live())return;liked=response.liked;count=response.count;setLike();
    }),'cs-soft');
    const setLike=()=>{like.textContent=(liked?'Liked':'Like')+' · '+count;like.setAttribute('aria-pressed',String(liked));};
    setLike();
    const likers=button('Likes · '+count,()=>s.run(likers,note,async()=>{
      const rows=await permittedAuthors(s,await checked(s.client.rpc('get_feed_likers',{p_feed_item_id:item.id,p_limit:100})));
      if(!s.live())return;extra.replaceChildren(title('Liked by'));
      for(const u of rows)extra.append(identity(u,()=>s.navigate('people',{profileId:u.user_id,username:u.username})));
      if(!rows.length)extra.append(hint('No likes yet.'));
    }),'cs-soft');
    const comment=button('Comments · '+comments,()=>s.run(comment,note,showComments),'cs-soft');
    let openComments=false;
    async function showComments(force=false){
      if(openComments&&!force){extra.replaceChildren();openComments=false;return;}
      const rows=await permittedAuthors(s,await checked(s.client.rpc('get_feed_comments',{p_feed_item_id:item.id,p_limit:50})));
      if(!s.live())return;
      openComments=true;extra.replaceChildren(title('Comments')); if(!rows.length)extra.append(hint('Start the conversation.'));
      for(const c of rows){
        const row=block('cs-comment',box('strong','',named(c)),box('p','',c.body));
        if(c.username && c.user_id!==s.user.id)report(s,row,c.username,'comment',c.id);
        extra.append(row);
      }
      const form=box('form','cs-composer'),body=input('Write a comment',500,true),send=formButton('Post comment'), feedback=status();body.required=true;
      form.append(body,send,feedback);form.onsubmit=e=>{e.preventDefault();if(!body.value.trim())return;s.run(send,feedback,async()=>{
        const result=await checked(s.client.rpc('add_feed_comment',{p_feed_item_id:item.id,p_body:body.value.trim()}));
        if(!s.live())return;body.value='';comments=result.count??comments+1;comment.textContent='Comments · '+comments;await showComments(true);
      });};extra.append(form);
    }
    const share=button('Share',async()=>{
      const text=named(p)+' on Cadra · '+(race?.title || item.highlight_value || 'Activity');
      try {
        if(navigator.share) await navigator.share({title:'Cadra',text});
        else if(navigator.clipboard){await navigator.clipboard.writeText(text);if(s.live())note.textContent='Activity summary copied.';}
        else if(s.live())note.textContent=text;
      } catch(error){if(s.live() && error.name!=='AbortError')note.textContent='Could not share this activity.';}
    },'cs-soft');
    card.append(block('cs-actions',item.user_id===s.user.id?likers:like,comment,share),note,extra);
    if(item.user_id!==s.user.id && p.username)report(s,card,p.username,'post',item.id);
    return card;
  }
  async function communityRuns(s,host) {
    const context=await checked(s.client.rpc('get_my_community_context'));
    if(!s.live())return;
    if(typeof context?.available!=='boolean')throw new Error('City unavailable');
    if(!context.available || !context.city || !context.timezone){
      host.replaceChildren(title('Community runs'),hint('Community runs are not scheduled for your profile city yet.'),button('Edit profile',()=>s.navigate('edit-profile')));return;
    }
    const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:context.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
    const timeFormat=new Intl.DateTimeFormat(undefined,{timeZone:context.timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'});
    const cityTime=ts=>ts && Number.isFinite(Date.parse(ts))?timeFormat.format(new Date(ts)):'Time unavailable';
    const dateParts=dateFormat.formatToParts(new Date()),part=key=>dateParts.find(p=>p.type===key).value;
    const date=part('year')+'-'+part('month')+'-'+part('day');
    const today=block('cs-card'),history=block('cs-feed'),feedback=status();
    const selectedDate=input('Results date');selectedDate.type='date';selectedDate.value=date;selectedDate.max=date;
    const historyForm=box('form','cs-search'),submit=formButton('Find results');historyForm.append(selectedDate,submit);
    let eventVersion=0,historyVersion=0,busy=false;
    async function showToday(){
      const revision=++eventVersion;
      const event=await checked(s.client.rpc('get_today_community_event',{p_city:context.city}));
      if(!s.live()||revision!==eventVersion)return;
      today.replaceChildren(box('small','cs-micro',context.city+' · '+context.timezone));
      if(!event?.id){today.append(title('No run scheduled today'));return;}
      const divisions=event.divisions||[],joined=divisions.find(d=>d.id===event.my_participation?.division_id);
      const eventState={scheduled:'Registration opens '+cityTime(event.lobby_opens_at),lobby_open:'Registration open',active:'In progress',finished:'Finished',archived:'Final results',cancelled:'Cancelled'};
      today.append(title(event.name||'Community run'),hint('Start '+cityTime(event.starts_at)+' · '+(eventState[event.status]||event.status)));
      if(joined)today.append(chip('Your division · '+joined.label));
      const group=block('cs-actions'); const eventNote=status();
      async function change(divisionId){
        if(busy)return;
        busy=true;++eventVersion;
        try {
          if(divisionId) await checked(s.client.rpc('join_community_event',{p_event_id:event.id,p_division_id:divisionId}));
          else await checked(s.client.rpc('leave_community_event',{p_event_id:event.id}));
          if(s.live())await showToday();
        } finally {busy=false;}
      }
      for(const d of divisions){
        if(event.status==='lobby_open' && d.id!==joined?.id){
          const b=button((joined?'Switch to ':'Register for ')+d.label,()=>s.run(b,eventNote,()=>change(d.id)));
          group.append(b);
        }else group.append(chip(d.label+' · '+(Number(d.participant_count)||0)+' registered'));
      }
      today.append(group);
      if(event.status==='lobby_open'){
        today.append(hint('Open the Cadra app and enter the lobby before the start to take part.'));
        if(joined){
          const leave=button('Cancel registration',()=>{leave.hidden=true;confirm.hidden=false;},'cs-text');
          const yes=button('Confirm cancellation',()=>s.run(yes,eventNote,()=>change(null)));
          const keep=button('Keep my place',()=>{confirm.hidden=true;leave.hidden=false;},'cs-text');
          const confirm=block('cs-actions',yes,keep);confirm.hidden=true;today.append(leave,confirm);
        }
      }
      today.append(eventNote);
    }
    const refresh=button('Refresh schedule',()=>s.run(refresh,feedback,showToday),'cs-text');
    async function showHistory(){
      const revision=++historyVersion;history.replaceChildren();
      const dateKey=selectedDate.value;if(!dateKey)return;
      const events=await checked(s.client.from('community_events')
        .select('id,name,starts_at,status,community_divisions(id,label,distance_m)')
        .eq('city',context.city.toLowerCase()).eq('event_date',dateKey).in('status',['finished','archived'])
        .order('starts_at',{ascending:false}).limit(30));
      if(!s.live()||revision!==historyVersion)return;
      if(!events.length){history.append(hint('No completed community runs for this date.'));return;}
      for(const event of events){
        const card=block('cs-card',title(event.name||'Community run'),hint((event.status==='finished'?'Provisional results':'Final results')+' · '+cityTime(event.starts_at)));
        const distances=block('cs-actions'),results=block('cs-event-results'),note=status();let boardVersion=0;
        for(const division of (event.community_divisions||[]).slice().sort((a,b)=>a.distance_m-b.distance_m)){
          const load=button(division.label,()=>s.run(load,note,async()=>{
            const token=++boardVersion;results.replaceChildren(hint('Loading results…'));
            const board=await checked(s.client.rpc('get_event_leaderboard',{p_event_id:event.id,p_division_id:division.id}));
            const raw=board?.rows||[];let visible=0,index=0;
            if(!s.live()||revision!==historyVersion||token!==boardVersion)return;
            results.replaceChildren(title(division.label));
            const rows=box('ol','cs-finishes');
            const page=async()=>{
              const batch=raw.slice(index,index+20);
              const allowed=await permittedAuthors(s,batch,true);
              if(!s.live()||revision!==historyVersion||token!==boardVersion)return;
              for(const runner of allowed){
                const label=(runner.user_id===s.user.id?'You':named(runner));
                const time=runner.duration_ms>0?clock(runner.duration_ms/1000):'—';
                const line=box('li');line.append(box('b','',String(runner.rank||'—')),button(label,()=>s.navigate('people',{profileId:runner.user_id,username:runner.username}),'cs-text'),box('span','',time));rows.append(line);
              }
              index+=batch.length;visible+=allowed.length;more.hidden=index>=raw.length;
              if(!visible && more.hidden)results.append(hint('No visible finishers in this division.'));
            };
            const more=button('More finishers',()=>s.run(more,note,page));results.append(rows,more);await page();
          }),'cs-soft');distances.append(load);
        }
        card.append(distances,results,note);history.append(card);
      }
    }
    historyForm.onsubmit=e=>{e.preventDefault();if(selectedDate.validity.valid)s.run(submit,feedback,showHistory);};
    host.replaceChildren(block('cs-heading',title('Community runs'),refresh),today,title('City results'),historyForm,history,feedback);
    const [schedule,results]=await Promise.allSettled([showToday(),showHistory()]);
    if(!s.live())return;
    if(schedule.status==='rejected')today.replaceChildren(hint(message(schedule.reason)));
    if(results.status==='rejected')history.replaceChildren(hint(message(results.reason)));
  }

  async function challenges(s, host) {
    const [catalog, participants] = await Promise.all([
      checked(s.client.from('challenges').select('id,slug,title,tagline,description,tier,participants_count,is_active,start_date,end_date').not('slug','is',null)),
      checked(s.client.from('challenge_participants').select('id,challenge_id,status,progress_pct,deadline_at,medal_earned,challenges(slug)').eq('user_id',s.user.id))
    ]);
    if(!s.live())return;
    const persisted=new Map(catalog.map(c=>[c.slug,c])), mine=new Map(participants.map(p=>[p.challenges?.slug,p]));
    const seeds=window.CadraChallengeCatalog||[], bySlug=new Map(seeds.map(c=>[c.slug,c]));
    for(const c of catalog)if(!bySlug.has(c.slug))bySlug.set(c.slug,c);
    let filter='All challenges';const filters=block('cs-filters'), grid=block('cs-tiles'), note=status();
    const today=new Date().toISOString().slice(0,10);
    const all=[...bySlug.values()].filter(c=>persisted.get(c.slug)?.is_active!==false);
    const set=chosen=>{
      filter=chosen;grid.replaceChildren();
      for(const b of filters.children)b.setAttribute('aria-pressed',String(b.textContent===filter));
      const cards=all.filter(c=>{const p=mine.get(c.slug);return filter==='All challenges' || (filter==='My challenges'?p && p.status!=='abandoned':c.tier===filter.toLowerCase());});
      for(const c of cards){
        const p=mine.get(c.slug),stored=persisted.get(c.slug);
        const closed=(c.fixed_end_date||stored?.end_date)<today && !!(c.fixed_end_date||stored?.end_date);
        const started=(c.fixed_start_date||stored?.start_date||'')<=today;
        const card=block('cs-card cs-challenge',chip(c.tier || 'Challenge'),title(c.title),hint(c.tagline||c.description||''));
        const windowEnd=c.fixed_end_date||stored?.end_date;
        const windowLabel=windowEnd?'Through '+format(windowEnd+'T12:00:00'):c.window_duration_days?c.window_duration_days+' days from joining':'Open challenge';
        card.append(box('small','cs-micro',windowLabel));
        if(p && p.status!=='abandoned'){
          const pct=Math.min(100, Math.max(0,Math.round(Number(p.progress_pct)||0)));
          const progress=box('progress','cs-progress'); progress.max=100;progress.value=pct;progress.setAttribute('aria-label','Challenge progress');
          card.append(progress,hint((p.status==='completed'?'Completed':p.status==='expired'||closed?'Ended':'Joined')+' · '+pct+'%'));
          if(p.status==='active'&&!closed){
            const feedback=status(),leave=button('Leave challenge',()=>{leave.hidden=true;confirm.hidden=false;},'cs-text');
            const cancel=button('Keep challenge',()=>{confirm.hidden=true;leave.hidden=false;},'cs-text');
            const yes=button('Confirm leave',()=>s.run(yes,feedback,async()=>{
              const row=await checked(s.client.from('challenge_participants').update({status:'abandoned',abandoned_at:new Date().toISOString()}).eq('id',p.id).eq('user_id',s.user.id).eq('status','active').select('id').maybeSingle());
              if(!row)throw new Error('unconfirmed');
              if(s.live()){p.status='abandoned';set(filter);}
            }));
            const confirm=block('cs-actions',yes,cancel);confirm.hidden=true;card.append(leave,confirm,feedback);
          }
        }else if(closed)card.append(hint('Registration closed'));
        else if(!started)card.append(hint('Starts '+format((c.fixed_start_date||stored.start_date)+'T12:00:00')));
        else{
          const feedback=status(),join=button('Join challenge',()=>s.run(join,feedback,async()=>{
            // Rejoining an active row resets progress in the mobile RPC. Read it
            // again immediately before joining so stale tabs preserve app progress.
            let row=stored?.id ? await checked(s.client.from('challenge_participants').select('id,status,progress_pct').eq('user_id',s.user.id).eq('challenge_id',stored.id).maybeSingle()):null;
            if (!row || row.status==='abandoned' || row.status==='expired'){
              const id=await checked(s.client.rpc('join_challenge_by_slug',{p_slug:c.slug,p_seed:seeds.includes(c)?c:null}));
              if(!id)throw new Error('unconfirmed');
              row={id,status:'active',progress_pct:0};
            }
            if(s.live()){mine.set(c.slug,row);set(filter);}
          }),'cs-button');card.append(join,feedback);
        }
        grid.append(card);
      }
      if(!cards.length)grid.append(hint(filter==='My challenges'?'Your joined challenges will appear here.':'No challenges at this level.'));
    };
    for(const name of ['All challenges','My challenges','Easy','Medium','Hard','Elite','Featured'])filters.append(button(name,()=>set(name),'cs-soft'));
    set(filter);host.replaceChildren(block('cs-heading',title('Challenges'),button('My trophies',()=>s.navigate('trophies'),'cs-text')),filters,grid,note);
  }

  async function clubs(s, host) {
    const owned=await checked(s.client.rpc('get_my_run_clubs'));if(!s.live())return;
    const mine=Array.isArray(owned?.clubs)?owned.clubs:[];
    const ownIds=new Set(mine.map(c=>c.id));
    const ownCards=block('cs-tiles'), publicCards=block('cs-tiles'),note=status(),search=input('Search clubs by name or city',60);
    search.type='search';
    function entry(club, member) {
      const el=block('cs-card cs-club',avatar(club.name,club.id),title(club.name),hint([club.city,club.is_verified?'Verified club':null].filter(Boolean).join(' · ')));
      if(club.description)el.append(box('p','cs-clamp',club.description));
      if(club.next_activity) el.append(block('cs-next',box('small','cs-micro','NEXT MEET'),box('strong','',club.next_activity.title),hint(format(club.next_activity.scheduled_at,true))));
      el.append(button('View club',()=>s.navigate('club-detail',{id:club.id})));
      if(member && club.can_manage)el.append(button('Club organizer',()=>s.navigate('club-pro',{id:club.id,club:club.id}),'cs-text'));
      return el;
    }
    mine.forEach(c=>ownCards.append(entry(c,true))); if(!mine.length)ownCards.append(hint('Find a club below to join your first crew.'));
    const heading=block('cs-heading',title('Your clubs'),button('Create a club',()=>s.navigate('club-register'),'cs-button'));
    const actions=block('cs-actions',button('Club verification',()=>s.navigate('club-verification'),'cs-text'),button('Club discovery',()=>s.navigate('club-discovery'),'cs-text'),button('Private leagues',()=>s.navigate('leagues'),'cs-text'));
    if(mine.some(c=>c.can_manage))actions.append(button('Founder dashboard',()=>s.navigate('club-admin'),'cs-text'));
    const form=box('form','cs-search');const submit=formButton('Search');form.append(search,submit);
    let offset=0,sequence=0;
    const more=button('More clubs',()=>s.run(more,note,()=>lookup(false)));
    async function lookup(reset=true) {
      const run=++sequence;
      if(reset){offset=0;publicCards.replaceChildren();more.hidden=true;}
      const term=search.value.trim();
      let query=s.client.from('run_clubs').select('id,name,city,description,is_verified').order('name').order('id');
      // Avoid raw PostgREST boolean expressions with interpolated user input.
      if(term){
        const escaped=term.replace(/[\\%_]/g,m=>'\\'+m);
        const fetchField=field=>s.client.from('run_clubs').select('id,name,city,description,is_verified').ilike(field,'%'+escaped+'%').order('name').order('id').range(0,59);
        const groups=await Promise.all([checked(fetchField('name')),checked(fetchField('city'))]);
        if(!s.live()||run!==sequence)return;
        const matches=new Map(groups.flat().map(c=>[c.id,c]));publicCards.replaceChildren();
        [...matches.values()].sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>publicCards.append(entry(c,ownIds.has(c.id))));
        more.hidden=true;note.textContent=matches.size?(groups.some(g=>g.length===60)?'Showing the closest matches. Refine your search for more clubs.':''):'No clubs match your search.';return;
      }
      const rows=await checked(query.range(offset,offset+PAGE-1));
      if(!s.live()||run!==sequence)return;
      rows.forEach(c=>publicCards.append(entry(c,ownIds.has(c.id))));
      offset+=rows.length;more.hidden=rows.length<PAGE;note.textContent=offset?'':'No clubs are listed yet.';
    }
    form.onsubmit=e=>{e.preventDefault();s.run(submit,note,()=>lookup(true));};
    host.replaceChildren(heading,ownCards,actions,block('cs-heading',title('Club directory')),form,publicCards,more,note);
    if(s.params.tab==='discover')search.focus();
    await lookup();
  }

  async function messages(s, host) {
    if(s.params.username||s.params.userId){await thread(s,host);return;}
    const note=status(),rows=[],list=block('cs-inbox'),find=input('Filter your conversations',100);
    find.type='search';let cursor=null;
    const draw=()=>{
      list.replaceChildren();
      const term=find.value.trim().toLocaleLowerCase();
      const matches=rows.filter(r=>(r.other_display+' '+r.other_username).toLocaleLowerCase().includes(term));
      for(const row of matches){
        const name=row.other_display||row.other_username||'Runner';
        const b=button('',()=>s.navigate('messages',{userId:row.other_id,username:row.other_username}),'cs-conversation');
        const text=block('cs-convo-copy',box('strong','',name),box('span','',(row.last_sender_id===s.user.id?'You: ':'')+(row.last_body||'')));
        const end=block('cs-convo-end',box('small','cs-micro',format(row.last_at)),row.unread_count>0?chip(row.unread_count+' unread'):null);
        b.append(avatar(name,row.other_id),text,end);list.append(b);
      }
      if(!matches.length)list.append(hint(term?'No matches in the conversations loaded.':'No conversations yet. Find a runner to send your first message.'));
    };
    const more=button('Load more conversations',()=>s.run(more,note,load));
    async function load(){
      const fresh=await checked(s.client.rpc('get_conversations',{lim:PAGE,cursor_created_at:cursor?.last_at||null,cursor_id:cursor?.other_id||null}));
      if(!s.live())return;
      const ids=new Set(rows.map(r=>r.other_id));for(const r of fresh)if(!ids.has(r.other_id))rows.push(r);
      cursor=fresh.at(-1);more.hidden=fresh.length<PAGE;draw();
    }
    find.oninput=draw;
    host.replaceChildren(block('cs-heading',title('Messages'),button('New message',()=>s.navigate('people'),'cs-button cs-primary')),find,list,more,note);await load();
  }

  async function thread(s,host) {
    let name=s.params.username;
    if(!name && s.params.userId){
      const profile=await checked(s.client.from('profiles').select('username').eq('id',s.params.userId).maybeSingle());
      name=profile?.username;
    }
    if(!s.live())return;
    const peer=name?await checked(s.client.rpc('get_user_profile',{p_username:name})):null;
    if(!s.live())return;
    const back=button('← Messages',()=>s.navigate('messages'),'cs-text');
    if(!peer?.id || (s.params.userId && peer.id!==s.params.userId) || peer.id===s.user.id){
      host.replaceChildren(back,hint('This conversation is unavailable.'));return;
    }
    const header=block('cs-heading',identity(peer,()=>s.navigate('people',{profileId:peer.id,username:peer.username})),back);
    const note=status(), log=box('ol','cs-chat'),form=box('form','cs-composer'),body=input('Write a message',2000,true),send=formButton('Send message');
    body.required=true;
    let permission;
    function updatePermission(profile) {
      const allowed=!(profile.is_private || profile.private_profile) || !!(profile.relationship?.is_following && profile.relationship?.is_followed_by);
      if(permission===allowed)return;
      permission=allowed;
      if(allowed)form.replaceChildren(body,send);else form.replaceChildren(hint('You can send messages once you follow each other.'));
    }
    updatePermission(peer);
    const byId=new Map();let cursor=null,first=true,version=0;
    const more=button('Load earlier messages',()=>s.run(more,note,()=>read(true)));
    async function read(older=false) {
      const revision=version;
      const rows=await checked(s.client.rpc('get_conversation_thread',{p_other_username:peer.username,lim:30,cursor_created_at:older?cursor?.created_at:null,cursor_id:older?cursor?.id:null}));
      if(!s.live()||revision!==version)return;
      if(!older && !rows.length)byId.clear();
      if(older||first){cursor=rows.at(-1)||null;more.hidden=rows.length<30;}
      const scrollToLatest=first || log.scrollHeight-log.scrollTop-log.clientHeight<48;
      const previousTop=log.scrollTop,previousHeight=log.scrollHeight;
      first=false;
      for(const row of rows){
        const mine=row.sender_id===s.user.id && row.recipient_id===peer.id;
        if(mine || (row.sender_id===peer.id && row.recipient_id===s.user.id))byId.set(row.id,row);
      }
      log.replaceChildren();
      for(const row of [...byId.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||String(a.id).localeCompare(b.id))){
        const mine=row.sender_id===s.user.id;
        const li=box('li',mine?'cs-bubble cs-outgoing':'cs-bubble');
        li.append(box('span','',row.body),box('small','',format(row.created_at,true)+(mine?(row.read_at?' · Read':' · Sent'):'')));log.append(li);
      }
      if(!byId.size)log.append(box('li','cs-hint','No messages yet.'));
      if(older)log.scrollTop=previousTop+log.scrollHeight-previousHeight;
      else if(scrollToLatest)log.scrollTop=log.scrollHeight;
      if(rows.some(row=>row.recipient_id===s.user.id && !row.read_at) && !document.hidden){
        await checked(s.client.rpc('mark_thread_read',{p_other_username:peer.username}));
      }
    }
    form.onsubmit=e=>{
      e.preventDefault();const value=body.value.trim();if(!permission||!value)return;
      s.run(send,note,async()=>{
        const result=await checked(s.client.rpc('send_message',{p_recipient_username:peer.username,p_body:value}));
        if(!result?.message_id)throw new Error('unconfirmed');
        if(!s.live())return;
        if(body.value.trim()===value)body.value='';
        ++version;
        try{await read(); if(s.live()){note.textContent='Message sent.';body.focus();}}
        catch{if(s.live())note.textContent='Message sent. Reopen the conversation to refresh it.';}
      });
    };
    host.replaceChildren(header,more,log,form,note);await read();
    if(!s.live())return;
    let polling=false;
    const timer=setInterval(async()=>{
      if(!s.live() || document.hidden || polling)return;
      polling=true;
      try{
        const latest=await checked(s.client.rpc('get_user_profile',{p_username:peer.username}));
        if(!s.live())return;
        if(latest?.id!==peer.id){
          clearInterval(timer);s.timers.delete(timer);++version;
          host.replaceChildren(back,hint('This conversation is unavailable.'));return;
        }
        updatePermission(latest);await read();
      }
      catch{if(s.live())note.textContent='Message updates are paused. Checking again shortly.';}
      finally{polling=false;}
    },12000);s.timers.add(timer);
  }

  window.CadraSocial = Object.freeze({open,gate});
})();

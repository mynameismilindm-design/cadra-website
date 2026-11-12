/* Runner discovery and relationships use the app's authenticated social RPCs. */
(() => {
  'use strict';
  const pageSize = 16;
  const cadraOrigin = 'https://yljlzafmerojiipwbvhq.supabase.co';
  const protectedBuckets = new Set(['race-photos','activity-photos','profile-media','og-images']);
  const sections = {
    search: 'Find runners', followers: 'Followers', following: 'Following',
    requests: 'Requests', sent: 'Sent requests', blocked: 'Blocked'
  };
  const reasons = [
    ['spam','Spam'],['harassment','Harassment or bullying'],['impersonation','Impersonation'],
    ['inappropriate_content','Inappropriate content'],['other','Something else']
  ];
  const emptyText = {
    search:'No runners found. Try a different name or username.',
    followers:'No followers yet.', following:'You aren’t following anyone yet.',
    requests:'You’re all caught up. New follow requests will appear here.',
    sent:'You have no pending follow requests.', blocked:'Your blocked list is empty.'
  };

  function element(tag, className, content) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (content != null) result.textContent = content;
    return result;
  }
  function button(label, action, className = 'cp-button') {
    const result = element('button', className, label);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  }
  function resultOf(response) {
    if (response.error) throw response.error;
    return response.data;
  }
  function issue(error) {
    if (error?.code === '53400') return 'You’ve reached the limit. Please try again later.';
    if (error?.code === 'P0001' && /private/i.test(error.message)) return 'This information is private.';
    if (error?.code === 'P0002' || error?.code === 'P0003') return 'This runner or request is no longer available.';
    if (error?.code === '42501') return 'This action is unavailable for your account or this runner.';
    if (error?.message === 'session_changed') return 'Your session changed. Please reopen this page.';
    return 'Couldn’t reach Cadra. Please try again.';
  }
  function time(seconds) {
    if (seconds == null || !Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '—';
    const total = Math.round(Number(seconds));
    const m = Math.floor(total / 60);
    return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2,'0') : m) + ':' + String(total % 60).padStart(2,'0');
  }
  function dist(km) {
    return km == null || !Number.isFinite(Number(km)) ? '—' : Number(km).toLocaleString(undefined,{maximumFractionDigits:2}) + ' km';
  }
  function shortDate(v) {
    const d = new Date(v);
    return v && !Number.isNaN(d.valueOf()) ? d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '';
  }
  function normalized(value) { return String(value || '').trim().replace(/^@/,'').trim(); }
  function metric(term, amount) {
    const item = element('div','cp-metric');
    item.append(element('dt',null,term), element('dd',null,amount));
    return item;
  }

  function open(host, context) {
    const { client,user,params = {} } = context;
    let mounted = true, generation = 0, debounce = 0, myUsername = '', cursor = null;
    let pageRows = [], loading = false, listOwner = null;
    let currentTab = Object.hasOwn(sections, params.tab) ? params.tab : 'search';
    let query = normalized(params.query);
    const frame = element('div','cp-people');
    const heading = element('div','cp-heading');
    const main = element('div','cp-main');
    const notice = element('p','cp-notice');
    notice.setAttribute('role','status');
    const list = element('div','cp-list');
    const search = element('input','cp-search-input');
    search.type = 'search'; search.id = 'people-search-input'; search.maxLength = 72;
    search.placeholder = 'Search name or @username'; search.setAttribute('aria-label','Find a runner by name or username');
    search.autocomplete = 'off'; search.autocapitalize = 'none'; search.spellcheck = false;
    search.value = query;
    const tabs = element('div','cp-tabs');
    tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','People sections');
    const next = button('Show more',() => loadList(false));
    const listTitle = element('h3','cp-list-heading');
    host.replaceChildren(frame);
    frame.append(heading,main,notice);
    const active = token => mounted && token === generation;
    const say = text => { if(mounted) notice.textContent = text || ''; };
    function cleanup() {
      mounted = false; ++generation; clearTimeout(debounce);
      frame.remove();
    }
    function reset() {
      clearTimeout(debounce); generation++; cursor = null; pageRows = []; loading = false;
      listOwner = null; next.hidden = true; next.disabled = false;
      heading.replaceChildren(); main.replaceChildren(); list.replaceChildren(); say('');
      return generation;
    }
    async function checkIdentity(token) {
      const {data, error} = await client.auth.getUser();
      if(error || data?.user?.id !== user.id || !active(token)) throw new Error('session_changed');
    }
    async function rpc(name, args) { return resultOf(await client.rpc(name,args)); }
    async function ownerUsername() {
      if (!myUsername) {
        const row = resultOf(await client.from('profiles').select('username').eq('id',user.id).maybeSingle());
        myUsername = row?.username || '';
      }
      if (!myUsername) throw new Error('No username');
      return myUsername;
    }
    function fromStorage(src, img) {
      if (!src) return;
      const current = generation;
      try {
        const url = new URL(src);
        const match = url.origin === cadraOrigin && url.pathname.match(/^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/);
        if (!match) return;
        img.referrerPolicy = 'no-referrer'; img.loading = 'lazy';
        if (!protectedBuckets.has(match[2])) { img.src = url.href; return; }
        client.storage.from(match[2]).createSignedUrl(decodeURIComponent(match[3]),120).then(({data,error}) => {
          if(active(current) && !error && data?.signedUrl && new URL(data.signedUrl).origin === cadraOrigin) img.src = data.signedUrl;
        }).catch(() => {});
      } catch { /* Keep initials when the media does not belong to Cadra. */ }
    }
    function avatar(row, large=false) {
      const name = row.display_name || row.username || '?';
      const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
      const badge = element('span', 'cp-avatar'+(large?' cp-avatar-large':''), initials);
      badge.setAttribute('aria-hidden','true');
      if (row.avatar_url) {
        const img = element('img'); img.alt = ''; img.hidden = true;
        img.onload = () => { img.hidden = false; }; img.onerror = () => img.remove();
        badge.append(img); fromStorage(row.avatar_url,img);
      }
      return badge;
    }
    async function mutate(target, name, args, onSuccess, message) {
      if(target.disabled || !mounted)return;
      const token = generation;
      target.disabled = true; say('');
      try {
        await checkIdentity(token);
        const result = await rpc(name,args);
        if (!active(token)) return;
        await onSuccess(result);
        if (mounted && message) say(message);
      } catch (error) { if(active(token)) say(issue(error)); }
      finally { if(active(token)) target.disabled = false; }
    }
    function followButton(row, update) {
      let status = row.follow_status || 'none', confirm = false;
      const btn = button('',() => {
        if(status === 'accepted' && !confirm) {
          confirm = true; btn.textContent = 'Confirm unfollow'; btn.setAttribute('aria-label','Confirm unfollow @'+row.username);
          return;
        }
        const adding = status === 'none';
        void mutate(btn,adding?'follow_user':'unfollow_user',{p_username:row.username},async result => {
          if (adding && !['pending','accepted'].includes(result?.status)) throw new Error('invalid_response');
          status = adding ? result.status : 'none'; confirm = false;
          row.follow_status = status; paint(); await update(status);
        });
      },'cp-button cp-follow');
      function paint() {
        btn.textContent = status === 'accepted' ? 'Following' : status === 'pending' ? 'Cancel request' : 'Follow';
        btn.dataset.status = status;
        btn.setAttribute('aria-label', (status === 'accepted'?'Unfollow':btn.textContent)+' @'+row.username);
      }
      paint();
      return btn;
    }
    function listPage(section, owner=null) {
      currentTab = section;reset();listOwner = owner;
      if(owner) heading.append(button('← Back to @'+owner,()=>void profilePage(owner),'cp-back'));
      heading.append(element('h2',null,owner ? sections[section] : 'Runners'));
      const form = element('form','cp-search');
      form.setAttribute('role','search'); form.setAttribute('aria-label','Runner directory');
      const icon = element('span','cp-search-icon'); icon.setAttribute('aria-hidden','true');
      const submit = element('button','cp-submit','Search');submit.type='submit';
      form.append(icon,search,submit);
      form.onsubmit = event => { event.preventDefault(); clearTimeout(debounce); searchChanged(true); };
      search.oninput = () => searchChanged(false);
      tabs.replaceChildren();
      if (!owner) {
        heading.append(form,tabs);
        for(const [key,label] of Object.entries(sections)) {
          const btn=button(label,()=>{listPage(key);if(key==='search')search.focus();},'cp-tab');
          btn.dataset.tab=key; btn.setAttribute('aria-pressed',String(currentTab===key)); tabs.append(btn);
        }
      } else heading.append(element('p','cp-sub','@'+owner));
      listTitle.textContent = section === 'search' ? 'Search results' : sections[section];
      listTitle.hidden = Boolean(owner);
      main.append(listTitle,list,next);
      void loadList(true);
    }
    function searchChanged(immediate) {
      query = normalized(search.value);
      currentTab = 'search';listOwner = null;
      for(const btn of tabs.children)btn.setAttribute('aria-pressed',String(btn.dataset.tab==='search'));
      generation++;clearTimeout(debounce);loading=false;cursor=null;pageRows=[];
      list.replaceChildren();next.hidden=true;say('');listTitle.textContent='Search results';
      if(query.length<2){say('Enter at least two letters to find a runner.');return;}
      if(immediate)void loadList(true);
      else debounce=setTimeout(()=>void loadList(true),300);
    }
    async function fetchRows(section, previous, token) {
      const args = {lim:pageSize};
      if(section==='search'){
        const rows = await rpc('search_users',{...args,q:query,cursor_rank:previous?.rank??null,cursor_id:previous?.id??null});
        if(!active(token)||!rows.length)return rows;
        const edges = resultOf(await client.from('follows').select('following_id,status').eq('follower_id',user.id).in('following_id',rows.map(row=>row.id)));
        const statusById = new Map(edges.map(edge=>[edge.following_id,edge.status]));
        return rows.map(row=>({...row,follow_status:statusById.get(row.id)||'none'}));
      }
      if(section==='sent'){
        let request = client.from('follows').select('following_id,runner:profiles!follows_following_id_fkey(id,username,display_name,avatar_url)').eq('follower_id',user.id).eq('status','pending').order('following_id').limit(pageSize);
        if(previous)request=request.gt('following_id',previous.id);
        return resultOf(await request).map(edge=>({...edge.runner,id:edge.following_id,follow_status:'pending'}));
      }
      const listName = {followers:'get_followers',following:'get_following',requests:'get_my_follow_requests',blocked:'get_my_blocks'}[section];
      if(section==='followers' || section==='following')args.p_username=listOwner||await ownerUsername();
      args.cursor_created_at=previous?.edge_created_at || previous?.requested_at || previous?.blocked_at || null;
      args.cursor_id=previous?.id||null;
      return rpc(listName,args);
    }
    function rowView(row) {
      const wrapper = element('article','cp-row');
      const openProfile = button('',()=>{if(row.username)void profilePage(row.username);},'cp-person');
      openProfile.disabled = currentTab==='blocked' || !row.username;
      const desc = element('span','cp-person-text');
      desc.append(element('strong',null,row.display_name || row.username || 'Runner'));
      desc.append(element('small',null,(row.username?'@'+row.username:'')+(row.is_following_requester?' · Follows you':'')));
      openProfile.append(avatar(row),desc);
      const actions=element('div','cp-row-actions');
      const refresh=()=>loadList(true);
      if(currentTab==='requests'){
        const accept=button('Accept',()=>mutate(accept,'accept_follow_request',{p_username:row.username},refresh,'Follow request accepted.'),'cp-button cp-emphasis');
        const decline=button('Decline',()=>mutate(decline,'decline_follow_request',{p_username:row.username},refresh,'Follow request declined.'));
        actions.append(accept,decline);
      } else if(currentTab==='blocked'){
        const unblock=button('Unblock',()=>mutate(unblock,'unblock_user',{p_username:row.username},refresh,'Runner unblocked.'));
        actions.append(unblock);
      } else if(row.id!==user.id && row.username)actions.append(followButton(row, async () => {
        if(currentTab==='sent'||currentTab==='following')await refresh();
      }));
      wrapper.append(openProfile,actions);return wrapper;
    }
    async function loadList(first) {
      if(loading && !first)return;
      const token = first ? ++generation : generation;
      const tab = currentTab, owner = listOwner;
      if(first){cursor=null;pageRows=[];list.replaceChildren();next.hidden=true;next.textContent='Show more';}
      if(tab==='search' && query.length<2){say('Enter at least two letters to find a runner.');return;}
      loading=true;next.disabled=true;say('Loading runners…');
      try {
        const batch = await fetchRows(tab,cursor,token);
        if(!active(token))return;
        for(const row of batch)if(row.username&&!pageRows.some(existing=>existing.id===row.id)){
          pageRows.push(row);list.append(rowView(row));
        }
        cursor=batch.length===pageSize?batch[batch.length-1]:null; next.hidden=!cursor;
        say(pageRows.length ? '' : owner?'This list has no runners yet.':emptyText[tab]);
      }catch(error){
        if(active(token)){say(issue(error));next.hidden=false;next.textContent='Try again';}
      }finally{if(active(token)){loading=false;next.disabled=false;if(cursor)next.textContent='Show more';}}
    }
    function profileActions(card, person, token) {
      const actions = element('div','cp-profile-actions');
      if (person.id !== user.id) {
        const subject={...person,follow_status:person.relationship?.follow_status || 'none'};
        actions.append(followButton(subject,()=>profilePage(person.username)));
        const canMessage=!person.is_private || (person.relationship?.is_following && person.relationship?.is_followed_by);
        if(typeof context.openMessage === 'function' && canMessage)actions.append(button('Message',()=>context.openMessage({id:person.id,username:person.username,displayName:person.display_name})));
      }
      const share=button('Share profile',async()=>{
        const url = new URL(location.pathname,location.origin);url.searchParams.set('runner',person.username);
        try{
          if(navigator.share)await navigator.share({title:(person.display_name||person.username)+' on Cadra',url:url.href});
          else{await navigator.clipboard.writeText(url.href);if(active(token))say('Profile link copied.');}
        }catch(error){if(active(token)&&error.name!=='AbortError'){
          const box=element('input','cp-share-url');box.readOnly=true;box.value=url.href;box.setAttribute('aria-label','Profile link to copy');actions.append(box);box.select();
        }}
      });
      actions.append(share);
      card.append(actions);
      if(person.id === user.id)return;
      const extra=element('details','cp-options');
      const summary=element('summary',null,'Profile options');
      const area=element('div','cp-option-area');
      const tools=element('div','cp-row-actions');
      const block = button('Block runner',()=>{
        area.replaceChildren(element('p',null,'Block @'+person.username+'? This removes the follow connection and prevents messages.'));
        const confirm=button('Confirm block',()=>mutate(confirm,'block_user',{p_username:person.username},()=>listPage('blocked'),'Runner blocked.'),'cp-button cp-danger');
        area.append(confirm,button('Cancel',()=>area.replaceChildren()));
      });
      const report=button('Report runner',()=>{
        const form=element('form','cp-report');
        const select=element('select'), reasonLabel=element('label',null,'Reason');
        for(const [value,name] of reasons){const option=element('option',null,name);option.value=value;select.append(option);}
        reasonLabel.append(select);
        const details=element('textarea');details.maxLength=1000; details.rows=3;
        const detailLabel=element('label',null,'Details (optional)');detailLabel.append(details);
        const submit=element('button','cp-button cp-emphasis','Send report');submit.type='submit';
        form.onsubmit=e=>{e.preventDefault();void mutate(submit,'report_user',{p_username:person.username,p_reason:select.value,p_details:details.value.trim()||null},
          ()=>area.replaceChildren(),'Your report was sent to Cadra.');};
        form.append(reasonLabel,detailLabel,submit,button('Cancel',()=>area.replaceChildren()));area.replaceChildren(form);
      });
      tools.append(report,block);extra.append(summary,tools,area);card.append(extra);
    }
    function activityList(person, parent, token) {
      const header=element('h3',null,'Recent activity'), items=element('div','cp-list'), status=element('p','cp-sub','Loading activities…');
      const more=button('Earlier activities',()=>load());
      let anchor=null, pending=false, count=0;
      const gallery=element('div','cp-gallery'), mediaHeading=element('h3',null,'Run photos');
      gallery.hidden=mediaHeading.hidden=more.hidden=true;
      parent.append(header,items,status,more,mediaHeading,gallery);
      async function load(){
        if(pending)return;pending=true;more.disabled=true;
        try {
          const batch=await rpc('get_user_activities',{p_username:person.username,lim:pageSize,cursor_started_at:anchor?.started_at||null,cursor_id:anchor?.id||null});
          if(!active(token))return;
          for(const run of batch){
            const card=element('article','cp-activity'), name=element('div');
            name.append(element('strong',null,run.title||'Run'),element('small',null,shortDate(run.started_at)));
            const stats = element('div','cp-run-metrics');
            stats.append(element('strong',null,dist(run.distance_km)),element('small',null,[time(run.duration_secs),run.pace_sec_per_km?time(run.pace_sec_per_km)+'/km':''].filter(Boolean).join(' · ')));
            card.append(name,stats);items.append(card);count++;
            if(Array.isArray(run.photo_urls))for(const src of run.photo_urls){
              if(!src)continue;
              const img=element('img');img.alt='Photo from '+(run.title||'a run');img.onerror=()=>img.remove();
              img.onload=()=>{if(active(token)){mediaHeading.hidden=gallery.hidden=false;}};fromStorage(src,img);gallery.append(img);
            }
          }
          anchor=batch.length===pageSize?batch[batch.length-1]:null;
          more.textContent='Earlier activities';more.hidden=!anchor;status.textContent=count?'':'No shared activities yet.';
        }catch(error){if(active(token)){status.textContent=issue(error);more.hidden=false;more.textContent='Retry activities';}}
        finally{if(active(token)){pending=false;more.disabled=false;}}
      }
      void load();
    }
    async function signature(person, box, token) {
      try{
        const stats=await rpc('get_user_signature_stats',{p_username:person.username});
        if(!active(token)||!stats)return;
        box.append(metric('Lifetime distance',dist(stats.lifetime_distance_km)),metric('Best pace',stats.best_pace?.pace_sec_per_km?time(stats.best_pace.pace_sec_per_km)+'/km':'—'),metric('Longest run',dist(stats.longest_run?.distance_km)));
      }catch{if(active(token)){const retry=button('Retry running stats',()=>{box.replaceChildren();signature(person,box,token);});box.append(retry);}}
    }
    async function profilePage(username, id) {
      const token=reset();
      heading.append(button('← Back to runners',()=>listPage(currentTab),'cp-back'));
      say('Loading runner…');
      try{
        if(!username && id)username = resultOf(await client.from('profiles').select('username').eq('id',id).maybeSingle())?.username;
        if(!active(token))return;
        const person = username ? await rpc('get_user_profile',{p_username:username}) : null;
        if(!active(token))return;
        if(!person || person.relationship?.is_blocked_by || person.relationship?.is_blocking){say('This profile is unavailable.');return;}
        say('');
        const card=element('section','cp-profile-card'), identity=element('div','cp-identity'), name=element('div');
        name.append(element('span','cp-handle','@'+person.username),element('h2',null,person.display_name||person.username));
        const location=[person.city,person.country].filter(Boolean).join(', ');
        if(location)name.append(element('p','cp-sub',location));
        identity.append(avatar(person,true),name);card.append(identity);
        if(person.bio)card.append(element('p','cp-bio',person.bio));
        const counts=element('div','cp-counts');
        counts.append(button((person.followers_count??0)+' followers',()=>listPage('followers',person.username),'cp-link'),button((person.following_count??0)+' following',()=>listPage('following',person.username),'cp-link'));
        card.append(counts);profileActions(card,person,token);main.append(card);
        if(person.is_private && person.id!==user.id && !person.relationship?.is_following){
          main.append(element('div','cp-private',person.relationship?.follow_status==='pending'?'Follow request sent. This runner’s activities are visible to approved followers.':'Private profile. Follow this runner to request access to their activities.'));
        }else{
          const stats=element('dl','cp-stats'), activities=element('section','cp-profile-runs');
          main.append(stats,activities);void signature(person,stats,token);activityList(person,activities,token);
        }
      }catch(error){if(active(token)){say(issue(error));main.append(button('Retry profile',()=>profilePage(username,id)));}}
    }
    async function start() {
      const token = generation;
      say('Opening runners…');
      try {
        await checkIdentity(token);
        if (!active(token)) return;
        if (params.username || params.profileId) await profilePage(normalized(params.username), params.profileId);
        else listPage(currentTab);
      } catch (error) {
        if (active(token)) {
          say(issue(error));
          main.replaceChildren(button('Retry', start));
        }
      }
    }
    void start();
    return cleanup;
  }
  window.CadraPeople = Object.freeze({open});
})();

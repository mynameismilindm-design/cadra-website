/* Founder verification requests are private to the authenticated applicant. */
(() => {
  'use strict';
  const table = 'club_verification_requests';
  const fields = 'id,applicant_user_id,club_name,city,status,created_at,reviewed_at,rejection_reason';

  function element(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function action(label, click, cls = 'cs-button') {
    const button = element('button', cls, label);
    button.type = 'button';
    button.addEventListener('click', click);
    return button;
  }

  function field(key, label, {type = 'text', required = false, limit, auto} = {}) {
    const wrapper = element('label', 'cv-field');
    const input = element(type === 'textarea' ? 'textarea' : 'input', 'cs-field');
    if (type === 'textarea') input.rows = 3;
    else input.type = type;
    input.name = key;
    input.required = required;
    if (limit) input.maxLength = limit;
    if (auto) input.autocomplete = auto;
    wrapper.append(element('span', '', label), input);
    return {wrapper,input};
  }

  function shortDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) ? date.toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'}) : '';
  }

  // The database accepts one client-assigned primary key and defaults status to pending.
  // Competing tabs and retries after a lost response use the same key for the
  // applicant's next request. A new request after a review gets a different key.
  async function nextId(owner, previousId) {
    const source = new TextEncoder().encode(['cadra-club-verification', owner, previousId || 'first'].join('/'));
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',source)).slice(0,16);
    bytes[6] = (bytes[6] & 15) | 128;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, i => i.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }

  function open(host, {client,user,navigate,isActive}) {
    const root = element('section','cs-workspace cv-workspace');
    const note = element('p','cs-status');
    note.setAttribute('role','status');
    const content = element('div','cv-content');
    const refresh = action('Refresh status', () => load(), 'cs-text');
    const back = action('← Run clubs', () => navigate('clubs'), 'cs-text');
    const heading = element('div','cs-heading');
    heading.append(element('h3','','Club verification'),back);
    root.append(heading,note,content);
    host.replaceChildren(root);
    let active = true, revision = 0, submitting = false, loading = false;
    const live = () => active && root.parentNode === host && (!isActive || isActive());

    async function verify() {
      const {data,error} = await client.auth.getUser();
      if (error || !user?.id || data?.user?.id !== user.id) throw new Error('session_changed');
    }
    async function ownedRows(pendingOnly = false) {
      let query = client.from(table).select(fields).eq('applicant_user_id',user.id);
      if (pendingOnly) query = query.eq('status','pending');
      const {data,error} = await query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(pendingOnly ? 1 : 20);
      if (error) throw error;
      return (data || []).filter(row => row.applicant_user_id === user.id);
    }

    function statusCard(row) {
      const labels = {pending:'Awaiting review',approved:'Request approved',rejected:'Request declined'};
      const card = element('article','cs-card cv-status-card');
      card.append(element('span','cs-chip',labels[row.status] || 'Submitted'),element('h3','',row.club_name),
        element('p','cs-hint',[row.city,shortDate(row.created_at)].filter(Boolean).join(' · ')));
      if (row.status !== 'pending' && row.reviewed_at) card.append(element('p','cs-hint','Reviewed '+shortDate(row.reviewed_at)));
      if (row.status === 'rejected' && row.rejection_reason) card.append(element('p','cs-hint',row.rejection_reason));
      return card;
    }
    function applicationForm(lastId) {
      const form = element('form','cs-card cv-form');
      form.append(element('h3','','Request verification'),element('p','cs-hint','Describe your running club and give Cadra a contact for the application.'));
      const inputs = {};
      const add = (key,label,opts) => {
        const item = field(key,label,opts);
        inputs[key] = item.input; form.append(item.wrapper);
      };
      add('club_name','Club name',{required:true,limit:150,auto:'organization'});
      add('city','City',{required:true,limit:100,auto:'address-level2'});
      add('description','About the club',{type:'textarea',required:true,limit:2000});
      add('founder_name','Founder name',{required:true,limit:150,auto:'name'});
      add('contact_email','Contact email',{type:'email',required:true,limit:254,auto:'email'});
      inputs.contact_email.value = user.email || '';
      add('website_url','Club website (optional)',{type:'url',limit:1000,auto:'url'});
      add('instagram_handle','Instagram handle (optional)',{limit:100});
      const consent = element('label','cs-consent');
      const tick = element('input');tick.type = 'checkbox';tick.required = true;
      consent.append(tick,'I am authorized to apply on behalf of this club.');
      const submit = element('button','cs-button cs-primary','Submit verification request');
      submit.type='submit';
      const feedback = element('p','cs-status');feedback.setAttribute('role','status');
      form.append(consent,submit,feedback);

      form.onsubmit = async event => {
        event.preventDefault();
        if (submitting || loading || !live() || !form.reportValidity()) return;
        const payload = {applicant_user_id:user.id};
        for (const [key,input] of Object.entries(inputs)) {
          const value = input.value.trim();
          if (input.required && !value) {input.setCustomValidity('Enter a value.');input.reportValidity();input.setCustomValidity('');return;}
          if (value) payload[key] = value;
        }
        if (payload.website_url && !/^https?:\/\//i.test(payload.website_url)) {
          const url = inputs.website_url;
          url.setCustomValidity('Enter a website that starts with https:// or http://.');url.reportValidity();url.setCustomValidity('');return;
        }
        submitting=true;submit.disabled=true;refresh.disabled=true;feedback.textContent='Submitting…';
        try {
          await verify();if(!live())return;
          const [pending,latest] = await Promise.all([ownedRows(true),ownedRows()]);
          if (!live())return;
          if (pending.length || (latest[0]?.id||null) !== lastId) {
            submitting=false;await load('Your application status has changed.');return;
          }
          payload.id=await nextId(user.id,lastId);
          if(!live())return;
          await verify();if(!live())return;
          // Use an INSERT. No client path can overwrite an earlier response,
          // application payload or reviewer fields on a retry.
          const {error} = await client.from(table).insert(payload);
          if(error && error.code!=='23505')throw error;
          if(!live())return;
          submitting=false;
          await load(error?'Your existing application is shown below.':'Verification request submitted.');
        } catch (error) {
          if(live())feedback.textContent=error.message==='session_changed'?'Your session changed. Sign in again to continue.':'Could not confirm submission. Refresh the status or try again.';
        } finally {
          submitting=false;
          if(live()){submit.disabled=false;refresh.disabled=false;}
        }
      };
      return form;
    }

    async function load(notice = '') {
      if (!live() || submitting || loading)return;
      const key=++revision;
      loading=true;refresh.disabled=true;note.textContent='Checking application status…';
      try {
        await verify(); if(!live() || key!==revision)return;
        const [history,pending] = await Promise.all([ownedRows(),ownedRows(true)]);
        if (!live() || key!==revision)return;
        content.replaceChildren();
        if (pending.length || history.length) {
          const top=element('div','cs-heading');top.append(element('h3','','Your applications'),refresh);content.append(top);
          const list=element('div','cs-tiles');
          const rows = [...new Map([...pending,...history].map(row => [row.id,row])).values()];
          rows.forEach(row => list.append(statusCard(row)));content.append(list);
        } else content.append(refresh);
        if (!pending.length)content.append(applicationForm(history[0]?.id||null));
        note.textContent=notice;
      } catch(error) {
        if(live() && key===revision){
          content.replaceChildren(refresh);
          const why = error.message === 'session_changed' ? 'Your session changed. Sign in again to continue.' : 'Could not load your application status. Refresh to try again.';
          note.textContent=[notice,why].filter(Boolean).join(' ');
        }
      } finally {if(live() && key===revision){loading=false;refresh.disabled=false;}}
    }
    load();
    return () => {active=false;++revision;root.remove();};
  }
  window.CadraClubVerification=Object.freeze({open});
})();

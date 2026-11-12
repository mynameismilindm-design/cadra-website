(() => {
  function openLegacySection() {
    const previous = location.hash.slice(1);
    const sections = {race:'duo', ghost:'modes', community:'modes', messages:'messages-link', faq:'questions'};
    if (!Object.hasOwn(sections, previous)) return;
    if (previous === 'ghost' || previous === 'community') document.querySelector('cadra-modes')?.selectMode?.(previous === 'ghost' ? 1 : 0);
    document.getElementById(sections[previous])?.scrollIntoView({block:'start',behavior:'instant'});
  }
  window.addEventListener('hashchange', openLegacySection);
  if (document.readyState === 'complete') openLegacySection();
  else window.addEventListener('load', openLegacySection, {once:true});
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.mast-nav');
  function showMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  menu.addEventListener('click', () => showMenu(menu.getAttribute('aria-expanded') === 'false'));
  nav.addEventListener('click', () => showMenu(false));
  document.addEventListener('click', event => {
    if (!event.target.closest('.mast')) showMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      showMenu(false);
      menu.focus();
    }
  });
  window.matchMedia('(min-width:601px)').addEventListener('change', event => {
    if (event.matches) showMenu(false);
  });

  const distance = document.querySelector('#pacer-distance');
  const minutes = document.querySelector('#pacer-minutes');
  const pace = document.querySelector('#pacer-result');
  function updatePace() {
    if (!minutes.validity.valid || minutes.value === '') {
      pace.textContent = '—';
      minutes.setAttribute('aria-invalid', 'true');
      return;
    }
    minutes.removeAttribute('aria-invalid');
    const secondsPerKm = Math.round(minutes.valueAsNumber * 60 / Number(distance.value));
    const seconds = String(secondsPerKm % 60).padStart(2, '0');
    const unit = document.createElement('small');
    unit.textContent = '/km';
    pace.replaceChildren(Math.floor(secondsPerKm / 60) + ':' + seconds + ' ', unit);
  }
  document.querySelector('#pacer-form').addEventListener('submit', event => event.preventDefault());
  distance.addEventListener('change', () => {
    minutes.value = {'5':25, '10':60, '21.1':120}[distance.value];
    updatePace();
  });
  minutes.addEventListener('input', updatePace);

  const clubSample = document.querySelector('#club-sample');
  const schedule = clubSample.innerHTML;
  const league = '<div class="notice-head"><span>November distance league</span><span>Season table</span></div><ol class="club-rows"><li><b>1. Mira</b><span>28 pts</span></li><li><b>2. Arun</b><span>24 pts</span></li><li><b>3. Dev</b><span>22 pts</span></li></ol>';
  const clubButtons = document.querySelectorAll('[data-club]');
  clubButtons.forEach(button => button.addEventListener('click', () => {
    const isSchedule = button.dataset.club === 'schedule';
    clubButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    clubSample.innerHTML = isSchedule ? schedule : league;
    document.querySelector('#club-info').textContent = isSchedule
      ? 'Schedule recurring runs, set pace groups, take attendance and export a club report.'
      : 'Invite your running circle to a private league, set distance challenges and follow each runner’s season points.';
  }));

  const deletion = document.querySelector('#deletion');
  const deletionForm = document.querySelector('#deletion-form');
  document.querySelector('#request-open').addEventListener('click', () => deletion.showModal());
  deletion.addEventListener('close', () => {
    deletionForm.reset();
    deletion.querySelector('.mail-result').textContent = '';
  });
  deletionForm.addEventListener('submit', event => {
    event.preventDefault();
    const email = deletionForm.elements.email.value.trim();
    const body = 'Hello Cadra support,\n\nPlease delete my Cadra account and its associated personal data. My registered email address is ' + email + '.\n\nThank you.';
    const draft = 'mailto:milindmylarappa@cadrarunning.com?subject=Cadra%20account%20deletion&body=' + encodeURIComponent(body);
    const link = document.createElement('a');
    link.href = draft;
    link.className = 'policy-link';
    link.textContent = 'Open email draft ↗';
    deletion.querySelector('.mail-result').replaceChildren('Your draft is ready. Open it in your mail app and send it to submit the request. ', link);
    link.focus();
  });
})();

'use strict';
const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuButton = document.querySelector('.menu-toggle');
const navigation = $('nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
});
window.matchMedia('(max-width: 800px)').addEventListener('change', closeMenu);

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
let distance = 5, raceState = 'ready', elapsed = 0, lastFrame = 0, frame = 0;
const duration = 9000;
function renderRace(progress) {
  const you = Math.min(1, progress * (1 + .012 * Math.sin(progress * Math.PI * 2)));
  const rival = Math.min(.956, progress * .956 * (1 + .025 * Math.sin(progress * Math.PI * 2)));
  $('you-distance').textContent = (distance * you).toFixed(2);
  $('rival-distance').textContent = (distance * rival).toFixed(2);
  $('you-bar').style.width = `${you * 100}%`;
  $('rival-bar').style.width = `${rival * 100}%`;
  const simulatedSeconds = distance * 328 * progress;
  $('you-pace').textContent = progress ? formatTime(Math.round(simulatedSeconds / (distance * you))) : '—:—';
  $('rival-pace').textContent = progress ? formatTime(Math.round(simulatedSeconds / (distance * rival))) : '—:—';
}
function setRaceButton(label, arrow = '↗') {
  $('play-race').replaceChildren(document.createTextNode(label + ' '));
  const icon = document.createElement('span'); icon.textContent = arrow; icon.setAttribute('aria-hidden', 'true');
  $('play-race').append(icon);
}
function finishRace() {
  raceState = 'finished'; elapsed = duration; renderRace(1);
  $('race-status').textContent = `Winner board: You · ${distance} km · ${formatTime(distance * 328)}.`;
  setRaceButton('Race again', '↺');
}
function tick(time) {
  if (raceState !== 'running') return;
  if (lastFrame) elapsed += Math.min(100, time - lastFrame);
  lastFrame = time;
  if (elapsed >= duration) { finishRace(); return; }
  renderRace(elapsed / duration);
  frame = requestAnimationFrame(tick);
}
function pauseRace() {
  cancelAnimationFrame(frame); raceState = 'paused'; lastFrame = 0;
  $('race-status').textContent = 'Demo paused. Your rival can wait.';
  setRaceButton('Resume demo', '→');
}
$('play-race').addEventListener('click', () => {
  if (raceState === 'running') { pauseRace(); return; }
  if (raceState === 'finished') { elapsed = 0; renderRace(0); }
  if (reduceMotion.matches) { finishRace(); return; }
  raceState = 'running'; lastFrame = 0;
  $('race-status').textContent = `The race is on. First to ${distance} km wins.`;
  setRaceButton('Pause demo', 'Ⅱ');
  frame = requestAnimationFrame(tick);
});
document.querySelectorAll('[data-distance]').forEach(button => button.addEventListener('click', () => {
  cancelAnimationFrame(frame); distance = Number(button.dataset.distance); elapsed = 0; lastFrame = 0; raceState = 'ready';
  document.querySelectorAll('[data-distance]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  renderRace(0); $('race-status').textContent = `Two cities. One ${distance} km challenge.`; setRaceButton('Start the demo');
}));
document.addEventListener('visibilitychange', () => { if (document.hidden && raceState === 'running') pauseRace(); });

let ghostTime = 1720, ghostSource = 'self';
function updateGhost() {
  const target = Number($('target-time').value), delta = ghostTime - target;
  $('ghost-time').textContent = formatTime(ghostTime); $('target-output').textContent = formatTime(target);
  $('target-time').setAttribute('aria-valuetext', `${Math.floor(target / 60)} minutes ${target % 60} seconds`);
  $('ghost-mark').style.left = `${8 + (ghostTime - 1200) / 900 * 84}%`;
  $('target-mark').style.left = `${8 + (target - 1200) / 900 * 84}%`;
  const opponent = ghostSource === 'self' ? 'your past self' : 'this recorded run';
  $('ghost-result').textContent = delta > 0 ? `${formatTime(delta)} faster than ${opponent}.` : delta < 0 ? `${formatTime(-delta)} behind ${opponent}.` : 'Exactly matched. Can you find another second?';
}
$('target-time').addEventListener('input', updateGhost);
document.querySelectorAll('[data-ghost]').forEach(button => button.addEventListener('click', () => {
  ghostSource = button.dataset.ghost; ghostTime = ghostSource === 'self' ? 1720 : 1575;
  document.querySelectorAll('[data-ghost]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  updateGhost();
}));
updateGhost();

// All tab content is a fixed illustrative example, with no app or server connection.
function wireTabs(selector, panelId, content) {
  const tabs = [...document.querySelectorAll(selector)], panel = $(panelId);
  const select = button => {
    tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab === button)); tab.tabIndex = tab === button ? 0 : -1; });
    panel.setAttribute('aria-labelledby', button.id);
    panel.innerHTML = content(button);
  };
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', event => {
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) { event.preventDefault(); select(next); next.focus(); }
    });
  });
}
const reminders = $('community-panel').innerHTML;
wireTabs('[data-community]', 'community-panel', button => button.dataset.community === 'reminders' ? reminders : `
  <div class="ranking-head"><span>ILLUSTRATIVE RESULTS</span><span>BENGALURU / 5 KM</span></div>
  <div class="rank-row"><span>01</span><span>Sample runner A</span><strong>24:18</strong></div>
  <div class="rank-row"><span>02</span><span>Sample runner B</span><strong>25:06</strong></div>
  <div class="rank-row"><span>03</span><span>Sample runner C</span><strong>26:42</strong></div>
  <p class="results-foot">Your city. Your distance category. Ranked by finish time. View the actual published results in Cadra.</p>`);
const clubPosts = $('club-panel').innerHTML;
const clubContent = {
  posts: clubPosts,
  members: `<div class="club-panel-copy"><span class="mono">SAMPLE CLUB / MEMBERS</span><h3>A familiar face.<br>A new running mate.</h3><div class="member-pills" aria-label="Illustrative member initials"><span>AK</span><span>SM</span><span>RJ</span><span>PN</span></div><p>Bring your club together in one group. Members can keep up with club posts and connect through Cadra.</p><span class="notice-label">ILLUSTRATIVE MEMBERS · NOT REAL ACCOUNTS</span></div>`,
  requests: `<div class="club-panel-copy"><span class="mono">TWO WAYS TO JOIN</span><h3>Make your way in.</h3><p>Runners can request membership. Clubs can invite members and manage the requests that come in.</p><div class="request-flow"><span>REQUEST</span><b aria-hidden="true">↗</b><span>CLUB GROUP</span><b aria-hidden="true">↖</b><span>INVITE</span></div><span class="notice-label">JOIN AND MANAGE YOUR CLUB IN THE APP</span></div>`
};
wireTabs('[data-club]', 'club-panel', button => clubContent[button.dataset.club]);
const conversations = {
  race: ['Same distance tomorrow?', 'Same distance. Faster finish.', 'That sounds like a challenge.'],
  club: ['New to the club. Where do I start?', 'Check the latest post. Come run with us.', 'Perfect. See you at the start!']
};
document.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-chat]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('chat-messages').replaceChildren(...conversations[button.dataset.chat].map((text, index) => {
    const bubble = document.createElement('p'); bubble.className = index === 1 ? 'bubble reply' : 'bubble'; bubble.textContent = text; return bubble;
  }));
}));

const deletionModal = $('deletion-modal');
$('delete-open').addEventListener('click', () => { $('deletion-result').textContent = ''; deletionModal.showModal(); });
$('delete-close').addEventListener('click', () => deletionModal.close());
deletionModal.addEventListener('click', event => {
  if (event.target !== deletionModal) return;
  const box = deletionModal.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) deletionModal.close();
});
$('deletion-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('registered-email').value.trim(), extra = $('deletion-extra').value.trim();
  const body = `Hello Cadra support,\n\nI request deletion of my Cadra account and associated data.\nRegistered email: ${email}\n\n${extra ? `Additional information: ${extra}\n\n` : ''}Please let me know how to verify account ownership.\n`;
  $('deletion-result').textContent = 'Your email app should open. Send the email to complete your request. This website has not submitted a request.';
  window.location.href = `mailto:milindmylarappa@cadrarunning.com?subject=${encodeURIComponent('Cadra account deletion')}&body=${encodeURIComponent(body)}`;
});
$('year').textContent = new Date().getFullYear();

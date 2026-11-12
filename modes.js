(() => {
  if (customElements.get("cadra-modes")) return;

  const tabIcons = {
    community: '<path d="M2 17c0-3.3 2.2-5.1 5.5-5.1s5.5 1.8 5.5 5.1M13 12c3.8-.7 6 1.3 6 4.7"/><circle cx="7.5" cy="6.8" r="2.8"/><path d="M13.2 4.4a2.6 2.6 0 1 1 0 4.7"/>',
    ghost: '<path d="M4 16V9a6 6 0 1 1 12 0v7l-2.2-1.7-2 1.7-2-1.7-2 1.7-2-1.7L4 16Z"/><path d="M8 8.2v1M12 8.2v1"/>',
    sessions: '<path d="M2 16.2h16M3 13V9h2.4v4M7 13V6h2.4v7M11 13V3h2.4v10M15 13V8h2.4v5"/>'
  };

  const modes = [
    {
      id: 'community', name: 'Community Run', title: 'Your city at the starting line.',
      body: 'Join a scheduled community run in a supported city. Pick your distance, start with the field, and see where you finished among runners in your city and distance division.',
      control: 'Try a distance', options: ['5K','10K','15K','21K']
    },
    {
      id: 'ghost', name: 'Race a Ghost', title: 'Catch the run that got away.',
      body: 'Pick a saved run of your own or an eligible public activity. Race the same distance against its recorded effort, then compare the splits to see where you gained time.',
      control: 'Compare a checkpoint', options: ['1 km','3 km','5 km']
    },
    {
      id: 'sessions', name: 'Structured runs', title: 'Give the run a plan.',
      body: 'Set up an easy run, a tempo effort, intervals, or a gradual build. Cadra breaks the session into stages, with cues to help you change effort on time.',
      control: 'Explore a session', options: ['Easy','Intervals','Progression']
    }
  ];

  const ghostSplits = [
    {km:1, current:299, ghost:296},
    {km:3, current:882, ghost:892},
    {km:5, current:1453, ghost:1472}
  ];
  const intervalStages = [
    {duration:10, effort:32, label:'Warm-up'},
    ...Array.from({length:6}, () => [
      {duration:1, effort:91, label:'Work'}, {duration:2, effort:37, label:'Recover'}
    ]).flat(),
    {duration:5, effort:25, label:'Cool-down'}
  ];
  const sessions = [
    {name:'Easy', description:'One continuous, conversational effort.', stages:[{duration:30, effort:45, label:'Easy'}]},
    {name:'Intervals', description:'10 min warm-up • 6 × (1 min work + 2 min recovery) • 5 min cool-down.', stages:intervalStages},
    {name:'Progression', description:'10 min easy • 10 min steady • 10 min stronger.', stages:[
      {duration:10, effort:32, label:'Easy'},{duration:10, effort:55, label:'Steady'},{duration:10, effort:85, label:'Stronger'}
    ]}
  ];
  const barcode = '21113112231113211312113223111232121131121331';
  const bibBars = Array.from(barcode, (width, i) => '<i style="flex:' + width + ';background:' + (i%2?'transparent':'currentColor') + '"></i>').join('');
  const time = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');

  function bib(index) {
    const distance = ['05','10','15','21'][index];
    return `<div class="cm-stage cm-community">
      <div class="cm-rings" aria-hidden="true"></div>
      <div class="cm-bib">
        <div class="cm-bib-main">
          <div class="cm-bib-caption"><span class="cm-square" aria-hidden="true"></span> Community Run</div>
          <div class="cm-distance" aria-label="${Number(distance)} kilometres">${distance}<span>K</span></div>
          <div class="cm-bib-city"><span class="cm-city-mark" aria-hidden="true">↗</span> Bengaluru</div>
        </div>
        <div class="cm-stub" aria-hidden="true"><span>BLR / ${distance}K</span><div class="cm-barcode">${bibBars}</div><b>CADRA</b></div>
      </div>
      <span class="cm-stage-note">Sample race bib</span>
    </div>`;
  }

  function ghost(index) {
    const split = ghostSplits[index];
    const gap = Math.abs(split.ghost - split.current);
    const leader = split.current < split.ghost ? 'ahead' : 'behind';
    const checkpoints = [86,253,420];
    const baseline = 90;
    const points = {
      runner: ghostSplits.map(entry => baseline - (entry.ghost - entry.current) * 2.3),
      ghost: ghostSplits.map(() => baseline)
    };
    const path = (values) => values.map((y,i) => (i===0?'M':'L') + checkpoints[i] + ' ' + y).join(' ');
    return `<div class="cm-stage cm-ghost">
      <div class="cm-ghost-sheet">
        <div class="cm-card-cap"><span>Ghost comparison</span><span>Sample 5K</span></div>
        <div class="cm-ghost-lead"><span>${gap}<i>s</i></span><b>${leader}<small>at kilometre ${split.km}</small></b></div>
        <svg class="cm-ghost-plot" viewBox="30 30 445 100" aria-hidden="true">
          <path d="M37 55H459M37 80H459M37 105H459" stroke="currentColor" opacity=".16" fill="none"/>
          <path d="M${checkpoints[index]} 32V119" stroke="currentColor" stroke-dasharray="2 4" opacity=".55"/>
          <path d="${path(points.ghost)}" stroke="#a29fbe" fill="none" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>
          <path d="${path(points.runner)}" stroke="#311b5b" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${checkpoints[index]}" cy="${points.ghost[index]}" r="4.8" fill="#a29fbe" stroke="#f5f3ff" stroke-width="2"/>
          <circle cx="${checkpoints[index]}" cy="${points.runner[index]}" r="6" fill="#311b5b" stroke="#f5f3ff" stroke-width="2"/>
        </svg>
        <div class="cm-plot-ticks"><span>1 km</span><span>3 km</span><span>5 km</span></div>
        <div class="cm-ghost-key"><span><i></i>You <strong>${time(split.current)}</strong></span><span><i></i>Ghost <strong>${time(split.ghost)}</strong></span></div>
      </div>
    </div>`;
  }

  function session(index) {
    const plan = sessions[index];
    const total = plan.stages.reduce((sum,stage) => sum + stage.duration, 0);
    const blocks = plan.stages.map(stage => `<span title="${stage.label}, ${stage.duration} min" style="flex:${stage.duration};height:${stage.effort}%"></span>`).join('');
    return `<div class="cm-stage cm-work">
      <div class="cm-work-sheet">
        <div class="cm-card-cap"><span>Session plan</span><span>Example workout</span></div>
        <div class="cm-work-title"><strong>${plan.name}</strong><span>${total}<small> min</small></span></div>
        <div class="cm-work-plot" aria-hidden="true">${blocks}</div>
        <div class="cm-work-axis"><span>Start</span><span>${total} min</span></div>
        <p>${plan.description}</p>
      </div>
    </div>`;
  }

  const art = [bib, ghost, session];
  let instanceCount = 0;
  class CadraModes extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.uid = 'cadra-modes-' + (++instanceCount);
      this.mode = 0;
      this.optionsByMode = [0,1,1];
      this.innerHTML = `<div class="cm-tabs" role="tablist" aria-label="Run modes">${modes.map((mode,i) => `
        <button type="button" role="tab" id="${this.uid}-t${i}" aria-controls="${this.uid}-p${i}" data-mode="${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">
          <svg viewBox="0 0 20 20" aria-hidden="true">${tabIcons[mode.id]}</svg>
          <span>${mode.name}</span>
        </button>`).join('')}</div>
        ${modes.map((mode,i) => `<div class="cm-panel" id="${this.uid}-p${i}" role="tabpanel" aria-labelledby="${this.uid}-t${i}" ${i===0?'':'hidden'}>
          <div class="cm-copy">
            <h3>${mode.title}</h3>
            <p>${mode.body}</p>
            <div class="cm-control" role="group" aria-labelledby="${this.uid}-choice${i}">
              <span id="${this.uid}-choice${i}">${mode.control}</span>
              <div>${mode.options.map((option,n) => `<button type="button" data-option="${n}" aria-pressed="${this.optionsByMode[i]===n}">${option}</button>`).join('')}</div>
            </div>
          </div>
          <div class="cm-art" aria-live="polite" aria-atomic="true">${art[i](this.optionsByMode[i])}</div>
        </div>`).join('')}`;

      this.addEventListener('click', event => {
        const control = event.target.closest('button');
        if (!control || !this.contains(control)) return;
        if (control.hasAttribute('data-mode')) this.selectMode(Number(control.dataset.mode));
        if (control.hasAttribute('data-option')) this.selectOption(Number(control.dataset.option));
      });

      this.addEventListener('keydown', event => {
        if (!event.target.matches('[role="tab"]')) return;
        const direction = {ArrowLeft:-1, ArrowRight:1}[event.key];
        if (!direction && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : (this.mode + direction + modes.length) % modes.length;
        this.selectMode(target);
        this.querySelector('[data-mode="' + target + '"]').focus();
      });
    }

    selectMode(mode) {
      this.mode = mode;
      this.querySelectorAll('[data-mode]').forEach((tab,i) => {
        tab.setAttribute('aria-selected', String(i===mode));
        tab.tabIndex = i===mode ? 0 : -1;
      });
      this.querySelectorAll('[role="tabpanel"]').forEach((panel,i) => { panel.hidden = i !== mode; });
    }

    selectOption(option) {
      if (this.optionsByMode[this.mode] === option) return;
      this.optionsByMode[this.mode] = option;
      const panel = this.querySelector('[role="tabpanel"]:not([hidden])');
      panel.querySelectorAll('[data-option]').forEach((button,i) => button.setAttribute('aria-pressed', String(i === option)));
      panel.querySelector('.cm-art').innerHTML = art[this.mode](option);
    }
  }
  customElements.define('cadra-modes', CadraModes);
})();

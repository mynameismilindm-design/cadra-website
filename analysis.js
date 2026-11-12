(() => {
  if (!window.customElements || customElements.get('cadra-analysis')) return;

  // Each sample is the average pace, in seconds/km, for an equal 100 m segment.
  // The graph, splits and totals below all use this same fictional 5 km run.
  const segments = [
    [343, 335, 339, 331, 326, 332, 324, 330, 327, 323],
    [325, 320, 328, 323, 317, 321, 313, 317, 311, 315],
    [318, 325, 319, 312, 308, 314, 306, 309, 302, 307],
    [304, 310, 316, 321, 315, 319, 311, 316, 312, 309],
    [312, 306, 310, 303, 297, 302, 295, 300, 291, 287],
  ];
  const sum = values => values.reduce((total, value) => total + value, 0);
  const splits = segments.map(row => sum(row) / row.length);
  const totalSeconds = sum(splits);
  const averagePace = totalSeconds / splits.length;
  const formatTime = seconds => {
    const rounded = Math.round(seconds);
    return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
  };

  const plot = { left: 39, right: 516, top: 12, bottom: 140, fastest: 280, slowest: 350 };
  const x = km => plot.left + km / splits.length * (plot.right - plot.left);
  const y = seconds => plot.top + (seconds - plot.fastest) / (plot.slowest - plot.fastest) * (plot.bottom - plot.top);
  const points = segments.flat().map((seconds, index) => [x((index + 0.5) / 10), y(seconds)]);
  const pathData = points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ');
  const areaData = `${pathData} L${points.at(-1)[0]},${plot.bottom} L${points[0][0]},${plot.bottom} Z`;
  let count = 0;

  class CadraAnalysis extends HTMLElement {
    connectedCallback() {
      this.events?.abort();
      this.events = new AbortController();
      const { signal } = this.events;
      this.selected = this.selected ?? 2;
      const id = `cadra-pace-${++count}`;
      this.innerHTML = `
        <figure class="ca-panel" aria-label="Interactive sample 5 kilometre run analysis">
          <figcaption class="ca-caption"><span class="ca-series"><span aria-hidden="true"></span>Pace analysis</span><span>Sample run · 5 km</span></figcaption>
          <div class="ca-readout">
            <div><div class="ca-label" data-ca-label></div><p class="ca-pace"><span data-ca-pace></span><span class="ca-unit">/km</span></p><p class="ca-elapsed" data-ca-elapsed></p></div>
            <dl class="ca-totals"><div><dt>Total time</dt><dd>${formatTime(totalSeconds)}</dd></div><div><dt>Avg pace</dt><dd>${formatTime(averagePace)}<small>/km</small></dd></div></dl>
          </div>
          <svg class="ca-chart" viewBox="0 0 520 149" aria-labelledby="${id}-title ${id}-desc" role="img">
            <title id="${id}-title">Pace by distance</title>
            <desc id="${id}-desc">Example pace for each 100 metres. Higher points are faster. The shaded vertical band marks the selected kilometre. Select a split below for its average pace.</desc>
            <defs><linearGradient id="${id}-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5cb6a6" stop-opacity=".33"/><stop offset="100%" stop-color="#5cb6a6" stop-opacity=".04"/></linearGradient></defs>
            <rect data-ca-band y="${plot.top}" height="${plot.bottom - plot.top}" width="${x(1) - x(0)}" class="ca-band"/>
            ${[285, 305, 325, 345].map(pace => `<line class="ca-grid" x1="${plot.left}" x2="${plot.right}" y1="${y(pace)}" y2="${y(pace)}"/><text class="ca-axis-label" text-anchor="end" x="31" y="${y(pace) + 3}">${formatTime(pace)}</text>`).join('')}
            ${splits.map((_, index) => `<line class="ca-grid ca-grid-vertical" x1="${x(index + 1)}" x2="${x(index + 1)}" y1="${plot.top}" y2="${plot.bottom}"/>`).join('')}
            <path d="${areaData}" fill="url(#${id}-fill)"/>
            <path class="ca-line" d="${pathData}"/>
            <line class="ca-split-line" data-ca-avg/><circle class="ca-point" data-ca-point r="4"/>
          </svg>
          <div class="ca-splits" role="group" aria-label="Select a kilometre to inspect">
            ${splits.map((pace, index) => `<button type="button" data-ca-index="${index}" aria-label="Kilometre ${index + 1}, split pace ${formatTime(pace)} per kilometre"><span>KM ${String(index + 1).padStart(2, '0')}</span><strong>${formatTime(pace)}</strong></button>`).join('')}
          </div>
          <p class="ca-sr" data-ca-status role="status"></p>
        </figure>`;
      this.chart = this.querySelector('.ca-chart');
      this.buttons = [...this.querySelectorAll('[data-ca-index]')];
      this.buttons.forEach((button, index) => {
        button.addEventListener('click', () => this.selectSplit(index, true), { signal });
        button.addEventListener('keydown', event => {
          const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: splits.length - 1 }[event.key];
          if (next === undefined) return;
          event.preventDefault();
          const target = Math.max(0, Math.min(splits.length - 1, next));
          this.selectSplit(target, true);
          this.buttons[target].focus();
        }, { signal });
      });
      const pointToSplit = event => {
        const transform = this.chart.getScreenCTM();
        if (!transform) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
        if (point.x < plot.left || point.x > plot.right) return;
        const index = Math.floor((point.x - plot.left) / (plot.right - plot.left) * splits.length);
        this.selectSplit(Math.min(splits.length - 1, index));
      };
      this.chart.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse') pointToSplit(event);
      }, { signal });
      this.chart.addEventListener('click', pointToSplit, { signal });
      this.selectSplit(this.selected);
    }

    disconnectedCallback() { this.events?.abort(); }

    selectSplit(index, announce = false) {
      this.selected = index;
      const pace = formatTime(splits[index]);
      const elapsed = formatTime(sum(splits.slice(0, index + 1)));
      this.querySelector('[data-ca-label]').textContent = `Kilometre ${index + 1} pace`;
      this.querySelector('[data-ca-pace]').textContent = pace;
      this.querySelector('[data-ca-elapsed]').textContent = `${elapsed} elapsed`;
      this.querySelector('[data-ca-band]').setAttribute('x', x(index));
      const mean = this.querySelector('[data-ca-avg]');
      mean.setAttribute('x1', x(index));
      mean.setAttribute('x2', x(index + 1));
      mean.setAttribute('y1', y(splits[index]));
      mean.setAttribute('y2', y(splits[index]));
      const point = this.querySelector('[data-ca-point]');
      point.setAttribute('cx', x(index + .5));
      point.setAttribute('cy', y(splits[index]));
      this.buttons.forEach((button, which) => button.setAttribute('aria-pressed', String(which === index)));
      if (announce) this.querySelector('[data-ca-status]').textContent = `Kilometre ${index + 1} averaged ${pace} per kilometre, with ${elapsed} elapsed.`;
    }
  }
  customElements.define('cadra-analysis', CadraAnalysis);
})();

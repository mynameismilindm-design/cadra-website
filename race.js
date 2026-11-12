/* Two schematic routes, one shared race clock. All data in this demo is illustrative. */
(() => {
  'use strict';
  if (!window.customElements || customElements.get('cadra-race')) return;
  let serial = 0;
  const C = { blue: '#a2e8ea', lime: '#c1fb76' };
  const splits = [[0,0,0],[480,1.38,1.40],[960,2.83,2.89],[1100,3.29,3.33],[1250,3.79,3.72],[1460,4.32,4.35],[1560,4.62,4.67],[1665,5,4.94]];
  const checkpoint = 960, finish = 1665, replayTime = 16500;
  const plane = {lon:[.98,-.212,.63,.406,129,91],blr:[.98,-.212,.63,.406,40,226]};
  const paths = {
    lon:[[21,167],[64,180],[81,156],[52,133],[73,103],[123,110],[134,140],[154,145],[179,118],[168,91],[183,74],[215,64],[240,81],[262,61],[291,54],[318,66],[302,84],[268,96],[256,122],[219,129],[198,155],[175,169]],
    blr:[[20,171],[53,158],[75,165],[98,132],[88,109],[97,76],[128,67],[149,41],[181,42],[200,60],[193,83],[221,86],[248,64],[283,72],[305,94],[293,121],[261,136],[244,126],[224,143],[190,156],[177,174],[153,177]]
  };
  const num = n => +n.toFixed(2);
  const project = (point, matrix) => [num(point[0]*matrix[0]+point[1]*matrix[2]+matrix[4]),num(point[0]*matrix[1]+point[1]*matrix[3]+matrix[5])];
  const pstr = p => p.join(' ');
  const clock = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const corners=[[0,0],[344,0],[344,214],[0,214]];
  const roundRoute = points => {
    let d=`M${pstr(points[0])}`;
    for(let i=1;i<points.length-1;i++){
      const [x,y]=points[i],a=points[i-1],b=points[i+1];
      const q=(pt)=>[num(x+(pt[0]-x)*.19),num(y+(pt[1]-y)*.19)];
      d+=`L${pstr(q(a))}Q${x} ${y} ${pstr(q(b))}`;
    }
    return `${d}L${pstr(points.at(-1))}`;
  };
  const sample = time => {
    const idx=splits.findIndex(s=>s[0]>=time);
    if(idx<=0)return [0,0];
    const lo=splits[idx-1],hi=splits[idx],t=(time-lo[0])/(hi[0]-lo[0]);
    return [1,2].map(i=>lo[i]+(hi[i]-lo[i])*t);
  };
  // Marching-square contours create two different continuous relief maps.
  function contours(mode){
    const w=344,h=214,step=7,cols=Math.ceil(w/step)+1,rows=Math.ceil(h/step)+1;
    const field=(x,y)=>mode==='lon'
      ? .7*Math.sin(x*.024+y*.044)+.55*Math.sin(x*.015-y*.047)+.54*Math.cos((x-y)*.026)+.42*Math.sin(y*.047+.8*Math.sin(x*.015))
      : .62*Math.sin(x*.028+y*.031)+.68*Math.cos(x*.012-y*.039)+.45*Math.sin((x+y)*.018)+.55*Math.cos(y*.041+.9*Math.sin(x*.023));
    const values=Array.from({length:rows},(_,j)=>Array.from({length:cols},(_,i)=>field(i*step,j*step)));
    const lines=[];
    for(let l=-15;l<=15;l++){
      const threshold=l*.125;let d='';
      for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){
        const v=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]];
        const c=[[i*step,j*step],[(i+1)*step,j*step],[(i+1)*step,(j+1)*step],[i*step,(j+1)*step]],p=[];
        for(let e=0;e<4;e++){
          const n=(e+1)%4;if((v[e]>=threshold)===(v[n]>=threshold))continue;
          const t=(threshold-v[e])/(v[n]-v[e]);p.push([num(c[e][0]+(c[n][0]-c[e][0])*t),num(c[e][1]+(c[n][1]-c[e][1])*t)]);
        }
        if(p.length>=2)d+=`M${pstr(p[0])}L${pstr(p[1])}`;
        if(p.length===4)d+=`M${pstr(p[2])}L${pstr(p[3])}`;
      }
      lines.push(`<path d="${d}" stroke-width="${l%4===0?1.12:.62}"/>`);
    }
    return lines.join('');
  }
  const land={lon:null,blr:null};
  function cityStreets(city){
    const dr=city==='lon'?1:-1;let lines='';
    for(let j=-3;j<13;j++){
      const y=j*22;
      lines+=`M-50 ${y}q75 ${dr*19} 135 ${dr*7}t142 ${dr*5}t160 ${dr*11}`;
    }
    for(let i=-2;i<17;i++){
      const x=i*25;
      lines+=`M${x} -25q${dr*21} 58 ${dr*14} 96t${dr*7} 92t${dr*15} 95`;
    }
    return lines;
  }
  function plate(key,uid){
    if(!land[key])land[key]=contours(key);
    const lon=key==='lon',m=plane[key],color=lon?C.blue:C.lime;
    const ps=corners.map(p=>project(p,m)),points=ps.map(pstr).join(', ');
    const lowered=ps.map(([x,y])=>[x,y+6]);
    const side=[ps[1],ps[2],ps[3],lowered[3],lowered[2],lowered[1]].map(pstr).join(', ');
    const d=roundRoute(paths[key].map(p=>project(p,m))),end=project(paths[key].at(-1),m),start=project(paths[key][0],m);
    const water=lon?'M-27 68C31 45 59 56 73 69S111 94 128 89S161 49 184 42S217 40 237 54S273 84 300 76S341 53 373 46':'M-20 194Q58 189 71 177T109 162Q143 160 158 141T213 106Q247 102 261 77T299 27Q325 25 371 1';
    return `<g class="cr-plate"><polygon points="${side}" fill="${lon?'#182e28':'#213726'}" stroke="${color}" stroke-opacity=".22" stroke-width=".8"/><polygon points="${points}" fill="url(#${uid}-${key}-land)" stroke="${color}" stroke-opacity=".64" stroke-width=".85"/><g transform="matrix(${m.join(' ')})"><g clip-path="url(#${uid}-tile)"><g fill="none" stroke="${color}" opacity="${lon?'.34':'.37'}">${land[key]}</g><path d="${cityStreets(key)}" fill="none" stroke="${color}" stroke-width=".65" opacity=".20"/><path d="${water}" fill="none" stroke="${lon?'#9cbec1':'#a6c99c'}" opacity=".18" stroke-width="${lon?9:5}"/><path d="${water}" fill="none" stroke="#233d30" opacity=".65" stroke-width="${lon?6.7:3.4}"/><rect x="7" y="7" width="330" height="200" fill="none" stroke="${color}" opacity=".22" stroke-width=".8" stroke-dasharray="3 7"/></g></g><path d="${d}" fill="none" stroke="#041208" stroke-width="5.4" stroke-opacity=".7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-opacity=".82" stroke-width="1.7" stroke-dasharray="3.2 4.2" stroke-linecap="round"/><path data-route="${key}" d="${d}" fill="none" stroke="${color}" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="2.5" fill="#12291e" stroke="${color}" stroke-width="1.2"/><g transform="translate(${end[0]} ${end[1]})" stroke="${color}"><path d="M0 1v-10m.5 0h7l-2 2.5 2 2.5h-6.8" stroke-width="1.3" fill="#203728"/></g></g>`;
  }
  const controls={play:'<path d="m6 3 9 6-9 6z" fill="currentColor"/>',pause:'<path d="M5 3h3v12H5zM11 3h3v12h-3z" fill="currentColor"/>',replay:'<path d="M3.5 8A6 6 0 1 1 5.1 13M3.5 3.8v4.5H8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"/>'};
  function marker(city,color){
    const diamond=city==='lon';
    return `<g data-mark="${city}" color="${color}"><circle r="10" fill="currentColor" opacity=".1"/><circle r="7" fill="none" stroke="currentColor" stroke-width=".8" opacity=".68"/>${diamond?'<path d="m0 -4.2 4.2 4.2L0 4.2 -4.2 0z"':'<circle r="3.7"'} fill="currentColor" stroke="#16261c" stroke-width="1"/></g>`;
  }
  function graphic(uid){return `<svg class="cr-map" viewBox="0 0 640 335" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><defs><clipPath id="${uid}-tile"><rect width="344" height="214"/></clipPath><linearGradient id="${uid}-lon-land" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#223e34"/><stop offset="1" stop-color="#172e28"/></linearGradient><linearGradient id="${uid}-blr-land" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#2c492e"/><stop offset="1" stop-color="#193221"/></linearGradient></defs><g stroke="#a0c5a7" opacity=".22" fill="none" stroke-width=".8" stroke-dasharray="1.5 5.5"><path d="M158 100l-83 127m485-127-72 118M276 173l-63 119"/></g>${plate('lon',uid)}${plate('blr',uid)}<g fill="none" stroke="#7da196" stroke-width=".8"><path d="M25 62h72l47 30"/><path d="M456 260l42 22h115"/></g><g class="cr-map-label"><text x="25" y="52" fill="${C.blue}">B / LONDON</text><text x="612" y="302" fill="${C.lime}" text-anchor="end">A / BENGALURU</text></g>${marker('lon',C.blue)}${marker('blr',C.lime)}<g stroke="#94ac9b" fill="none" stroke-width=".8" opacity=".65"><path d="M29 266v19m-4-14 4-6 4 6M25 286h8"/><path d="M558 21h51m-51-3v6m17-6v6m17-6v6m17-6v6"/></g><g class="cr-map-minor" fill="#a4b9a8"><text x="29" y="258" text-anchor="middle">N</text><text x="610" y="12" text-anchor="end">SCHEMATIC ROUTES</text></g></svg>`;}
  class CadraRace extends HTMLElement {
    connectedCallback(){
      if(this._ready)return;
      this._ready=true;const uid=`cadra-duo-${++serial}`;this.uid=uid;
      this.innerHTML=`<section class="cr-widget" aria-label="Illustrative five kilometre head-to-head race"><div class="cr-head"><span class="cr-id"><i aria-hidden="true"><b></b><b></b><b></b></i>Duo race monitor</span><span class="cr-tag">5 km <i></i> sample race</span></div><div class="cr-scene">${graphic(uid)}</div><div class="cr-board"><div class="cr-scores">${[['blr','Bengaluru','A'],['lon','London','B']].map(([key,name,id])=>`<div class="cr-score cr-${key}"><span class="cr-city"><i aria-hidden="true">${id}</i>${name}</span><div class="cr-readout"><strong data-km="${key}">—</strong><span>km</span></div><span class="cr-pace">Avg. <b data-pace="${key}">—</b> /km</span></div>`).join('')}</div><div class="cr-timeline"><div class="cr-controls"><button class="cr-play" type="button" aria-label="Play the sample race from the 16 minute checkpoint"><svg data-icon viewBox="0 0 18 18" aria-hidden="true">${controls.play}</svg><span data-action>Play finish</span></button><span class="cr-gap" data-gap>London leads by 60 m</span></div><div class="cr-scrub"><label for="${uid}-time">Race clock</label><input type="range" id="${uid}-time" min="${checkpoint}" max="${finish}" value="${checkpoint}" step="1" aria-label="Scrub the sample race clock"><output data-clock aria-live="off" for="${uid}-time">16:00</output></div></div></div><span class="cr-sr" data-speak role="status" aria-live="polite"></span></section>`;
      const q=(sel)=>this.querySelector(sel);
      this.el={widget:q('.cr-widget'),button:q('.cr-play'),action:q('[data-action]'),icon:q('[data-icon]'),gap:q('[data-gap]'),range:q('input'),clock:q('[data-clock]'),speak:q('[data-speak]')};
      this.routes=['blr','lon'].map(key=>{const path=q(`[data-route="${key}"]`);const length=path.getTotalLength();return {path,length,marker:q(`[data-mark="${key}"]`),km:q(`[data-km="${key}"]`),pace:q(`[data-pace="${key}"]`)};});
      this.t=checkpoint;this.playing=false;this.raf=0;
      this.el.button.addEventListener('click',()=>this.toggle());
      this.el.range.addEventListener('input',()=>{this.stop();this.t=Number(this.el.range.value);this.paint();});
      this.el.range.addEventListener('change',()=>this.announce());
      this._motion=window.matchMedia('(prefers-reduced-motion: reduce)');
      this._reduce=()=>{if(this._motion.matches&&this.playing){this.stop();this.paint();}};
      this._motion.addEventListener('change',this._reduce);
      this._visibility=()=>{if(document.hidden&&this.playing){this.stop();this.paint();}};
      document.addEventListener('visibilitychange',this._visibility);
      this.paint();
    }
    disconnectedCallback(){this.stop();this._motion?.removeEventListener('change',this._reduce);document.removeEventListener('visibilitychange',this._visibility);this._ready=false;}
    stop(){cancelAnimationFrame(this.raf);this.playing=false;}
    toggle(){
      if(this.playing){this.stop();this.paint();this.announce();return;}
      if(this.t>=finish){this.t=checkpoint;this.paint();if(this._motion.matches){this.announce();return;}}
      if(this._motion.matches){this.t=finish;this.paint();this.announce();return;}
      this.playing=true;this.paint();const initial=this.t,start=performance.now();let previous=0;
      const tick=now=>{if(!this.playing)return;this.t=Math.min(finish,initial+(now-start)*(finish-checkpoint)/replayTime);if(now-previous>40||this.t>=finish){this.paint();previous=now;}if(this.t>=finish){this.stop();this.paint();this.announce();}else{this.raf=requestAnimationFrame(tick);}};
      this.raf=requestAnimationFrame(tick);
    }
    announce(){this.el.speak.textContent=`${clock(this.t)}. ${this.el.gap.textContent}.`;}
    paint(){
      const values=sample(this.t);const finished=this.t>=finish;
      this.routes.forEach((r,i)=>{const dist=values[i],progress=r.length*dist/5,point=r.path.getPointAtLength(progress);r.path.setAttribute('stroke-dasharray',`${progress.toFixed(2)} ${(r.length+2).toFixed(2)}`);r.marker.setAttribute('transform',`translate(${point.x.toFixed(2)},${point.y.toFixed(2)})`);r.km.textContent=dist.toFixed(2);r.pace.textContent=clock(Math.round(this.t/dist));});
      const metres=Math.round(Math.abs(values[0]-values[1])*1000),leader=values[0]>=values[1]?'Bengaluru':'London';
      this.el.gap.textContent=finished?'Winner: Bengaluru':metres<2?'Level on distance':`${leader} leads by ${metres} m`;
      this.el.clock.value=clock(this.t);this.el.clock.textContent=clock(this.t);this.el.range.value=Math.round(this.t);this.el.range.style.setProperty('--cr-progress',`${(this.t-checkpoint)/(finish-checkpoint)*100}%`);this.el.range.setAttribute('aria-valuetext',`${Math.floor(this.t/60)} minutes, ${Math.floor(this.t%60)} seconds. ${this.el.gap.textContent}.`);
      const state=finished?'replay':this.playing?'pause':'play';const previous=this.el.widget.dataset.state;
      this.el.widget.dataset.state=state;
      if(previous!==state)this.el.icon.innerHTML=controls[state];
      const label=finished?(this._motion?.matches?'Reset demo':'Replay finish'):this.playing?'Pause':this._motion?.matches?'Show finish':this.t>checkpoint?'Resume':'Play finish';this.el.action.textContent=label;this.el.button.setAttribute('aria-label',`${label} · illustrative 5 km race`);
    }
  }
  customElements.define('cadra-race',CadraRace);
})();

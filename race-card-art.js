/* Cadra Duo / illustrated race invitation. Pure Canvas 2D; no asset reads or requests. */
(function (root) {
  'use strict';
  const W = 1080, H = 1350, LEFT = 56, RIGHT = W - LEFT;
  const DISPLAY = '"Space Grotesk", "Arial", sans-serif';
  const MONO = '"JetBrains Mono", "SFMono-Regular", "Consolas", monospace';
  const THEMES = {
    lime: { field:'#C8F36B', ink:'#122A20', fieldFine:'#4D683D', dark:'#111C17', rail:'#ECFADE', paper:'#F1F1E7', paperInk:'#18251D', paperLine:'#A4AAA0', a:'#153629', aEdge:'#0C2118', aLane:'#9EBE71', aMark:'#E4F4CA', b:'#F0F5DC', bEdge:'#273E2A', bLane:'#83A173', bMark:'#203627', shade:'#6F924B', shade2:'#9FB85F' },
    night: { field:'#16291F', ink:'#ECF1DB', fieldFine:'#6E8C71', dark:'#0A1712', rail:'#C9F775', paper:'#18291F', paperInk:'#F0F2E6', paperLine:'#526551', a:'#C4F66D', aEdge:'#9CD258', aLane:'#648B40', aMark:'#1B321D', b:'#9DDDE2', bEdge:'#7FADAD', bLane:'#578D89', bMark:'#1F4744', shade:'#0C1912', shade2:'#172E20' }
  };
  const clean = (v,fallback) => String(v == null ? '' : v).replace(/[\t\r\n\u2028\u2029]/gu,' ').trim() || fallback;
  function label(ctx, text, x, y, size, color, align='left') {
    ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.font=`400 ${size}px ${MONO}`;ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  function rule(ctx,x1,y1,x2,y2,color,thick=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=thick;ctx.stroke();}
  function polygon(ctx,pts,fill){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  const p=(x,y)=>[x,y];
  function splines(start, segments) {
    const out=[];let a=start;
    for(const [s,arr] of segments.entries()){
      const [b,c,d]=arr;
      for(let i=s===0?0:1;i<=90;i++){
        const t=i/90, u=1-t;
        const x=u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0];
        const y=u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1];
        let dx=u*u*(b[0]-a[0])+2*u*t*(c[0]-b[0])+t*t*(d[0]-c[0]);
        let dy=u*u*(b[1]-a[1])+2*u*t*(c[1]-b[1])+t*t*(d[1]-c[1]);
        let len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
        out.push({x,y,nx:-dy,ny:dx,dx,dy});
      }a=d;
    }
    return out;
  }
  // The tracks are continuous drawn paths. Alternating their over/under order at the two crossings makes a woven race mark.
  const A=splines(p(-182,891),[[p(63,910),p(206,467),p(427,447)],[p(621,430),p(604,699),p(850,667)],[p(1030,644),p(1120,460),p(1276,451)]]);
  const B=splines(p(-176,448),[[p(64,450),p(148,765),p(396,768)],[p(615,772),p(697,550),p(899,444)],[p(1068,356),p(1175,338),p(1266,353)]]);
  function widthAt(i,n,base){return base*(.9+.12*Math.sin(Math.PI*i/(n-1))+.075*Math.sin(2*Math.PI*i/(n-1)-.7));}
  const edge=(point,w,side,ox,oy)=>[point.x+point.nx*w*side+ox,point.y+point.ny*w*side+oy];
  function strip(ctx,path,base,left,right,ox,oy,col){
    const n=path.length;ctx.beginPath();
    for(let i=0;i<n;i++){const pt=edge(path[i],widthAt(i,n,base),left,ox,oy);if(!i)ctx.moveTo(...pt);else ctx.lineTo(...pt);}
    for(let i=n-1;i>=0;i--){const pt=edge(path[i],widthAt(i,n,base),right,ox,oy);ctx.lineTo(...pt);}
    ctx.closePath();ctx.fillStyle=col;ctx.fill();
  }
  function lane(ctx,path,base,fraction,col,lw){ctx.beginPath();for(let i=0;i<path.length;i++){const pt=edge(path[i],widthAt(i,path.length,base),fraction,0,0);if(!i)ctx.moveTo(...pt);else ctx.lineTo(...pt);}ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke();}
  function ribbon(ctx,path,base,colors,markerKey){
    // Solid offset edge gives a pressed-paper depth without a blurry web-style shadow.
    strip(ctx,path,base,-1.02,1.02,0,9,colors.edge);
    strip(ctx,path,base,-1.02,1.02,0,0,colors.edge);
    strip(ctx,path,base,-.994,.994,0,0,colors.fill);
    [-.83,-.33,.17,.67,.83].forEach((f,i)=>lane(ctx,path,base,f,colors.lane,i===0||i===4?1.15:1.65));
    // Tiny physical track markings follow the tangent; they read as racing lanes even at share-preview size.
    const slots=markerKey==='A'?[49,54,59,128,134,140,232,238,244]:[43,49,55,153,159,165,219,225,231];
    for(const i of slots){const q=path[i];const w=widthAt(i,path.length,base);const s=edge(q,w,-.78,0,0),t=edge(q,w,-.43,0,0);rule(ctx,s[0],s[1],t[0],t[1],colors.mark,2);}
    const arrowSlots=markerKey==='A'?[83,93,190,200]:[69,79,201,211];
    for(const i of arrowSlots){const q=path[i],x=q.x+q.nx*base*.4,y=q.y+q.ny*base*.4;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(q.dy,q.dx));polygon(ctx,[[-6,-3],[1,-3],[7,0],[1,3],[-6,3],[0,0]],colors.mark);ctx.restore();}
  }
  function wordmark(ctx,img,x,y,w){
    if(!img)return;const iw=img.naturalWidth||img.videoWidth||img.width,ih=img.naturalHeight||img.videoHeight||img.height;
    if(!(iw>0&&ih>0))return;
    const r={x:292/2172,y:236/724,w:1574/2172,h:212/724};
    ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(img,r.x*iw,r.y*ih,r.w*iw,r.h*ih,x,y,w,w*212/1574);ctx.restore();
  }
  function fitText(ctx,text,x,baseline,maxWidth,maxSize,ink){
    ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=ink;
    let size=maxSize;ctx.font=`700 ${size}px ${DISPLAY}`;
    const m=ctx.measureText(text); const width=Math.max(m.width,(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0));
    if(width>maxWidth){size=Math.max(12,maxSize*maxWidth/width*.99);ctx.font=`700 ${size}px ${DISPLAY}`;}
    const adjusted=ctx.measureText(text);const left=Math.max(0,adjusted.actualBoundingBoxLeft||0);
    // Keep one intact, shaped run for scripts that require contextual joining (Arabic, Indic, etc.).
    ctx.fillText(text,x+left,baseline,maxWidth-left);
  }
  function cityRow(ctx,{y,city,role,code,ink,ruleColor,theme}){
    rule(ctx,LEFT,y,RIGHT,y,ruleColor,1.4);
    const mid=y+61,roleX=LEFT+66;
    ctx.fillStyle=code==='A'?theme.a:theme.b;ctx.strokeStyle=theme.paperInk;ctx.lineWidth=1.15;
    ctx.beginPath();if(code==='A')ctx.arc(LEFT+20,mid-2,18,0,2*Math.PI);else{ctx.moveTo(LEFT+20,mid-23);ctx.lineTo(LEFT+40,mid-2);ctx.lineTo(LEFT+20,mid+18);ctx.lineTo(LEFT,mid-2);ctx.closePath();}ctx.fill();ctx.stroke();
    label(ctx,code,LEFT+20,mid+4,18,code==='A'?theme.aMark:theme.bMark,'center');
    label(ctx,role,roleX,mid+4,16,ink);
    fitText(ctx,city,LEFT+215,mid+20,RIGHT-(LEFT+215)-54,69,ink);
    const ex=RIGHT-4,ey=mid+2;ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(ex-27,ey);ctx.lineTo(ex,ey);ctx.moveTo(ex-8,ey-8);ctx.lineTo(ex,ey);ctx.lineTo(ex-8,ey+8);ctx.stroke();ctx.restore();
  }
  root.drawCadraPoster=function drawCadraPoster(ctx,config,wordmarkImage){
    if(!ctx||!ctx.canvas)throw new TypeError('A 2D canvas context is required.');
    const c=config||{},theme=c.palette==='night'?THEMES.night:THEMES.lime;
    const d=['5K','10K','HALF'].includes(c.distanceLabel)?c.distanceLabel:'5K';
    const home=clean(c.home,'Bengaluru'),away=clean(c.away,'London');
    ctx.save();
    try{
      ctx.setTransform(ctx.canvas.width/W,0,0,ctx.canvas.height/H,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.lineCap='butt';ctx.lineJoin='round';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.setLineDash([]);
      ctx.fillStyle=theme.field;ctx.fillRect(0,0,W,H);
      // Dark masthead lets the original photographic wordmark appear without modifying its pixels.
      ctx.fillStyle=theme.dark;ctx.fillRect(0,0,W,112);wordmark(ctx,wordmarkImage,LEFT,33,319);
      label(ctx,'DUO RACE INVITATION',RIGHT,50,19,'#ECF2E2','right');label(ctx,'CADRA RACE STUDIO',RIGHT,78,14,'#A3B39D','right');
      const top=112,artBottom=926;
      ctx.save();ctx.beginPath();ctx.rect(0,top,W,artBottom-top);ctx.clip();
      // Sparse dot screen and two survey rails are letterpress details, rendered deterministically in both themes.
      ctx.save();ctx.globalAlpha=.21;ctx.fillStyle=theme.fieldFine;
      for(let y=top+16;y<artBottom;y+=15)for(let x=(Math.floor(y/15)%2)*7;x<W;x+=15)ctx.fillRect(x,y,1.4,1.4);ctx.restore();
      label(ctx,'// DISTANCE',LEFT,172,19,theme.ink);rule(ctx,LEFT+169,165,RIGHT-196,165,theme.fieldFine,1);
      label(ctx,d==='HALF'?'21.0975 KM':d==='10K'?'10,000 M':'5,000 M',RIGHT,172,20,theme.ink,'right');
      // Main distance hangs into the generous top margin above the tracks. Wider labels get their own optical size.
      const sz=d==='HALF'?234:d==='10K'?274:313;
      ctx.save();ctx.translate(LEFT-4,407);ctx.transform(1,0,-.105,1,0,0);fitText(ctx,d,0,0,d==='HALF'?880:790,sz,theme.ink);ctx.restore();
      // Fine calibration ticks in the print margin and a restrained edition mark.
      ctx.save();ctx.globalAlpha=.66;for(let i=0;i<=30;i++){const yy=305+i*18;rule(ctx,RIGHT-(i%5===0?23:9),yy,RIGHT,yy,theme.fieldFine,i%5===0?1.55:1);}ctx.restore();
      const ca={fill:theme.a,edge:theme.aEdge,lane:theme.aLane,mark:theme.aMark};
      const cb={fill:theme.b,edge:theme.bEdge,lane:theme.bLane,mark:theme.bMark};
      strip(ctx,A,47,-1,1,6,20,theme.shade);strip(ctx,B,42,-1,1,6,20,theme.shade);
      ribbon(ctx,A,47,ca,'A');ribbon(ctx,B,42,cb,'B');
      // Reprint the first crossing over the cream/ice band; the second crossing runs underneath.
      ctx.save();ctx.beginPath();ctx.rect(-30,top,571,artBottom-top);ctx.clip();ribbon(ctx,A,47,ca,'A');ctx.restore();
      // Route pin callouts: the letters match the colour-coded destinations on the tear-off below.
      const keys=[{x:407,y:495,i:'A',dx:47,dy:43,col:theme.aEdge},{x:747,y:575,i:'B',dx:49,dy:53,col:theme.bEdge}];
      for(const k of keys){let x=k.x+k.dx,y=k.y+k.dy;rule(ctx,k.x,k.y,x,y,theme.ink,1);ctx.fillStyle=theme.field;ctx.fillRect(x-2,y-12,27,26);ctx.strokeStyle=theme.ink;ctx.lineWidth=1;ctx.strokeRect(x-2,y-12,27,26);label(ctx,k.i,x+11,y+6,17,theme.ink,'center');}
      rule(ctx,LEFT,868,RIGHT,868,theme.fieldFine,1);
      label(ctx,'TWO RUNNERS',LEFT,902,17,theme.ink);label(ctx,'DIFFERENT ROADS. ONE RACE.',RIGHT,902,17,theme.ink,'right');
      ctx.restore();
      // Tear-off race card: real city labels, never obscured by the decorative artwork.
      ctx.fillStyle=theme.paper;ctx.fillRect(0,artBottom,W,H-artBottom);
      ctx.fillStyle=theme.ink;ctx.fillRect(0,artBottom,W,3);
      label(ctx,'RACE PAIRING',LEFT,978,19,theme.paperInk);label(ctx,'01  /  02',RIGHT,978,17,theme.paperInk,'right');
      cityRow(ctx,{y:1004,city:home,role:'HOME',code:'A',ink:theme.paperInk,ruleColor:theme.paperLine,theme});
      cityRow(ctx,{y:1123,city:away,role:'AWAY',code:'B',ink:theme.paperInk,ruleColor:theme.paperLine,theme});
      rule(ctx,LEFT,1244,RIGHT,1244,theme.paperLine,1.4);
      label(ctx,'cadrarunning.com',LEFT,1301,21,theme.paperInk);
      label(ctx,'DUO  /  '+(d==='HALF'?'HALF MARATHON':d+' ROAD RACE'),RIGHT,1301,16,theme.paperInk,'right');
    }finally{ctx.restore();}
  };
})(window);

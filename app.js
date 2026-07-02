/* ============================================================
   Confidently Wrong — project page interactions
   (vanilla JS; three.js loaded lazily with graceful fallback)
   ============================================================ */

/* ---------- representative denoising trajectories ---------- */
/* per-step answer-position entropy over T reverse steps.
   correct: settles early into a flat, low path.  wrong: stays turbulent/high,
   yet the FINAL token still commits confidently (the whole point). */
const T = 32;
function makeTraj(mode){
  const a=[];
  for(let t=0;t<T;t++){
    const x=t/(T-1);
    if(mode==='correct'){
      a.push(Math.max(0.08, 1.15*Math.exp(-3.4*x) + 0.05*Math.sin(t*0.7)*Math.exp(-2*x)));
    }else{
      // turbulent, high, slow to fall; commits only at the very end
      let v = 0.95 + 0.35*Math.sin(t*0.9) + 0.18*Math.sin(t*2.3) - 0.5*Math.pow(x,4);
      if(t>=T-2) v = 0.25; // confident final commit
      a.push(Math.max(0.12, v));
    }
  }
  return a;
}
const TRAJ = {correct:makeTraj('correct'), wrong:makeTraj('wrong')};
const WORDS = {correct:['No','.','',' ',''], wrong:['Yes','.','',' ','']};
let mode='correct', frame=0, raf=null;

/* ---------- interactive trajectory canvas ---------- */
const cv=document.getElementById('trajCanvas'), ctx=cv.getContext('2d');
function fit(c){const dpr=Math.min(2,window.devicePixelRatio||1);const w=c.clientWidth;c.width=w*dpr;c.height=c.height* (c._h?1:1);
  const hh=parseInt(c.getAttribute('height'))||360;c.width=w*dpr;c.height=hh*dpr;c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);return {w,h:hh};}
let dim=fit(cv);
window.addEventListener('resize',()=>{dim=fit(cv);drawFrame(frame);});

function lerp(a,b,t){return a+(b-a)*t}
function drawFrame(f){
  const {w,h}=dim; ctx.clearRect(0,0,w,h);
  const arr=TRAJ[mode]; const steps=Math.min(T, Math.floor(f));
  // ---- top: token cells resolving ----
  const cells=5, pad=w*0.06, cw=(w-2*pad)/cells, cy=28, ch=54;
  ctx.font='600 15px ui-monospace,Menlo,monospace';
  for(let i=0;i<cells;i++){
    const x=pad+i*cw+6, y=cy;
    const resolved = steps > (mode==='correct'? 6+i*1.2 : 20+i*1.6);
    ctx.fillStyle = resolved ? (mode==='correct'?'#12233f':'#301826') : '#0e1630';
    ctx.strokeStyle = resolved ? (mode==='correct'?'#31d0aa':'#ff5470') : '#26304f';
    roundRect(ctx,x,y,cw-12,ch,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = resolved ? '#e8ecf7' : '#5a6690';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    let label='[MASK]';
    if(resolved) label = WORDS[mode][i]||'·';
    else if(steps> i*1.1) { // flicker while unresolved
      const pool = mode==='correct'?['No','no','No']:['Yes','No','yes','Yes','No'];
      label = pool[(Math.floor(f*0.6)+i)%pool.length];
    }
    ctx.font = label==='[MASK]'? '600 12px ui-monospace,Menlo,monospace':'700 16px ui-monospace,Menlo,monospace';
    ctx.fillText(label, x+(cw-12)/2, y+ch/2);
  }
  ctx.textAlign='left';ctx.fillStyle='#9aa6c7';ctx.font='12px ui-monospace,monospace';
  ctx.fillText('answer tokens  ·  step '+steps+' / '+T, pad, cy-10);

  // ---- bottom: entropy trajectory plot ----
  const gx=pad, gy=120, gw=w-2*pad, gh=h-gy-30;
  // axes
  ctx.strokeStyle='#26304f';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.stroke();
  const maxE=1.7;
  const yOf=e=>gy+gh-(e/maxE)*gh, xOf=i=>gx+(i/(T-1))*gw;
  // chance-ish guide
  ctx.fillStyle='#9aa6c7';ctx.font='11px ui-monospace,monospace';
  ctx.fillText('entropy',gx,gy-8); ctx.fillText('0',gx-4,gy+gh+16); ctx.fillText('steps→',gx+gw-42,gy+gh+16);
  // area + line up to current step
  const col = mode==='correct'?'#31d0aa':'#ff5470';
  ctx.beginPath();
  for(let i=0;i<=steps && i<T;i++){const x=xOf(i),y=yOf(arr[i]); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
  ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.stroke();
  // fill
  if(steps>0){ctx.lineTo(xOf(Math.min(steps,T-1)),gy+gh);ctx.lineTo(gx,gy+gh);ctx.closePath();
    ctx.fillStyle=(mode==='correct'?'rgba(49,208,170,.13)':'rgba(255,84,112,.13)');ctx.fill();}
  // running mean line
  if(steps>1){
    let m=0;for(let i=0;i<Math.min(steps,T);i++)m+=arr[i];m/=Math.min(steps,T);
    const my=yOf(m);ctx.setLineDash([5,5]);ctx.strokeStyle='#9aa6c7';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(gx,my);ctx.lineTo(gx+gw,my);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#c8d3f5';ctx.fillText('mean '+m.toFixed(2),gx+gw-70,my-6);
  }
  // dot
  if(steps>0&&steps<=T){const i=Math.min(steps-1,T-1);ctx.fillStyle=col;ctx.beginPath();ctx.arc(xOf(i),yOf(arr[i]),4,0,7);ctx.fill();}

  // readouts
  const done = steps>=T;
  const meanAll = arr.reduce((s,v)=>s+v,0)/T;
  document.getElementById('roMean').textContent = (steps>1? (arr.slice(0,steps).reduce((s,v)=>s+v,0)/steps).toFixed(2): '—');
  document.getElementById('roFinal').textContent = done? arr[T-1].toFixed(2) : '—';
  const v=document.getElementById('roVerdict');
  if(done){ if(mode==='correct'){v.textContent='reliable ✓';v.style.color='#31d0aa';}
            else{v.textContent='FLAGGED — high mean-entropy ✗';v.style.color='#ff5470';} }
  else {v.textContent='denoising…';v.style.color='#9aa6c7';}
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

function loop(){frame+=0.5; if(frame>T+10)frame=T+10; drawFrame(frame); if(frame<T+8)raf=requestAnimationFrame(loop);}
function replay(){cancelAnimationFrame(raf);frame=0;loop();}
function setMode(m){mode=m;
  document.getElementById('btnCorrect').className = m==='correct'?'on':'';
  document.getElementById('btnWrong').className = m==='wrong'?'on wrong':'';
  replay();}
window.replay=replay;window.setMode=setMode;
// autostart when scrolled into view
const demoObs=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){replay();demoObs.disconnect();}}),{threshold:.3});
demoObs.observe(document.getElementById('demo'));
drawFrame(0);

/* ---------- hero background: drifting denoise dots ---------- */
(function(){
  const c=document.getElementById('heroCanvas');if(!c)return;const x=c.getContext('2d');
  let W,H,pts=[];
  function rs(){const dpr=Math.min(2,devicePixelRatio||1);W=c.clientWidth;H=c.clientHeight;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0);
    pts=Array.from({length:70},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2+.5,s:Math.random()*.4+.1,ph:Math.random()*6}));}
  rs();addEventListener('resize',rs);
  function tick(t){x.clearRect(0,0,W,H);
    for(const p of pts){p.y-=p.s;if(p.y<-5)p.y=H+5;const a=.25+.25*Math.sin(t*.001+p.ph);
      x.fillStyle='rgba(76,124,255,'+a+')';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();}
    requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
})();

/* ---------- 3D scene (three.js via CDN, graceful fallback) ---------- */
(function(){
  const note=document.getElementById('threeNote');
  const s=document.createElement('script');
  s.src='https://unpkg.com/three@0.160.0/build/three.min.js';
  s.onerror=()=>{note.textContent='(3D scene unavailable offline — the 2D animation above shows the same signal.)';
    document.getElementById('threeCanvas').style.display='none';};
  s.onload=()=>{try{build3D();note.textContent='Green = correct (low, flat). Red = hallucinated (tall, turbulent). Drag to rotate.';}catch(e){note.textContent='(3D scene failed to init.)';}};
  document.head.appendChild(s);

  function build3D(){
    const cv=document.getElementById('threeCanvas');
    const W=cv.clientWidth, H=420;
    const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.setSize(W,H,false);
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(45,W/H,0.1,100);cam.position.set(0,16,30);cam.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xffffff,.75));
    const d=new THREE.DirectionalLight(0xffffff,.9);d.position.set(10,20,10);scene.add(d);
    const grp=new THREE.Group();scene.add(grp);
    const rows=[{arr:TRAJ.correct,z:-3,col:0x31d0aa},{arr:TRAJ.wrong,z:3,col:0xff5470}];
    const bars=[];
    rows.forEach(r=>{
      for(let i=0;i<T;i++){
        const g=new THREE.BoxGeometry(0.5,1,0.9);
        const m=new THREE.MeshLambertMaterial({color:r.col});
        const b=new THREE.Mesh(g,m);
        b.position.set((i-T/2)*0.62, 0, r.z);
        b.scale.y=0.01;b._target=Math.max(0.1,r.arr[i]*6);
        grp.add(b);bars.push(b);
      }
    });
    // ground
    const gp=new THREE.Mesh(new THREE.PlaneGeometry(30,12),new THREE.MeshBasicMaterial({color:0x0b1226}));
    gp.rotation.x=-Math.PI/2;gp.position.y=-0.1;grp.add(gp);
    let rot=-0.5, drag=false, px=0, t0=performance.now();
    cv.addEventListener('pointerdown',e=>{drag=true;px=e.clientX});
    addEventListener('pointerup',()=>drag=false);
    addEventListener('pointermove',e=>{if(drag){rot+=(e.clientX-px)*0.01;px=e.clientX}});
    addEventListener('resize',()=>{const w=cv.clientWidth;renderer.setSize(w,H,false);cam.aspect=w/H;cam.updateProjectionMatrix();});
    function anim(){
      const t=(performance.now()-t0)/1000;
      bars.forEach(b=>{const g=Math.min(1,t/2.2);b.scale.y=lerp(b.scale.y,b._target*g,0.08);b.position.y=b.scale.y/2;});
      if(!drag)rot+=0.0022;grp.rotation.y=rot;
      renderer.render(scene,cam);requestAnimationFrame(anim);
    }
    anim();
  }
})();

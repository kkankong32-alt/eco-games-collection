/* Original procedural sounds and SVG feedback. No network requests or third-party assets. */
(() => {
  'use strict';
  let muted = false, activated = false, context = null, config = null, lastTone = 0;
  const contexts = [], history = [];
  try { muted = localStorage.getItem('eco-feedback-muted') === '1'; } catch (_) {}
  const Native = window.AudioContext || window.webkitAudioContext;
  if (Native) {
    const Wrapped = new Proxy(Native, {construct(Target, args) {
      const ctx = new Target(...args), resume = ctx.resume.bind(ctx);
      ctx.resume = () => (!activated || muted) ? Promise.resolve() : resume();
      contexts.push({ctx, resume});
      if (!activated || muted) ctx.suspend().catch(() => {});
      return ctx;
    }});
    window.AudioContext = Wrapped;
    if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  }
  function unlock(e) {
    if (!e.isTrusted) return;
    activated = true;
    if (!context && Native) context = new window.AudioContext();
    if (!muted) contexts.forEach(x => {if(x.ctx.state !== 'closed') x.resume().catch(() => {});});
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('click', e => {
    if(e.target.closest?.('button') && !e.target.closest('#eco-tools')) sound('action');
  });
  function sound(kind='action') {
    if (!activated || muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    if (now-lastTone < .09) return;
    lastTone=now;
    const notes = {action:[440],good:[660,880],bad:[220,165],win:[523,659,784],start:[392,523]};
    (notes[kind] || notes.action).forEach((f,i) => {
      const osc=context.createOscillator(),gain=context.createGain(),t=now+i*.085;
      osc.type=kind==='bad'?'triangle':'sine'; osc.frequency.value=f;
      gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(.045,t+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.16);
      osc.connect(gain); gain.connect(context.destination);osc.start(t);osc.stop(t+.17);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    });
  }
  let shell, summary, details, meter, visual, log, toast, toggle, hideTimer;
  function notify(kind, message) {
    history.push({kind,message,time:Date.now()});if(history.length>12)history.shift();
    sound(kind);
    if(log){log.textContent=message;toast.textContent=message;toast.hidden=false;clearTimeout(hideTimer);hideTimer=setTimeout(()=>toast.hidden=true,3200);}
    render();
  }
  function setMuted(value) {
    muted=!!value;
    try{localStorage.setItem('eco-feedback-muted',muted?'1':'0');}catch(_){}
    contexts.forEach(x=>{if(x.ctx.state!=='closed') (muted?x.ctx.suspend():(activated?x.resume():Promise.resolve())).catch(()=>{});});
    if(toggle){toggle.textContent=muted?'소리 꺼짐':'소리 켜짐';toggle.setAttribute('aria-pressed',String(muted));}
  }
  function render(){
    if(!config || !summary)return;
    try{
      const data=config.read();
      summary.textContent=data.label;
      const p=Math.max(0,Math.min(100,Number(data.progress)||0));meter.value=p;
      meter.setAttribute('aria-label',data.label);
      visual.style.setProperty('--eco-progress',p/100);
      visual.setAttribute('aria-label',data.label+' — 게임 안의 진행 상태');
      details.textContent=data.detail || config.goal;
    }catch(e){if(!window.EcoFX.readError)window.EcoFX.readError=String(e);}
  }
  function mount(c){
    config=c;
    const style=document.createElement('style');style.textContent=`
    #eco-tools{position:fixed;right:10px;bottom:10px;z-index:10000;font:12px/1.5 system-ui,sans-serif;color:#eafaf5;max-width:min(310px,calc(100vw - 20px));text-align:left;pointer-events:auto}
    #eco-tools button{font:inherit;border:1px solid #397768;background:#102a29;color:#f1fff9;border-radius:8px;padding:7px 10px;cursor:pointer;min-height:34px;margin:0;box-shadow:none}
    #eco-tools button:focus-visible{outline:3px solid #fbd66a;outline-offset:2px}#eco-tools .eco-row{display:flex;gap:5px;justify-content:flex-end}
    #eco-panel{margin-bottom:6px;padding:14px;border:1px solid #397768;border-radius:12px;background:#0a1c22f5;box-shadow:0 6px 25px #0008;max-height:60vh;overflow:auto}
    #eco-panel p{margin:8px 0}#eco-panel small{display:block;color:#b6c8cd;font-size:10px}#eco-panel progress{width:100%;height:8px;accent-color:#4adea0}
    #eco-visual{width:100%;height:64px;display:block;background:#102934;border-radius:8px}#eco-visual .growth{opacity:calc(.15 + var(--eco-progress)*.85)}
    #eco-toast{position:fixed;left:50%;bottom:60px;transform:translateX(-50%);max-width:min(560px,85vw);background:#102a29f5;color:#f0fff7;padding:10px 16px;border:1px solid #50a68d;border-radius:10px;font:13px/1.5 system-ui;z-index:9999;pointer-events:none;text-align:center}
    #eco-tools [hidden],#eco-toast[hidden]{display:none!important}@media(max-width:600px){#eco-tools{bottom:5px;right:5px}#eco-tools button{padding:5px 7px;font-size:11px}#eco-toast{bottom:85px}}`;
    document.head.append(style);
    shell=document.createElement('div');shell.id='eco-tools';
    shell.innerHTML=`<section id="eco-panel" hidden aria-label="환경 행동과 결과"><strong></strong><svg id="eco-visual" viewBox="0 0 280 64" role="img"><path d="M0 45 Q35 32 70 45 T140 45 T210 45 T280 45 V64 H0Z" fill="#287b92"/><path class="growth" d="M0 50 Q35 40 70 50 T140 50 T210 50 T280 50 V64 H0Z" fill="#40d4b3"/><g class="growth" fill="#72e4a4"><path d="M38 53V24h3v29M40 38Q18 36 22 18Q42 18 40 38M40 32Q62 30 58 12Q40 12 40 32"/><path d="M230 45q12-16 26 0q-14 16-26 0l-10 7V38z"/></g><path d="M100 29h64m-8-6 8 6-8 6" fill="none" stroke="#dfefeb" stroke-width="3"/><circle cx="91" cy="29" r="5" fill="#ffc76d"/><circle cx="181" cy="29" r="5" fill="#76e7b2"/></svg><p id="eco-details"></p><progress max="100" value="0"></progress><p id="eco-log" role="status" aria-live="polite"></p><small></small><div id="eco-actions"></div></section><div class="eco-row"><button id="eco-open" aria-expanded="false" aria-controls="eco-panel">환경 기록</button><button id="eco-audio" aria-label="효과음 음소거 전환"></button></div>`;
    document.body.append(shell);
    shell.querySelector('strong').textContent=c.title;
    shell.querySelector('small').textContent=c.note || '수치와 시각 효과는 게임 규칙의 표현이며 실제 환경 개선량을 뜻하지 않습니다.';
    summary=shell.querySelector('#eco-open');details=shell.querySelector('#eco-details');meter=shell.querySelector('progress');visual=shell.querySelector('svg');log=shell.querySelector('#eco-log');toggle=shell.querySelector('#eco-audio');
    toast=document.createElement('div');toast.id='eco-toast';toast.hidden=true;document.body.append(toast);
    summary.addEventListener('click',()=>{const panel=shell.querySelector('#eco-panel');panel.hidden=!panel.hidden;summary.setAttribute('aria-expanded',String(!panel.hidden));});
    toggle.title='효과음 전환 (F8)';
    document.addEventListener('keydown',e=>{if(e.code==='F8'&&!e.repeat){e.preventDefault();setMuted(!muted);}},true);
    shell.addEventListener('click',e=>{if(e.detail>0&&document.activeElement instanceof HTMLElement)document.activeElement.blur();});
    toggle.addEventListener('click',()=>{setMuted(!muted);if(!muted)sound('action');});
    // Keep controls from firing the game's canvas actions or keyboard movement.
    ['pointerdown','mousedown','click','keydown','keyup','touchstart'].forEach(t=>shell.addEventListener(t,e=>e.stopPropagation()));
    (c.actions||[]).forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.onclick=a.run;shell.querySelector('#eco-actions').append(b);});
    setMuted(muted);log.textContent=c.goal;render();setInterval(render,400);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)contexts.forEach(x=>x.ctx.state!=='closed'&&x.ctx.suspend().catch(()=>{}));});
  }
  window.EcoFX={mount,notify,sound,setMuted,render,history,get muted(){return muted;},get activated(){return activated;},get audioStates(){return contexts.map(x=>x.ctx.state);}};
})();

(() => {
  const state = {
    matchLength: 4,
    redScore: 0,
    blueScore: 0,
    redWarnings: 0,
    blueWarnings: 0,
    period: 1,
    elapsed: 0,
    running: false,
    finished: false,
    hasStarted: false,
    startPerf: 0,
    timeAtStart: 0,
    raf: null,
    tournament: null,
    matches: {}
  };

  const $ = id => document.getElementById(id);

  const els = {
    btn4:$("btn4"), btn6:$("btn6"), publicBtn:$("publicBtn"),
    redScore:$("redScore"), blueScore:$("blueScore"),
    redWarnings:$("redWarnings"), blueWarnings:$("blueWarnings"),
    clock:$("clock"), status:$("status"), period:$("period"),
    startStop:$("startStop"), minusSec:$("minusSec"), plusSec:$("plusSec"),
    elapsedBtn:$("elapsedBtn"), resetBtn:$("resetBtn"),
    matchNumber:$("matchNumber"), matchMinus:$("matchMinus"), matchPlus:$("matchPlus"),
    redName:$("redName"), redClub:$("redClub"), blueName:$("blueName"), blueClub:$("blueClub"),
    tournamentBtn:$("tournamentBtn"), tournamentDialog:$("tournamentDialog"),
    tournamentSelect:$("tournamentSelect"), tournamentStatus:$("tournamentStatus"),
    tournamentCancel:$("tournamentCancel"), tournamentLoad:$("tournamentLoad"),
    dialog:$("dialog"), dialogText:$("dialogText"), dialogClose:$("dialogClose")
  };

  function periodLength(){ return state.matchLength === 4 ? 120 : 180; }
  function totalLength(){ return state.matchLength * 60; }

  function formatTime(sec){
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  }

  function renderWarnings(container, count, side){
    container.innerHTML = "";
    for(let i=0;i<3;i++){
      const d = document.createElement("div");
      d.className = "dot "+side+"-dot"+(i<count?" on":"");
      container.appendChild(d);
    }
  }

  function statusText(){
    if(state.finished) return "MATCH SLUT";
    if(state.running) return "KÖR";
    if(state.period === 2 && Math.abs(state.elapsed-periodLength()) < .5) return "PERIODPAUS";
    if(state.hasStarted) return "STOPP";
    return "KLAR";
  }

  function render(){
    els.redScore.textContent = state.redScore;
    els.blueScore.textContent = state.blueScore;
    renderWarnings(els.redWarnings, state.redWarnings, "red");
    renderWarnings(els.blueWarnings, state.blueWarnings, "blue");
    els.clock.textContent = formatTime(state.elapsed);
    els.status.textContent = statusText();
    els.status.style.color = state.finished ? "#ffd900" : state.running ? "#20c75a" :
      (state.period===2 && Math.abs(state.elapsed-periodLength()) < .5 ? "#ffd900" : "#fff");
    els.period.textContent = `PERIOD ${state.period} / 2`;
    els.startStop.textContent = state.finished ? "MATCH SLUT" : (state.running ? "STOPP" : "STARTA");
    els.startStop.className = state.running ? "stop" : "start";
    els.startStop.disabled = state.finished;
    els.minusSec.disabled = state.running;
    els.plusSec.disabled = state.running;
    els.elapsedBtn.disabled = state.running;
    els.btn4.disabled = state.hasStarted;
    els.btn6.disabled = state.hasStarted;
    els.btn4.classList.toggle("active", state.matchLength===4);
    els.btn6.classList.toggle("active", state.matchLength===6);
    renderCurrentWrestlers();
    broadcast();
  }

  function tick(now){
    if(!state.running) return;
    state.elapsed = state.timeAtStart + (now-state.startPerf)/1000;

    if(state.period===1 && state.elapsed >= periodLength()){
      state.elapsed = periodLength();
      state.period = 2;
      state.running = false;
      playSignal();
      render();
      return;
    }
    if(state.period===2 && state.elapsed >= totalLength()){
      state.elapsed = totalLength();
      state.running = false;
      state.finished = true;
      playSignal();
      render();
      return;
    }
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function start(){
    if(state.finished || state.running) return;
    state.hasStarted = true;
    state.running = true;
    state.timeAtStart = state.elapsed;
    state.startPerf = performance.now();
    state.raf = requestAnimationFrame(tick);
    render();
  }

  function stop(){
    if(!state.running) return;
    state.elapsed = state.timeAtStart + (performance.now()-state.startPerf)/1000;
    state.running = false;
    if(state.raf) cancelAnimationFrame(state.raf);
    render();
  }

  function toggle(){ state.running ? stop() : start(); }

  function reset(){
    if(state.raf) cancelAnimationFrame(state.raf);
    state.redScore=0; state.blueScore=0;
    state.redWarnings=0; state.blueWarnings=0;
    state.period=1; state.elapsed=0; state.running=false;
    state.finished=false; state.hasStarted=false;
    render();
  }

  function adjustTime(delta){
    if(state.running) return;
    if(state.finished && delta<0) state.finished=false;
    if(state.period===1){
      state.elapsed = Math.min(Math.max(state.elapsed+delta,0), periodLength());
    } else {
      state.elapsed = Math.min(Math.max(state.elapsed+delta,periodLength()), totalLength());
    }
    if(state.elapsed < totalLength()) state.finished=false;
    render();
  }

  function changeMatchNumber(delta){
    let n = parseInt(els.matchNumber.value,10);
    if(!Number.isFinite(n)) n = 1;
    n = Math.max(1,n+delta);
    els.matchNumber.value = n;
    render();
  }

  let audioCtx = null;
  function playSignal(){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const master = audioCtx.createGain();
      master.gain.value = 0.22;
      master.connect(audioCtx.destination);
      const start = audioCtx.currentTime;
      const duration = 1.5;
      for(let i=0;i<12;i++){
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = i%2===0 ? 900 : 1200;
        const t0 = start + i*(duration/12);
        const t1 = start + (i+1)*(duration/12);
        gain.gain.setValueAtTime(0.0001,t0);
        gain.gain.exponentialRampToValueAtTime(0.8,t0+0.01);
        gain.gain.setValueAtTime(0.8,t1-0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001,t1);
        osc.connect(gain); gain.connect(master);
        osc.start(t0); osc.stop(t1);
      }
    }catch(e){ console.warn("Ljud kunde inte spelas", e); }
  }

  function publicState(){
    return {
      type:"state",
      matchLength:state.matchLength,
      redScore:state.redScore, blueScore:state.blueScore,
      redWarnings:state.redWarnings, blueWarnings:state.blueWarnings,
      period:state.period, elapsed:state.elapsed,
      running:state.running, finished:state.finished, hasStarted:state.hasStarted,
      matchNumber: els.matchNumber.value || "1",
      status: statusText(),
      tournamentName: state.tournament ? state.tournament.name : "",
      redName: currentMatch().redName || "",
      redClub: currentMatch().redClub || "",
      blueName: currentMatch().blueName || "",
      blueClub: currentMatch().blueClub || ""
    };
  }


  function currentMatch(){
    const nr = String(parseInt(els.matchNumber.value,10) || 1);
    return state.matches[nr] || {};
  }

  function renderCurrentWrestlers(){
    const m = currentMatch();
    els.redName.textContent = m.redName || "—";
    els.redClub.textContent = m.redClub || "—";
    els.blueName.textContent = m.blueName || "—";
    els.blueClub.textContent = m.blueClub || "—";
  }

  async function loadTournaments(){
    els.tournamentStatus.textContent = "Hämtar tävlingar från RingerDB…";
    els.tournamentSelect.innerHTML = "";
    try{
      const r = await fetch("/.netlify/functions/ringerdb?mode=tournaments");
      if(!r.ok) throw new Error("Serverfel");
      const data = await r.json();
      (data.tournaments || []).forEach(t=>{
        const o=document.createElement("option");
        o.value=t.url;
        o.textContent=(t.date ? t.date+" – " : "")+t.name+(t.place ? " ("+t.place+")" : "");
        o.dataset.name=t.name;
        els.tournamentSelect.appendChild(o);
      });
      els.tournamentStatus.textContent = `${(data.tournaments || []).length} tävlingar hittades`;
    }catch(e){
      els.tournamentStatus.textContent = "Kunde inte hämta tävlingslistan. Webbappen måste publiceras med Netlify Functions.";
    }
  }

  async function chooseTournament(){
    const option = els.tournamentSelect.options[els.tournamentSelect.selectedIndex];
    if(!option) return;
    els.tournamentStatus.textContent = "Hämtar matchlistor…";
    els.tournamentLoad.disabled = true;
    try{
      const u = encodeURIComponent(option.value);
      const r = await fetch("/.netlify/functions/ringerdb?mode=matches&url="+u);
      if(!r.ok) throw new Error("Kunde inte läsa matchlista");
      const data = await r.json();
      state.tournament = {name: option.dataset.name || option.textContent, url: option.value};
      state.matches = {};
      (data.matches || []).forEach(m=>{ state.matches[String(m.matchNumber)] = m; });
      if(Object.keys(state.matches).length === 0){
        const info = data.debug ? ` (${data.debug.matchListCount || 0} matchlistor hittades)` : "";
        throw new Error("Inga matcher kunde läsas"+info);
      }
      try{
        localStorage.setItem("brottarklocka_tournament", JSON.stringify({
          tournament:state.tournament, matches:state.matches
        }));
      }catch(e){}
      els.tournamentDialog.classList.add("hidden");
      render();
    }catch(e){
      els.tournamentStatus.textContent = "Kunde inte läsa matcherna från vald tävling.";
    }finally{
      els.tournamentLoad.disabled = false;
    }
  }

  els.tournamentBtn.onclick=()=>{
    els.tournamentDialog.classList.remove("hidden");
    loadTournaments();
  };
  els.tournamentCancel.onclick=()=>els.tournamentDialog.classList.add("hidden");
  els.tournamentLoad.onclick=chooseTournament;

  try{
    const saved=JSON.parse(localStorage.getItem("brottarklocka_tournament"));
    if(saved && saved.matches){
      state.tournament=saved.tournament || null;
      state.matches=saved.matches || {};
    }
  }catch(e){}

  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("brottarklocka") : null;
  function broadcast(){
    const s = publicState();
    if(channel) channel.postMessage(s);
    try { localStorage.setItem("brottarklocka_state", JSON.stringify(s)); } catch(e){}
  }

  document.querySelectorAll("[data-points]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const side=btn.dataset.side, pts=parseInt(btn.dataset.points,10);
      if(side==="red") state.redScore+=pts; else state.blueScore+=pts;
      render();
    });
  });
  $("redMinus").onclick=()=>{ if(state.redScore>0) state.redScore--; render(); };
  $("blueMinus").onclick=()=>{ if(state.blueScore>0) state.blueScore--; render(); };
  $("redWarnPlus").onclick=()=>{ state.redWarnings=Math.min(3,state.redWarnings+1); render(); };
  $("redWarnMinus").onclick=()=>{ state.redWarnings=Math.max(0,state.redWarnings-1); render(); };
  $("blueWarnPlus").onclick=()=>{ state.blueWarnings=Math.min(3,state.blueWarnings+1); render(); };
  $("blueWarnMinus").onclick=()=>{ state.blueWarnings=Math.max(0,state.blueWarnings-1); render(); };

  els.startStop.onclick=toggle;
  els.minusSec.onclick=()=>adjustTime(-1);
  els.plusSec.onclick=()=>adjustTime(1);
  els.resetBtn.onclick=reset;
  els.btn4.onclick=()=>{ if(!state.hasStarted){ state.matchLength=4; reset(); } };
  els.btn6.onclick=()=>{ if(!state.hasStarted){ state.matchLength=6; reset(); } };
  els.matchMinus.onclick=()=>changeMatchNumber(-1);
  els.matchPlus.onclick=()=>changeMatchNumber(1);
  els.matchNumber.addEventListener("input",()=>{ els.matchNumber.value=els.matchNumber.value.replace(/\D/g,""); broadcast(); });

  els.elapsedBtn.onclick=()=>{
    if(state.running) return;
    const s=Math.max(0,Math.floor(state.elapsed)), m=Math.floor(s/60), sec=s%60;
    els.dialogText.textContent = m===1
      ? `Matchen har varat 1 minut och ${sec} sekunder.`
      : `Matchen har varat ${m} minuter och ${sec} sekunder.`;
    els.dialog.classList.remove("hidden");
  };
  els.dialogClose.onclick=()=>els.dialog.classList.add("hidden");
  els.dialog.addEventListener("click",e=>{ if(e.target===els.dialog) els.dialog.classList.add("hidden"); });

  els.publicBtn.onclick=()=>{
    broadcast();
    window.open("public.html","brottarklocka_public");
  };

  // Lås skärmen vaken där webbläsaren stöder det.
  let wakeLock = null;
  async function requestWakeLock(){
    try{
      if("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    }catch(e){}
  }
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") requestWakeLock(); });
  requestWakeLock();

  // Registrera service worker för PWA/offline.
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  }

  render();
})();

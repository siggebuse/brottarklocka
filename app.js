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
    resetBtn:$("resetBtn"),
    elapsedDisplay:$("elapsedDisplay"), elapsedTime:$("elapsedTime"),
    matchNumber:$("matchNumber"), matchMinus:$("matchMinus"), matchPlus:$("matchPlus"),
    redName:$("redName"), redClub:$("redClub"), blueName:$("blueName"), blueClub:$("blueClub"),
    tournamentBtn:$("tournamentBtn"), tournamentDialog:$("tournamentDialog"),
    tournamentSelect:$("tournamentSelect"), tournamentStatus:$("tournamentStatus"),
    yearSelect:$("yearSelect"), countrySelect:$("countrySelect"),
    tournamentCancel:$("tournamentCancel"), tournamentLoad:$("tournamentLoad"),
    helpBtn:$("helpBtn"), helpDialog:$("helpDialog"), helpClose:$("helpClose")
  };

  function periodLength(){ return state.matchLength === 4 ? 120 : 180; }
  function totalLength(){ return state.matchLength * 60; }
  function remainingTime(){ return Math.max(0, totalLength() - state.elapsed); }

  function formatTime(sec){
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  }

  function formatElapsedTime(sec){
    const s = Math.max(0, Math.round(sec));
    return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  }


  const SEGMENTS = {
    0:"abcdef", 1:"bc", 2:"abdeg", 3:"abcdg", 4:"bcfg",
    5:"acdfg", 6:"acdefg", 7:"abc", 8:"abcdefg", 9:"abcdfg"
  };

  function renderDigitalClock(el, value){
    if(!el || el.dataset.digitalValue === value) return;
    el.dataset.digitalValue = value;
    el.setAttribute("aria-label", value);
    el.innerHTML = "";
    for(const char of value){
      if(char === ":"){
        const colon = document.createElement("span");
        colon.className = "digital-colon";
        colon.setAttribute("aria-hidden","true");
        el.appendChild(colon);
        continue;
      }
      const digit = document.createElement("span");
      digit.className = "digital-digit";
      digit.setAttribute("aria-hidden","true");
      const active = SEGMENTS[char] || "";
      for(const name of "abcdefg"){
        const segment = document.createElement("i");
        segment.className = `segment segment-${name}${active.includes(name) ? " on" : ""}`;
        digit.appendChild(segment);
      }
      el.appendChild(digit);
    }
  }

  function renderWarnings(container, count, side){
    container.textContent = String(count);
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
    renderDigitalClock(els.clock, formatTime(remainingTime()));
    els.startStop.textContent = state.running ? "STOPP" : "START";
    els.startStop.classList.toggle("running-state", state.running);
    els.startStop.classList.toggle("start-state", !state.running);
    els.startStop.disabled = state.finished;
    els.minusSec.disabled = state.running;
    els.plusSec.disabled = state.running;
    if(els.elapsedDisplay && els.elapsedTime){
      const showElapsed = state.hasStarted && !state.running;
      els.elapsedDisplay.classList.toggle("hidden", !showElapsed);
      els.elapsedTime.textContent = formatElapsedTime(state.elapsed);
    }
    els.btn4.disabled = state.hasStarted;
    els.btn6.disabled = state.hasStarted;
    els.btn4.checked = state.matchLength===4;
    els.btn6.checked = state.matchLength===6;
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

  function resetState(){
    if(state.raf) cancelAnimationFrame(state.raf);
    state.redScore=0; state.blueScore=0;
    state.redWarnings=0; state.blueWarnings=0;
    state.period=1; state.elapsed=0; state.running=false;
    state.finished=false; state.hasStarted=false;
    render();

    // Hämta senaste matchlistan varje gång NOLLSTÄLL används.
    refreshCurrentTournament();
  }

  function adjustTime(delta){
    if(state.running) return;
    // Knapparna ändrar den VISade nedräkningstiden.
    // +1 SEK = en sekund mer kvar, -1 SEK = en sekund mindre kvar.
    const elapsedDelta = -delta;
    if(state.finished && delta>0) state.finished=false;
    if(state.period===1){
      state.elapsed = Math.min(Math.max(state.elapsed+elapsedDelta,0), periodLength());
    } else {
      state.elapsed = Math.min(Math.max(state.elapsed+elapsedDelta,periodLength()), totalLength());
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
      period:state.period, elapsed:state.elapsed, remaining:remainingTime(),
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
      const year = els.yearSelect?.value || String(new Date().getFullYear());
      const country = els.countrySelect?.value || "SE";
      const r = await fetch(
        `/.netlify/functions/ringerdb?mode=tournaments&year=${encodeURIComponent(year)}&country=${encodeURIComponent(country)}&_=${Date.now()}`,
        {cache:"no-store"}
      );
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
      if((data.tournaments || []).length > 0){
        els.tournamentSelect.selectedIndex = 0;
      }
    }catch(e){
      els.tournamentStatus.textContent = "Kunde inte hämta tävlingslistan. Webbappen måste publiceras med Netlify Functions.";
    }
  }

  let matchRefreshInProgress = false;

  async function refreshCurrentTournament(){
    if(!state.tournament || !state.tournament.url || matchRefreshInProgress) return false;

    matchRefreshInProgress = true;
    try{
      const u = encodeURIComponent(state.tournament.url);
      const r = await fetch(
        "/.netlify/functions/ringerdb?mode=matches&url="+u+"&_="+Date.now(),
        {cache:"no-store"}
      );
      if(!r.ok) throw new Error("Kunde inte läsa matchlista");

      const data = await r.json();
      const freshMatches = {};
      (data.matches || []).forEach(m=>{
        freshMatches[String(m.matchNumber)] = m;
      });

      if(Object.keys(freshMatches).length === 0){
        throw new Error("Inga matcher kunde läsas");
      }

      state.matches = freshMatches;

      try{
        localStorage.setItem("brottarklocka_tournament", JSON.stringify({
          tournament: state.tournament,
          matches: state.matches
        }));
      }catch(e){}

      render();
      return true;
    }catch(e){
      console.warn("Matchlistan kunde inte uppdateras:", e);
      return false;
    }finally{
      matchRefreshInProgress = false;
    }
  }

  async function chooseTournament(){
    const option = els.tournamentSelect.options[els.tournamentSelect.selectedIndex];
    if(!option) return;
    els.tournamentStatus.textContent = "Hämtar matchlistor…";
    els.tournamentLoad.disabled = true;
    try{
      const u = encodeURIComponent(option.value);
      const r = await fetch("/.netlify/functions/ringerdb?mode=matches&url="+u+"&_="+Date.now(), {cache:"no-store"});
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
  els.helpBtn.onclick=()=>els.helpDialog.classList.remove("hidden");
  els.helpClose.onclick=()=>els.helpDialog.classList.add("hidden");
  els.helpDialog.addEventListener("click",(e)=>{ if(e.target===els.helpDialog) els.helpDialog.classList.add("hidden"); });

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
  document.addEventListener("keydown",(e)=>{
    if(e.key && e.key.toLowerCase()==="s"){
      const target=e.target;
      const tag=(target && target.tagName || "").toLowerCase();
      const inputType=(target && target.type || "").toLowerCase();
      // S ska fungera även om ett 4/6-minutersval (radioknapp) fortfarande har fokus.
      // Blockera bara när användaren faktiskt skriver i ett text-/nummerfält eller väljer i en lista.
      const isTypingField = tag==="textarea" || tag==="select" ||
        (tag==="input" && !["radio","checkbox","button","submit"].includes(inputType));
      if(isTypingField || els.tournamentDialog.classList.contains("hidden")===false || els.helpDialog.classList.contains("hidden")===false) return;
      e.preventDefault();
      toggle();
    }
  });
  document.addEventListener("keydown",(e)=>{
    if(e.key==="Escape"){
      if(!els.helpDialog.classList.contains("hidden")) els.helpDialog.classList.add("hidden");
      if(!els.tournamentDialog.classList.contains("hidden")) els.tournamentDialog.classList.add("hidden");
    }
  });
  els.minusSec.onclick=()=>adjustTime(-1);
  els.plusSec.onclick=()=>adjustTime(1);
  els.resetBtn.onclick=()=>{
    if(window.confirm("Vill du verkligen nollställa matchen?")) resetState();
  };
  els.btn4.onclick=()=>{ if(!state.hasStarted){ state.matchLength=4; resetState(); els.btn4.blur(); } };
  els.btn6.onclick=()=>{ if(!state.hasStarted){ state.matchLength=6; resetState(); els.btn6.blur(); } };
  els.matchMinus.onclick=()=>changeMatchNumber(-1);
  els.matchPlus.onclick=()=>changeMatchNumber(1);
  els.matchNumber.addEventListener("input",()=>{ els.matchNumber.value=els.matchNumber.value.replace(/\D/g,""); broadcast(); });


  let publicWindow = null;
  const PUBLIC_WINDOW_NAME = "brottarklocka_presentation";

  function openPublicScreen(){
    broadcast();

    try{
      if(publicWindow && !publicWindow.closed){
        // Återanvänd alltid samma separata presentationsfönster.
        try{
          publicWindow.postMessage({type:"brottarklocka-focus"}, "*");
        }catch(e){}
        return true;
      }

      const w = (window.screen && window.screen.availWidth) ? window.screen.availWidth : 1280;
      const h = (window.screen && window.screen.availHeight) ? window.screen.availHeight : 800;

      // Öppna popupen direkt från musklicket och navigera därefter. Det ger
      // webbläsaren starkast möjliga signal om att detta ska vara ett separat fönster.
      const features = `popup=yes,left=40,top=40,width=${Math.max(900,w-80)},height=${Math.max(650,h-80)},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`;
      publicWindow = window.open("about:blank", PUBLIC_WINDOW_NAME, features);

      if(publicWindow){
        try{
          publicWindow.opener = window;
          publicWindow.resizeTo(Math.max(900,w-80), Math.max(650,h-80));
          publicWindow.moveTo(40,40);
          publicWindow.location.replace("public.html?autofullscreen=1");
          publicWindow.focus();
        }catch(e){
          try{ publicWindow.location.href = "public.html?autofullscreen=1"; }catch(_){}
        }
      }

      return !!publicWindow;
    }catch(e){
      return false;
    }
  }

  // Publikskärmen öppnas endast manuellt.
  els.publicBtn.onclick=()=>openPublicScreen();

  // Lås skärmen vaken där webbläsaren stöder det.
  let wakeLock = null;
  async function requestWakeLock(){
    try{
      if("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    }catch(e){}
  }
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") requestWakeLock(); });
  requestWakeLock();


  function initTournamentFilters(){
    const currentYear = new Date().getFullYear();

    if(els.yearSelect){
      els.yearSelect.innerHTML = "";
      for(let y=currentYear+1; y>=2007; y--){
        const option=document.createElement("option");
        option.value=String(y);
        option.textContent=String(y);
        if(y===currentYear) option.selected=true;
        els.yearSelect.appendChild(option);
      }
    }

    let saved=null;
    try{
      saved=JSON.parse(localStorage.getItem("brottarklocka_filter") || "null");
    }catch{}

    if(saved){
      if(els.yearSelect && saved.year && [...els.yearSelect.options].some(o=>o.value===String(saved.year))){
        els.yearSelect.value=String(saved.year);
      }
      if(els.countrySelect && saved.country && [...els.countrySelect.options].some(o=>o.value===saved.country)){
        els.countrySelect.value=saved.country;
      }
    }

    const reload=()=>{
      localStorage.setItem("brottarklocka_filter", JSON.stringify({
        year: els.yearSelect?.value || String(currentYear),
        country: els.countrySelect?.value || "SE"
      }));
      loadTournaments();
    };

    els.yearSelect?.addEventListener("change", reload);
    els.countrySelect?.addEventListener("change", reload);
  }

  initTournamentFilters();
  // Ta bort äldre cache-service-workers så nya versioner syns direkt.
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()))
      .catch(()=>{});
  }

  render();
})();

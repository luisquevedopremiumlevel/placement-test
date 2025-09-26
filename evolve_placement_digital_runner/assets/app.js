
const $=(s,e=document)=>e.querySelector(s);const $$=(s,e=document)=>Array.from(e.querySelectorAll(s));
let CONFIG=null;
let state={startedAt:null,candidate:{name:"",email:"",group:""},sectionIndex:0,answers:{},audioPlayed:{},timers:{},finished:false,score:0,level:null};

function loadConfig(f){return fetch(f).then(r=>r.json());}
function save(){localStorage.setItem("evolve_placement_state",JSON.stringify(state));}
function restore(){try{const raw=localStorage.getItem("evolve_placement_state");if(raw){state=Object.assign(state,JSON.parse(raw));}}catch{}}
function formatSeconds(s){const m=Math.floor(s/60).toString().padStart(2,"0");const r=(s%60).toString().padStart(2,"0");return `${m}:${r}`;}
function startTimerForSection(idx){const sec=CONFIG.sections[idx];if(!sec.timer_seconds)return; if(!state.timers[idx]) state.timers[idx]=sec.timer_seconds;const t=$("#timer");t.classList.remove("hidden");const id=setInterval(()=>{if(state.finished||state.sectionIndex!==idx){clearInterval(id);return;}state.timers[idx]=Math.max(0,state.timers[idx]-1);t.textContent=formatSeconds(state.timers[idx]);if(state.timers[idx]===0){clearInterval(id);nextSection();}save();},1000);t.textContent=formatSeconds(state.timers[idx]);}
function nextSection(){state.sectionIndex++;save();render();}
function mapLevel(score,map){if(!map)return null;for(const r of map){if(score>=r.min && score<=r.max)return r.level;}return null;}
function finalize(){let score=0;CONFIG.sections.forEach(sec=>sec.items.forEach(it=>{if(it.type==="mcq1"){const ans=state.answers[it.id];if(ans!==undefined && ans==it.answer_value)score+=(it.weight||1);}}));state.score=score;state.level=mapLevel(score,CONFIG.meta.level_map);state.finished=true;save();render();}
function exportCSV(){const rows=[];rows.push(["timestamp","name","email","group","score","level"]);rows.push([new Date().toISOString(),state.candidate.name,state.candidate.email,state.candidate.group,state.score,state.level]);rows.push([]);rows.push(["item_id","answer"]);Object.entries(state.answers).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,v])=>rows.push([k,v]));const csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="evolve_placement_attempt.csv";a.click();URL.revokeObjectURL(url);}

function render(){
  const app=$("#app");app.innerHTML="";
  const header=document.createElement("div");header.className="card";header.innerHTML=`<h1>${CONFIG.meta.title}</h1>
  <div class="row"><div><small>Version ${CONFIG.meta.version}</small></div><div style="text-align:right"><span class="badge">${CONFIG.meta.provider||"Premium Level"}</span></div></div>`;app.appendChild(header);

  if(!state.startedAt){
    const gate=document.createElement("div");gate.className="card";gate.innerHTML=`
      <h2>Candidate Info</h2>
      <div class="kv">
        <div>Full name</div><div><input id="cand_name" type="text" placeholder="e.g., Sofia Hernández" /></div>
        <div>Email</div><div><input id="cand_email" type="text" placeholder="name@example.com" /></div>
        <div>Group/Branch</div><div><input id="cand_group" type="text" placeholder="Optional"/></div>
      </div><hr/>
      <div class="row">
        <div><button id="btnStart">Start test</button></div>
        <div><label class="choice"><input type="checkbox" id="ackRules"> I will not refresh, use back button, or play audios more than once.</label></div>
      </div><small>Note: Your progress is auto-saved in this browser only.</small>`;
    app.appendChild(gate);
    $("#btnStart").onclick=()=>{const name=$("#cand_name").value.trim();const email=$("#cand_email").value.trim();if(!name||!email){alert("Please fill name and email");return;}if(!$("#ackRules").checked){alert("Please accept the rules");return;}state.candidate={name,email,group:$("#cand_group").value.trim()};state.startedAt=new Date().toISOString();save();render();};
    return;
  }

  if(state.finished){
    const res=document.createElement("div");res.className="card";res.innerHTML=`
      <h2>Result</h2>
      <p><b>Name:</b> ${state.candidate.name} &nbsp; <b>Email:</b> ${state.candidate.email}</p>
      <p><b>Score:</b> ${state.score} / ${CONFIG.meta.max_score}</p>
      <p><b>Suggested level:</b> <span class="badge">${state.level||"-"}</span></p>
      <div class="row"><button class="btn-ok" id="btnExport">Export CSV</button><button class="btn-outline" id="btnRestart">Restart</button></div>
      <small>Tip: share the CSV with Academic Coordination.</small>`;
    app.appendChild(res);
    $("#btnExport").onclick=exportCSV;
    $("#btnRestart").onclick=()=>{if(confirm("Clear all data and restart?")){localStorage.removeItem("evolve_placement_state");state={startedAt:null,candidate:{},sectionIndex:0,answers:{},audioPlayed:{},timers:{},finished:false,score:0,level:null};render();}};
    return;
  }

  const sec=CONFIG.sections[state.sectionIndex];const nav=document.createElement("div");nav.className="card";nav.innerHTML=`
    <div class="row" style="align-items:center">
      <div><h2>${sec.title}</h2><small>${sec.instructions||""}</small></div>
      <div style="text-align:right"><span class="badge">Section ${state.sectionIndex+1} of ${CONFIG.sections.length}</span><br/><span id="timer" class="timer ${sec.timer_seconds?'':'hidden'}"></span></div>
    </div>`;app.appendChild(nav);

  const wrap=document.createElement("div");wrap.className="card";
  sec.items.forEach(item=>{
    const q=document.createElement("div");q.className="question";q.innerHTML=`<div><b>${item.label||""}</b></div>`;
    if(item.type==="audio"){
      const audio=document.createElement("audio");audio.src=item.asset;audio.controls=true;
      if(state.audioPlayed[item.asset]){audio.controls=false;const warn=document.createElement("div");warn.className="warning";warn.textContent="Audio already played once for this attempt.";q.appendChild(warn);}
      audio.addEventListener("play",()=>{if(state.audioPlayed[item.asset]){audio.pause();return;}state.audioPlayed[item.asset]=true;save();audio.addEventListener("ended",()=>{audio.controls=false;save();},{once:true});},{once:true});
      q.appendChild(audio);
    }
    if(item.type==="mcq1"){
      item.choices.forEach((c,i)=>{const id=`${item.id}_${i}`;const lab=document.createElement("label");lab.className="choice";lab.innerHTML=`<input type="radio" name="${item.id}" id="${id}" value="${c.value}"/> ${c.text}`;q.appendChild(lab);});
      const v=state.answers[item.id];if(v!==undefined){const radio=$(`input[name="${item.id}"][value="${v}"]`,q);if(radio)radio.checked=true;}
      q.addEventListener("change",(e)=>{if(e.target && e.target.name===item.id){state.answers[item.id]=e.target.value;save();}});
    }
    wrap.appendChild(q);
  });
  app.appendChild(wrap);

  const actions=document.createElement("div");actions.className="card";actions.innerHTML=`
    <div class="row"><button class="btn-outline" id="btnPrev" ${state.sectionIndex===0?'disabled':''}>Back</button><div style="flex:2"></div><button id="btnNext">${state.sectionIndex===CONFIG.sections.length-1?'Finish':'Next section'}</button></div><small>Progress is auto-saved. Do not refresh the page.</small>`;
  app.appendChild(actions);
  $("#btnPrev").onclick=()=>{if(state.sectionIndex>0){state.sectionIndex--;save();render();}};
  $("#btnNext").onclick=()=>{if(state.sectionIndex===CONFIG.sections.length-1){finalize();}else{state.sectionIndex++;save();render();}};
  startTimerForSection(state.sectionIndex);
}

async function boot(){
  restore();
  const file=new URLSearchParams(location.search).get("config") || "assets/EVOLVE_config.json";
  CONFIG=await loadConfig(file);
  CONFIG.meta.max_score=CONFIG.sections.reduce((s,sec)=>s+sec.items.reduce((x,it)=>x+(it.weight||(it.type==='mcq1'?1:0)),0),0);
  render();
}
window.addEventListener("load",boot);

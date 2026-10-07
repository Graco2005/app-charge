// ══════════════════════════════════════════
// DATA
// ══════════════════════════════════════════
const DB={
  get(k,d){try{return JSON.parse(localStorage.getItem('charge_'+k))??d}catch{return d}},
  set(k,v){localStorage.setItem('charge_'+k,JSON.stringify(v))}
};
let plans=DB.get('plans',[]);
let sessions=DB.get('sessions',[]);
let session=null;
const uid=()=>Math.random().toString(36).slice(2,9);
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'});
const activePlan=()=>plans.find(p=>p.active)||plans[0]||null;
const save=()=>{DB.set('plans',plans);DB.set('sessions',sessions)};

// ── AUTOSAVE DE SESSÃO ──
// Persiste a sessão em andamento a cada 30s e ao interagir com inputs,
// para que nada seja perdido se o app fechar ou o navegador reiniciar.
const SESSION_KEY='charge_draft_session';
function saveSessionDraft(){
  if(!session)return;
  saveSessionExtras(); // coleta valores do DOM antes de serializar
  try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch(e){}
}
function loadSessionDraft(){
  try{const d=localStorage.getItem(SESSION_KEY);return d?JSON.parse(d):null;}catch{return null;}
}
function clearSessionDraft(){
  try{localStorage.removeItem(SESSION_KEY);}catch(e){}
}
let _autosaveTimer=null;
function startAutosave(){
  clearInterval(_autosaveTimer);
  _autosaveTimer=setInterval(()=>{if(session)saveSessionDraft();},30000);
}

function toast(msg,type='success'){
  const c=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<span class="toast-icon">${type==='success'?'✓':'⚠'}</span> ${msg}`;
  c.appendChild(t);setTimeout(()=>t.remove(),3000);
}

// ══════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('sidebarOverlay').classList.add('open');document.body.style.overflow='hidden'}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('open');document.body.style.overflow=''}

// ══════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════
function switchScreen(id,el){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  if(id==='screenHome')renderHome();
  if(id==='screenPlans')renderPlans();
  if(id==='screenHistory')renderHistory();
  if(id==='screenStats')renderStats();
}

// ══════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════
function showModal(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden'}
function closeModal(id){document.getElementById(id).classList.remove('open');document.body.style.overflow=''}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));

// ══════════════════════════════════════════
// HOME
// ══════════════════════════════════════════
function getWeekDays(){
  const now=new Date(),day=now.getDay();
  const mon=new Date(now);mon.setDate(now.getDate()-(day===0?6:day-1));
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d.toISOString().slice(0,10)});
}

function renderWeekBar(){
  const wd=getWeekDays();
  const labels=['S','T','Q','Q','S','S','D'];
  const ts=today();
  const el=document.getElementById('weekBarSegments');if(!el)return;
  let workouts=0;
  el.innerHTML=wd.map((d,i)=>{
    const s=sessions.find(x=>x.date===d);
    const isToday=d===ts,isFuture=d>ts;
    let bg='var(--border)',txt='',clr='var(--text-dim)',title='Sem registro';
    if(s&&s.type==='workout'){bg='var(--yellow)';clr='#000';txt='⚡';title='Treino '+s.splitLetter;workouts++;}
    else if(s&&s.type==='rest'){bg='var(--blue)';clr='#fff';txt='🛌';title='Descanso';}
    else if(isFuture){bg='rgba(42,42,58,0.4)';}
    const ring=isToday?'box-shadow:0 0 0 2px var(--accent),0 0 0 4px rgba(255,77,0,0.2);':'';
    const isPast2=d<ts;
    const clickAttr=isPast2?`onclick="openRetroLog('${d}')" title="Registrar treino em ${fmtDate(d)}" style="flex:1;height:32px;border-radius:6px;background:${bg};${ring}display:flex;align-items:center;justify-content:center;font-size:${s?'0.85rem':'0.6rem'};font-weight:700;color:${clr};transition:all 0.3s;cursor:pointer"`:`style="flex:1;height:32px;border-radius:6px;background:${bg};${ring}display:flex;align-items:center;justify-content:center;font-size:${s?'0.85rem':'0.6rem'};font-weight:700;color:${clr};transition:all 0.3s;cursor:${isFuture?'not-allowed':'default'}"`;
    return `<div ${clickAttr}>${txt||(isToday?'<span style="color:var(--accent)">●</span>':labels[i])}</div>`;
  }).join('');
  const wEl=document.getElementById('chargeBarLabel');
  if(wEl)wEl.textContent=`${workouts} treino${workouts!==1?'s':''} esta semana`;
}

function renderWeekStrip(){
  const wd=getWeekDays(),labels=['S','T','Q','Q','S','S','D'],ts=today();
  document.getElementById('weekStreak').innerHTML=wd.map((d,i)=>{
    const s=sessions.find(x=>x.date===d);
    const isPast=d<ts, isToday=d===ts, isFuture=d>ts;
    let cls=isToday?'streak-day today':'streak-day',icon='';
    if(isPast) cls+=' past';
    if(s){if(s.type==='workout'){cls+=' done';icon='⚡';}else{cls+=' rest';icon='🛌';}}
    const click=isPast?`onclick="openRetroLog('${d}')" title="Registrar treino em ${fmtDate(d)}"`:
                isToday?`title="Hoje"`:
                `title="Futuro" style="opacity:0.35;cursor:not-allowed"`;
    return `<div class="${cls}" ${click}><span style="font-size:0.8rem">${icon||labels[i]}</span><span>${labels[i]}</span></div>`;
  }).join('');
}

function renderHome(){
  const plan=activePlan(),ts=today(),todaySess=sessions.find(s=>s.date===ts);
  document.getElementById('homeDateLabel').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  if(!plan){
    document.getElementById('homeEmpty').style.display='block';
    document.getElementById('homeActive').style.display='none';
    return;
  }
  document.getElementById('homeEmpty').style.display='none';
  document.getElementById('homeActive').style.display='block';
  const h=new Date().getHours();
  let userName = DB.get('userName', '');
  if (!userName) {
    userName = prompt('Como você gostaria de ser chamado?') || 'Atleta';
    DB.set('userName', userName);
  }
  document.getElementById('homeGreeting').textContent=(h<12?'Bom dia, ':h<18?'Boa tarde, ':'Boa noite, ')+userName+'!';
  document.getElementById('homeSubtitle').textContent=todaySess?(todaySess.type==='rest'?'Hoje é dia de descanso 🛌':`Treino ${todaySess.splitLetter} registrado hoje!`):`Plano ativo: ${plan.name}`;
  renderWeekBar();
  renderWeekStrip();
  renderDraftBanner();
  renderTodayAction(todaySess,plan);
}

function renderTodayAction(todaySess,plan){
  const el=document.getElementById('todayActionArea');
  if(todaySess){
    if(todaySess.type==='rest'){
      el.innerHTML=`
        <div class="card" style="text-align:center;padding:24px;border-color:var(--blue);background:var(--blue-dim)">
          <div style="font-size:2.5rem;margin-bottom:8px">🛌</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:600;color:var(--blue)">Dia de Descanso Registrado</div>
          ${todaySess.note?`<div style="font-size:0.8rem;color:var(--text-sec);margin-top:6px">${todaySess.note}</div>`:''}
          <button class="btn btn-danger btn-sm" style="margin-top:16px" onclick="removeRestDay()">🗑 Remover Descanso</button>
        </div>`;
    } else {
      el.innerHTML=`
        <div class="today-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div class="today-split-label">${todaySess.splitLetter}</div>
            <div>
              <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1rem">${todaySess.splitName}</div>
              <div class="plan-active-indicator"><div class="active-dot"></div>Treino registrado</div>
            </div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-sec)">${todaySess.exercises.length} exercícios realizados</div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="viewSession('${todaySess.date}')">Ver detalhes →</button>
            <button class="btn btn-sm" style="flex:1;background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(255,209,102,0.3)" onclick="editTodaySession()">✎ Editar</button>
          </div>
        </div>`;
    }
    return;
  }
  const lastWorkout=[...sessions].reverse().find(s=>s.type==='workout');
  let nextIdx=0;
  if(lastWorkout){const idx=plan.splits.findIndex(s=>s.letter===lastWorkout.splitLetter);nextIdx=(idx+1)%plan.splits.length;}
  const ns=plan.splits[nextIdx];
  el.innerHTML=`
    <div class="today-card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div class="today-split-label">${ns.letter}</div>
        <div>
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1rem">${ns.name}</div>
          <div style="font-size:0.78rem;color:var(--text-sec)">Próximo na sequência</div>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-sec);margin-bottom:14px">${ns.exercises.length} exercícios</div>
      <div class="home-actions">
        <button class="btn btn-primary" style="flex:2" onclick="startSession('${plan.id}','${ns.letter}')">⚡ Iniciar Treino</button>
        <button class="btn btn-secondary" style="flex:1" onclick="showModal('modalChooseSplit');renderChooseSplit()">Outro</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════
// PLANS
// ══════════════════════════════════════════
function renderPlans(){
  const el=document.getElementById('plansList');
  if(!plans.length){el.innerHTML=`<div class="empty-state"><span class="empty-icon">📋</span><div class="empty-title">Nenhum treino cadastrado</div><div class="empty-sub">Crie sua primeira divisão de treino.</div></div>`;return;}
  el.innerHTML=plans.map(p=>{
    const createdDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : 'Data desconhecida';
    return `
    <div class="training-card ${p.active?'active-plan':''}">
      <div class="training-card-letter" style="${p.active?'background:var(--accent);color:#fff;box-shadow:0 0 14px var(--accent-glow)':''}">${p.splits[0]?.letter||'?'}</div>
      <div class="training-card-info">
        <div class="training-card-name">${p.name}</div>
        <div class="training-card-meta">Div. ${p.splits.map(s=>s.letter).join('')} · ${p.splits.length} dias · ${p.splits.reduce((a,s)=>a+s.exercises.length,0)} exercícios${p.active?' · <span style="color:var(--green)">⚡ Ativo</span>':''}</div>
        <div class="training-card-meta" style="margin-top:2px; font-size:0.75rem; color:var(--text-dim)">Criado em: ${createdDate}</div>
      </div>
      <div class="training-card-actions">
        ${!p.active?`<button class="btn btn-icon" title="Ativar" onclick="activatePlan('${p.id}')">▶</button>`:''}
        <button class="btn btn-icon" title="Copiar Treino" onclick="copyPlanToClipboard('${p.id}')">📋</button>
        <button class="btn btn-icon" title="Editar" onclick="editPlan('${p.id}')">✎</button>
        <button class="btn btn-icon btn-danger" title="Excluir" onclick="deletePlan('${p.id}')">🗑</button>
      </div>
    </div>`
  }).join('');
}

function activatePlan(id){plans.forEach(p=>p.active=p.id===id);save();renderPlans();toast('Plano ativado!')}
function deletePlan(id){
  if(!confirm('Excluir este plano de treino?'))return;
  plans=plans.filter(p=>p.id!==id);save();renderPlans();toast('Plano removido.','error');
}
function editPlan(id){
  const plan=plans.find(p=>p.id===id);if(!plan)return;
  wizardState={step:2,freq:plan.splits.length,planName:plan.name,
    splits:plan.splits.map(s=>({...s,exercises:s.exercises.map(e=>({...e,seriesConfig:[...(e.seriesConfig||[])]})) })),
    editId:id,currentSplitIdx:0};
  document.getElementById('wizardTitle').textContent='Editar Treino';
  showModal('modalNewPlan');renderWizardStep();
}

function copyPlanToClipboard(id) {
  const plan = plans.find(p => p.id === id);
  if (!plan) return;
  
  let text = `⚡ Treino: ${plan.name}\n`;
  if (plan.createdAt) {
    text += `Criado em: ${new Date(plan.createdAt).toLocaleDateString('pt-BR')}\n\n`;
  } else {
    text += `\n`;
  }
  
  plan.splits.forEach(split => {
    text += `--- Divisão ${split.letter}: ${split.name} ---\n`;
    split.exercises.forEach((ex, idx) => {
      let exText = `${idx + 1}. ${ex.name}`;
      if (ex.technique && ex.technique !== 'Normal') {
        exText += ` (${ex.technique})`;
      }
      
      const seriesList = ex.seriesConfig || [];
      if (seriesList.length) {
        const seriesInfo = seriesList.map((sc, si) => {
          let sInfo = `S${si+1}: `;
          if (sc.type !== 'Normal') sInfo += sc.type;
          else if (sc.reps) sInfo += `${sc.reps}`;
          else sInfo += '?';
          return sInfo;
        }).join(', ');
        exText += `\n   ↳ ${seriesList.length}x [${seriesInfo}]`;
      } else {
        exText += `\n   ↳ ${ex.sets || 0} séries`;
      }
      if (ex.obs) {
        exText += `\n   📌 Obs: ${ex.obs}`;
      }
      text += exText + `\n`;
    });
    text += `\n`;
  });
  
  navigator.clipboard.writeText(text).then(() => {
    toast('Treino copiado para a área de transferência! 📋');
  }).catch(err => {
    toast('Erro ao copiar treino.', 'error');
  });
}

// ══════════════════════════════════════════
// WIZARD
// ══════════════════════════════════════════
const FREQ_OPTIONS=[{label:'AB',desc:'2 dias',n:2},{label:'ABC',desc:'3 dias',n:3},{label:'ABCD',desc:'4 dias',n:4},{label:'ABCDE',desc:'5 dias',n:5}];
const LETTERS=['A','B','C','D','E'];
const TECHNIQUES=['Normal','Myo-Reps','Rest-Pause','Cluster','Drop-Set','Super-Série','Bi-Set', 'Muscle-Round'];
const SERIES_TYPES=['Normal','RIR 0','RIR 1','RIR 2','RIR 3','Myo-Reps','Rest-Pause','Cluster','Drop-Set'];
let wizardState={step:0,freq:3,planName:'',splits:[],editId:null,currentSplitIdx:0};

function openNewPlanWizard(){
  wizardState={step:0,freq:3,planName:'',splits:[],editId:null,currentSplitIdx:0};
  document.getElementById('wizardTitle').textContent='Nova Divisão de Treino';
  showModal('modalNewPlan');renderWizardStep();
}

function renderWizardStep(){
  const stepsEl = document.getElementById('wizardSteps');
  if(wizardState.editId){
    stepsEl.style.display = 'none';
  } else {
    stepsEl.style.display = 'flex';
    const total=3+wizardState.splits.length;
    stepsEl.innerHTML=Array.from({length:total},(_,i)=>`<div class="step-dot ${i<wizardState.step?'done':''}"></div>`).join('');
  }
  document.getElementById('wizardBtnBack').style.display=wizardState.step===0?'none':'';
  const c=document.getElementById('wizardContent');
  if(wizardState.step===0){
    document.getElementById('wizardBtnNext').textContent='Próximo →';
    c.innerHTML=`
      <div class="form-group"><div class="form-label">Nome do Plano</div><input type="text" id="wPlanName" placeholder="Ex: Hipertrofia 2026" value="${wizardState.planName}"></div>
      <div class="form-label" style="margin-bottom:10px">Frequência semanal</div>
      <div class="freq-grid">${FREQ_OPTIONS.map(f=>`<div class="freq-btn ${wizardState.freq===f.n?'selected':''}" onclick="selectFreq(${f.n},this)"><div class="freq-btn-label">${f.label}</div><div class="freq-btn-sub">${f.desc}</div></div>`).join('')}</div>`;
  } else if(wizardState.step===1){
    document.getElementById('wizardBtnNext').textContent='Próximo →';
    while(wizardState.splits.length<wizardState.freq)wizardState.splits.push({letter:LETTERS[wizardState.splits.length],name:'',exercises:[]});
    wizardState.splits=wizardState.splits.slice(0,wizardState.freq);
    c.innerHTML=`
      <p style="font-size:0.85rem;color:var(--text-sec);margin-bottom:16px">Dê um nome para cada dia de treino.</p>
      ${wizardState.splits.map((s,i)=>`<div class="division-row"><div class="division-letter">${s.letter}</div><input type="text" id="wSplit${i}" placeholder="Ex: Perna, Upper, Push..." value="${s.name}"></div>`).join('')}`;
  } else {
    const si=wizardState.step-2;
    if(si>=wizardState.splits.length){
      document.getElementById('wizardBtnNext').textContent='⚡ Ativar Treino';
      c.innerHTML=`
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:2.5rem;margin-bottom:8px">⚡</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;font-weight:700;margin-bottom:4px">${wizardState.planName}</div>
          <div style="color:var(--text-sec);font-size:0.85rem">Divisão ${wizardState.splits.map(s=>s.letter).join('')}</div>
        </div>
        ${wizardState.splits.map(s=>`
          <div class="card" style="margin-bottom:8px">
            <div class="card-header" style="margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px"><div class="division-letter">${s.letter}</div><div style="font-weight:600">${s.name}</div></div>
              <div class="badge badge-dim">${s.exercises.length} exerc.</div>
            </div>
            ${s.exercises.map(e=>`<div style="font-size:0.82rem;color:var(--text-sec);padding:3px 0;display:flex;gap:6px"><span>•</span><span>${e.name} — ${(e.seriesConfig||[]).length||e.sets||0}x</span>${e.technique!=='Normal'?`<span class="badge badge-purple" style="padding:1px 6px">${e.technique}</span>`:''}</div>`).join('')}
          </div>`).join('')}`;
      return;
    }
    document.getElementById('wizardBtnNext').textContent=si<wizardState.splits.length-1?'Próximo →':'Revisar ✓';
    wizardState.currentSplitIdx=si;
    const split=wizardState.splits[si];
    const splitTabs = wizardState.splits.map((s, idx) => `
      <div onclick="jumpToSplit(${idx})" style="padding: 8px 12px; border-bottom: 2px solid ${idx === si ? 'var(--accent)' : 'transparent'}; color: ${idx === si ? 'var(--text)' : 'var(--text-sec)'}; cursor: pointer; font-weight: 600; display:flex; align-items:center; gap: 6px; white-space:nowrap; transition:all 0.2s;">
        <div class="division-letter" style="width:24px;height:24px;font-size:0.8rem;${idx === si ? '' : 'background:var(--border);color:var(--text-sec)'}">${s.letter}</div>
        ${s.name}
      </div>
    `).join('');
    c.innerHTML=`
      <div style="display:flex; overflow-x:auto; margin-bottom: 16px; border-bottom: 1px solid var(--border); gap:8px;">
        ${splitTabs}
      </div>
      <div id="splitExerciseList">${renderExerciseListHTML(split.exercises)}</div>
      <button class="btn btn-secondary btn-sm btn-block" style="margin-top:10px" onclick="openAddExercise(${si})">+ Adicionar Exercício</button>`;
  }
  if(wizardState.editId){
    const btnNext = document.getElementById('wizardBtnNext');
    if(btnNext) btnNext.textContent = 'Salvar Alterações ✓';
  }
}

function renderExerciseListHTML(exercises){
  if(!exercises.length)return`<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:16px">Nenhum exercício ainda</div>`;
  return exercises.map((e,i)=>`
    <div class="exercise-item">
      <div class="exercise-item-header">
        <div style="flex:1">
          <div class="exercise-item-name">${e.name}</div>
          <div class="exercise-item-meta">
            <span>${(e.seriesConfig||[]).length||e.sets||0} séries</span>
            ${e.technique&&e.technique!=='Normal'?`<span class="badge badge-purple" style="padding:2px 6px;font-size:0.65rem">${e.technique}</span>`:''}
          </div>
          ${(e.seriesConfig||[]).length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${e.seriesConfig.map((sc,si)=>`<span style="font-size:0.65rem;padding:1px 6px;border-radius:10px;background:var(--border);color:var(--text-dim)">S${si+1}:${sc.type!=='Normal'?sc.type:sc.reps||'?'}</span>`).join('')}</div>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon" title="Editar" onclick="openAddExercise(${wizardState.currentSplitIdx},${i})">✎</button>
          <button class="btn btn-icon btn-danger" title="Remover" onclick="removeExercise(${wizardState.currentSplitIdx},${i})">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function selectFreq(n,el){
  wizardState.freq=n;
  document.querySelectorAll('.freq-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
}

function saveCurrentStepState() {
  if(wizardState.step===0){
    const name=document.getElementById('wPlanName')?.value?.trim();
    if(name) wizardState.planName=name;
  } else if(wizardState.step===1){
    for(let i=0;i<wizardState.splits.length;i++){
      const v=document.getElementById(`wSplit${i}`)?.value?.trim();
      if(v) wizardState.splits[i].name=v;
    }
  }
}

function wizardNext(){
  saveCurrentStepState();
  while(wizardState.splits.length<wizardState.freq)wizardState.splits.push({letter:LETTERS[wizardState.splits.length],name:'',exercises:[]});
  wizardState.splits=wizardState.splits.slice(0,wizardState.freq);

  if(!wizardState.planName){toast('Dê um nome ao plano!','error');return;}
  // We only require split names if they actually progressed to step 1 or are saving.
  // Wait, if they are just moving from step 0 to step 1, they don't have split names yet.
  // So validation depends on the action.
  
  if(wizardState.editId){
    if(wizardState.splits.some(s=>!s.name)){toast('Nomeie todos os treinos!','error');return;}
    savePlan();
    return;
  }
  
  if(wizardState.step===0){
    wizardState.step=1;
  } else if(wizardState.step===1){
    if(wizardState.splits.some(s=>!s.name)){toast('Nomeie todos os treinos!','error');return;}
    wizardState.step=2;
  } else {
    const si=wizardState.step-2;
    if(si<wizardState.splits.length)wizardState.step++;
    else{savePlan();return;}
  }
  renderWizardStep();
}
function wizardBack(){
  saveCurrentStepState();
  if(wizardState.step>0)wizardState.step--;
  renderWizardStep();
}

function jumpToSplit(idx){
  saveCurrentStepState();
  wizardState.step=2+idx;
  renderWizardStep();
}

function savePlan(){
  const np={id:wizardState.editId||uid(),name:wizardState.planName,splits:wizardState.splits,active:true,createdAt:new Date().toISOString()};
  plans.forEach(p=>p.active=false);
  if(wizardState.editId)plans=plans.map(p=>p.id===wizardState.editId?np:p);
  else plans.push(np);
  save();closeModal('modalNewPlan');toast('Treino ativado com sucesso! ⚡');renderHome();renderPlans();
}

// ══════════════════════════════════════════
// EXERCISE EDITOR
// ══════════════════════════════════════════
let exState={splitIdx:0,editIdx:null};
let exSeriesRows=[];

function openAddExercise(splitIdx,editIdx=null){
  exState={splitIdx,editIdx};
  const ex=editIdx!==null?wizardState.splits[splitIdx].exercises[editIdx]:null;
  if(ex&&ex.seriesConfig&&ex.seriesConfig.length)exSeriesRows=ex.seriesConfig.map(s=>({...s}));
  else if(ex)exSeriesRows=Array.from({length:ex.sets||4},()=>({reps:'',type:'Normal'}));
  else exSeriesRows=[{reps:'',type:'Normal'},{reps:'',type:'Normal'},{reps:'',type:'Normal'},{reps:'',type:'Normal'}];
  document.getElementById('exModalTitle').textContent=ex?'Editar Exercício':'Adicionar Exercício';
  renderExerciseModal(ex);showModal('modalExercise');
}

function renderExerciseModal(ex){
  document.getElementById('exModalBody').innerHTML=`
    <div class="form-group">
      <label class="form-label">Nome do Exercício</label>
      <input type="text" id="exName" placeholder="Ex: Cadeira Flexora" value="${ex?.name||''}">
    </div>
    <div class="form-group">
      <label class="form-label">Técnica geral</label>
      <div class="technique-chips" id="techniqueChips">
        ${TECHNIQUES.map(t=>`<button class="technique-chip ${t==='Normal'?'t-normal':''} ${(ex?.technique||'Normal')===t?'selected':''}" onclick="selectTechnique(this)">${t}</button>`).join('')}
      </div>
    </div>
    <div class="form-label" style="margin-top:4px;margin-bottom:8px">Séries e Repetições</div>
    <div class="series-config-table" id="exSeriesTable">${renderExSeriesTable()}</div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="series-add-row-btn" style="flex:1" onclick="addExSeriesRow()">+ Adicionar série</button>
      <button class="series-add-row-btn" style="flex:1;border-color:rgba(255,85,85,0.3);color:rgba(255,85,85,0.7)" onclick="removeLastExSeriesRow()">− Remover última</button>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label class="form-label">Observações</label>
      <input type="text" id="exObs" placeholder="Ex: Pegada neutra, lenta na descida..." value="${ex?.obs||''}">
    </div>`;
}

function renderExSeriesTable(){
  return exSeriesRows.map((row,i)=>`
    <div class="series-config-row" id="exRow${i}">
      <div class="series-config-label">S${i+1}</div>
      <input class="series-config-input" type="text" placeholder="Reps (ex:12)" value="${row.reps||''}" onchange="exSeriesRows[${i}].reps=this.value" style="width:80px;min-width:0">
      <select class="series-config-type" onchange="exSeriesRows[${i}].type=this.value">${SERIES_TYPES.map(t=>`<option value="${t}" ${row.type===t?'selected':''}>${t}</option>`).join('')}</select>
    </div>`).join('');
}

function addExSeriesRow(){
  exSeriesRows.push({reps:'',type:'Normal'});
  document.getElementById('exSeriesTable').innerHTML=renderExSeriesTable();
}
function removeLastExSeriesRow(){
  if(exSeriesRows.length<=1){toast('Mínimo de 1 série!','error');return;}
  exSeriesRows.pop();
  document.getElementById('exSeriesTable').innerHTML=renderExSeriesTable();
}
function selectTechnique(btn){
  document.querySelectorAll('.technique-chip').forEach(c=>c.classList.remove('selected'));
  btn.classList.add('selected');
}
function saveExercise(){
  const name=document.getElementById('exName')?.value?.trim();
  if(!name){toast('Informe o nome do exercício!','error');return;}
  const obs=document.getElementById('exObs')?.value?.trim();
  const tech=document.querySelector('.technique-chip.selected')?.textContent||'Normal';
  const finalRows=exSeriesRows.map((row,i)=>{
    const rowEl=document.getElementById(`exRow${i}`);
    const repInp=rowEl?.querySelector('input');
    const typeInp=rowEl?.querySelector('select');
    return{reps:repInp?.value||row.reps||'',type:typeInp?.value||row.type||'Normal'};
  });
  const exercise={id:uid(),name,sets:finalRows.length,seriesConfig:finalRows,technique:tech,obs};
  const split=wizardState.splits[exState.splitIdx];
  if(exState.editIdx!==null)split.exercises[exState.editIdx]=exercise;
  else split.exercises.push(exercise);
  closeModal('modalExercise');
  const listEl=document.getElementById('splitExerciseList');
  if(listEl)listEl.innerHTML=renderExerciseListHTML(split.exercises);
}
function removeExercise(splitIdx,exIdx){
  wizardState.splits[splitIdx].exercises.splice(exIdx,1);
  const listEl=document.getElementById('splitExerciseList');
  if(listEl)listEl.innerHTML=renderExerciseListHTML(wizardState.splits[splitIdx].exercises);
}

// ══════════════════════════════════════════
// CHOOSE SPLIT
// ══════════════════════════════════════════
function renderChooseSplit(){
  const plan=activePlan();if(!plan)return;
  document.getElementById('chooseSplitBody').innerHTML=`
    <p style="font-size:0.85rem;color:var(--text-sec);margin-bottom:16px">Qual treino você vai fazer hoje?</p>
    ${plan.splits.map(s=>`
      <div class="training-card" onclick="startSession('${plan.id}','${s.letter}');closeModal('modalChooseSplit')" style="cursor:pointer">
        <div class="training-card-letter">${s.letter}</div>
        <div class="training-card-info"><div class="training-card-name">${s.name}</div><div class="training-card-meta">${s.exercises.length} exercícios</div></div>
        <span style="color:var(--text-dim)">→</span>
      </div>`).join('')}`;
}

// ══════════════════════════════════════════
// SESSION: START
// ══════════════════════════════════════════
function startSession(planId,splitLetter){
  const plan=plans.find(p=>p.id===planId);if(!plan)return;
  const split=plan.splits.find(s=>s.letter===splitLetter);if(!split)return;
  const prev=[...sessions].reverse().find(s=>s.type==='workout'&&s.splitLetter===splitLetter);
  session={
    planId,date:today(),splitLetter,splitName:split.name,startTime:Date.now(),
    exercises:split.exercises.map(e=>({
      ...e,
      note:'',
      seriesLog:(e.seriesConfig||Array.from({length:e.sets||3},()=>({type:'Normal',reps:''}))).map(sc=>({
        weight:'',reps:'',done:false,
        hint:sc.type!=='Normal'?sc.type:(sc.reps?`Alvo: ${sc.reps}`:null)
      })),
      expanded:false,
    })),
    extras:{cardio:false,cardioType:'',cardioDuration:'',abs:false,absDesc:''},
    note:'',prevSession:prev||null,
  };
  session.exercises[0].expanded=true;
  document.querySelectorAll('.sidebar-item').forEach(n=>n.classList.remove('active'));
  switchScreen('screenSession',null);
  startAutosave();
  renderSession();
}

// ══════════════════════════════════════════
// SESSION: RENDER
// ══════════════════════════════════════════
function renderSession(){
  const sc=document.getElementById('screenSession');
  const done=session.exercises.filter(e=>e.seriesLog.every(s=>s.done)).length;
  const total=session.exercises.length;
  const pct=total?Math.round((done/total)*100):0;
  sc.innerHTML=`
    <div class="session-header">
      <div class="session-split-big">${session.splitLetter}</div>
      <div class="session-split-name">${session.splitName}</div>
      <div class="session-progress-bar"><div class="session-progress-fill" style="width:${pct}%"></div></div>
      <div class="session-progress-label">${done}/${total} exercícios concluídos</div>
    </div>
    ${session.exercises.map((e,i)=>renderSessionExercise(e,i)).join('')}
    <div class="extras-card">
      <div class="extras-title">➕ Extras do dia</div>
      <div class="toggle-row">
        <span class="toggle-label">🏃 Cardio</span>
        <label class="toggle-switch"><input type="checkbox" id="sessCardio" ${session.extras.cardio?'checked':''} onchange="toggleExtra('cardio')"><span class="toggle-slider"></span></label>
      </div>
      <div id="sessCardioDetail" style="${session.extras.cardio?'':'display:none'};padding-top:8px">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tipo</label><input type="text" id="sessCardioType" placeholder="Esteira..." value="${session.extras.cardioType}"></div>
          <div class="form-group"><label class="form-label">Duração (min)</label><input type="number" id="sessCardioDuration" placeholder="30" value="${session.extras.cardioDuration}"></div>
        </div>
      </div>
      <div class="toggle-row">
        <span class="toggle-label">🔥 Abdominal</span>
        <label class="toggle-switch"><input type="checkbox" id="sessAbs" ${session.extras.abs?'checked':''} onchange="toggleExtra('abs')"><span class="toggle-slider"></span></label>
      </div>
      <div id="sessAbsDetail" style="${session.extras.abs?'':'display:none'};padding-top:8px">
        <div class="form-group"><label class="form-label">Exercícios</label><textarea class="note-textarea" id="sessAbsDesc" placeholder="Ex: 3x20 crunch...">${session.extras.absDesc}</textarea></div>
      </div>
    </div>
    <div class="form-group" style="margin-top:10px">
      <label class="form-label">Observações gerais do treino</label>
      <textarea class="note-textarea" id="sessNote" placeholder="Como foi o treino no geral? Algo importante...">${session.note}</textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn btn-ghost" style="flex:1" onclick="cancelSession()">✕ Cancelar</button>
      <button class="btn btn-secondary" style="flex:1.3" onclick="saveAndPauseSess()" title="Salva o progresso e volta depois">💾 Pausar</button>
      <button class="btn btn-primary" style="flex:2" onclick="prepareFinish()">✓ Finalizar</button>
    </div>`;
}

function renderSessionExercise(e,i){
  const prevData=session.prevSession?.exercises?.find(pe=>pe.name===e.name);
  const allDone=e.seriesLog.every(s=>s.done);
  const cls=allDone?'session-exercise done':(e.expanded?'session-exercise current':'session-exercise');
  const prevHint=prevData?prevData.seriesLog?.map(s=>s.done?`${s.weight||'—'}kg×${s.reps||'—'}`:null).filter(Boolean).slice(0,3).join(', '):null;
  const seriesRows=e.seriesLog.map((s,si)=>`
    <div class="series-row">
      <div class="series-label">S${si+1}</div>
      <div class="series-input-wrap">
        <label>Carga (kg)</label>
        <input class="series-input" type="number" step="0.5" placeholder="${prevData?.seriesLog?.[si]?.weight||'0'}" value="${s.weight}" onchange="updateSeries(${i},${si},'weight',this.value)">
      </div>
      <div class="series-input-wrap">
        <label>Reps</label>
        <input class="series-input" type="text" placeholder="${prevData?.seriesLog?.[si]?.reps||'0'}" value="${s.reps}" onchange="updateSeries(${i},${si},'reps',this.value)">
      </div>
      ${s.hint?`<div class="series-hint">${s.hint}</div>`:''}
      <button class="series-check ${s.done?'done':''}" onclick="toggleSeriesDone(${i},${si})">${s.done?'✓':'○'}</button>
    </div>`).join('');
  return `
    <div class="${cls}" id="sessEx${i}">
      <div class="session-exercise-header" onclick="toggleExercise(${i})">
        <div class="session-exercise-num">${i+1}</div>
        <div class="session-exercise-info">
          <div class="session-exercise-name">${e.name}</div>
          <div class="session-exercise-meta">${e.seriesLog.length} séries${e.technique&&e.technique!=='Normal'?` · <span class="badge badge-purple" style="padding:1px 5px;font-size:0.65rem">${e.technique}</span>`:''}</div>
          ${prevHint?`<div class="session-exercise-prev">⏮ Último: ${prevHint}</div>`:''}
        </div>
        <span style="color:var(--text-dim);font-size:0.9rem">${e.expanded?'▲':'▼'}</span>
      </div>
      ${e.expanded?`
        <div class="series-table">
          ${seriesRows}
          <div class="series-actions">
            <button class="series-act-btn add" onclick="addExtraSeries(${i})">+ série</button>
            <button class="series-act-btn remove" onclick="removeLastSeries(${i})">− série</button>
          </div>
        </div>
        ${e.obs?`<div style="padding:2px 16px 4px;font-size:0.75rem;color:var(--text-dim)">📌 ${e.obs}</div>`:''}
        <div class="ex-note-wrap">
          <textarea rows="2" class="ex-note-textarea" placeholder="Observação deste exercício (opcional)..." onchange="updateExNote(${i},this.value)">${e.note||''}</textarea>
        </div>
      `:''}
    </div>`;
}

function toggleExercise(i){saveSessionExtras();session.exercises[i].expanded=!session.exercises[i].expanded;renderSession()}
function updateSeries(ei,si,f,v){session.exercises[ei].seriesLog[si][f]=v}
function updateExNote(i,v){session.exercises[i].note=v}

function toggleSeriesDone(exIdx,seriesIdx){
  const s=session.exercises[exIdx].seriesLog[seriesIdx];s.done=!s.done;
  if(s.done){
    const ex=session.exercises[exIdx];
    if(ex.seriesLog.every(s=>s.done)){
      const ni=exIdx+1;
      if(ni<session.exercises.length){session.exercises[ni].expanded=true;session.exercises[exIdx].expanded=false;toast(`${ex.name} concluído! ⚡`);}
    }
  }
  saveSessionExtras();renderSession();
  setTimeout(()=>{const next=document.getElementById(`sessEx${exIdx+1}`);if(next)next.scrollIntoView({behavior:'smooth',block:'nearest'})},100);
  saveSessionDraft();
}

function addExtraSeries(ei){saveSessionExtras();session.exercises[ei].seriesLog.push({weight:'',reps:'',done:false,hint:null});renderSession()}
function removeLastSeries(ei){
  saveSessionExtras();
  if(session.exercises[ei].seriesLog.length<=1){toast('Mínimo de 1 série!','error');return;}
  session.exercises[ei].seriesLog.pop();renderSession();
}
function toggleExtra(type){
  saveSessionExtras();
  if(type==='cardio'){session.extras.cardio=!session.extras.cardio;document.getElementById('sessCardioDetail').style.display=session.extras.cardio?'':'none';}
  else{session.extras.abs=!session.extras.abs;document.getElementById('sessAbsDetail').style.display=session.extras.abs?'':'none';}
}
function saveSessionExtras(){
  if(document.getElementById('sessCardioType')){
    session.extras.cardioType=document.getElementById('sessCardioType')?.value||'';
    session.extras.cardioDuration=document.getElementById('sessCardioDuration')?.value||'';
    session.extras.absDesc=document.getElementById('sessAbsDesc')?.value||'';
    session.note=document.getElementById('sessNote')?.value||'';
  }
  // Save per-exercise notes from DOM
  session.exercises.forEach((e,i)=>{
    const ta=document.querySelector(`#sessEx${i} .ex-note-textarea`);
    if(ta)e.note=ta.value;
  });
}

function prepareFinish(){
  saveSessionExtras();
  showModal('modalFinish');
  document.getElementById('extCardio').checked=session.extras.cardio;
  document.getElementById('cardioDetail').style.display=session.extras.cardio?'':'none';
  if(session.extras.cardioType)document.getElementById('cardioType').value=session.extras.cardioType;
  if(session.extras.cardioDuration)document.getElementById('cardioDuration').value=session.extras.cardioDuration;
  document.getElementById('extAbs').checked=session.extras.abs;
  document.getElementById('absDetail').style.display=session.extras.abs?'':'none';
  if(session.extras.absDesc)document.getElementById('absDesc').value=session.extras.absDesc;
  document.getElementById('sessionNote').value=session.note;
  document.getElementById('extCardio').onchange=function(){document.getElementById('cardioDetail').style.display=this.checked?'':'none';};
  document.getElementById('extAbs').onchange=function(){document.getElementById('absDetail').style.display=this.checked?'':'none';};
}

function finishSession(){
  const entry={
    id:uid(),type:'workout',date:session.date,
    splitLetter:session.splitLetter,splitName:session.splitName,
    duration:Math.round((Date.now()-session.startTime)/60000),
    exercises:session.exercises.map(e=>({name:e.name,technique:e.technique,note:e.note||'',seriesLog:e.seriesLog})),
    extras:{
      cardio:document.getElementById('extCardio').checked,
      cardioType:document.getElementById('cardioType')?.value||'',
      cardioDuration:document.getElementById('cardioDuration')?.value||'',
      abs:document.getElementById('extAbs').checked,
      absDesc:document.getElementById('absDesc')?.value||'',
    },
    note:document.getElementById('sessionNote')?.value||'',
  };
  sessions=sessions.filter(s=>s.date!==session.date);
  sessions.push(entry);sessions.sort((a,b)=>a.date.localeCompare(b.date));
  save();clearSessionDraft();clearInterval(_autosaveTimer);
  
  const wasPast = session.date !== today() && !session.isEditing;
  const msg = wasPast ? `Treino salvo para o dia ${fmtDate(session.date)}!` : 'Treino salvo! ⚡ Boa evolução!';
  
  session=null;closeModal('modalFinish');toast(msg);
  switchScreen('screenHome',document.querySelector('[data-screen="screenHome"]'));
}

function cancelSession(){
  if(!confirm('Cancelar o treino? Os dados não serão salvos.'))return;
  clearSessionDraft();clearInterval(_autosaveTimer);
  session=null;switchScreen('screenHome',document.querySelector('[data-screen="screenHome"]'));
}

function editTodaySession(){
  const ts=today();
  const existing=sessions.find(s=>s.date===ts&&s.type==='workout');
  if(!existing){toast('Nenhum treino para editar hoje.','error');return;}
  // Rebuild session state from saved entry so user can re-edit
  session={
    planId:existing.planId||null,
    date:ts,
    splitLetter:existing.splitLetter,
    splitName:existing.splitName,
    startTime:existing.startTime||Date.now(),
    isEditing:true, // flag to know this is an edit
    exercises:existing.exercises.map(e=>({
      ...e,
      expanded:false,
    })),
    extras:{...existing.extras},
    note:existing.note||'',
    prevSession:null, // no previous for edit view (already have current data)
  };
  // Try to find previous session for comparison (the one before this)
  const prev=[...sessions]
    .filter(s=>s.type==='workout'&&s.splitLetter===existing.splitLetter&&s.date<ts)
    .sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  session.prevSession=prev;
  session.exercises[0].expanded=true;
  document.querySelectorAll('.sidebar-item').forEach(n=>n.classList.remove('active'));
  switchScreen('screenSession',null);
  startAutosave();
  renderSession();
  toast('Editando treino de hoje. Salve quando terminar. ✎');
}

function saveAndPauseSess(){
  saveSessionExtras();
  saveSessionDraft();
  clearInterval(_autosaveTimer);
  toast('Progresso salvo! Retome quando quiser. 💾');
  session=null;
  switchScreen('screenHome',document.querySelector('[data-screen="screenHome"]'));
}

// ══════════════════════════════════════════
// REST DAY
// ══════════════════════════════════════════
function openRestDay(){document.getElementById('restNote').value='';showModal('modalRestDay')}
function confirmRestDay(){
  const entry={id:uid(),type:'rest',date:today(),note:document.getElementById('restNote')?.value?.trim()||''};
  sessions=sessions.filter(s=>s.date!==today());
  sessions.push(entry);sessions.sort((a,b)=>a.date.localeCompare(b.date));
  save();closeModal('modalRestDay');toast('Dia de descanso registrado');renderHome();
}
function removeRestDay(){
  if(!confirm('Remover o registro de descanso de hoje?'))return;
  sessions=sessions.filter(s=>s.date!==today());
  save();toast('Registro de descanso removido.');renderHome();
}

// ══════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════
function renderHistory(){
  const el=document.getElementById('historyList');
  if(!sessions.length){el.innerHTML=`<div class="empty-state"><span class="empty-icon">📅</span><div class="empty-title">Nenhum registro ainda</div><div class="empty-sub">Comece a treinar para ver seu histórico aqui.</div></div>`;return;}
  const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const groups={};
  sorted.forEach(s=>{const m=s.date.slice(0,7);if(!groups[m])groups[m]=[];groups[m].push(s)});
  el.innerHTML=Object.entries(groups).map(([month,entries])=>{
    const dt=new Date(month+'-01T12:00:00');
    return `<div class="history-day">
      <div class="history-day-header"><div class="history-day-date">${dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div><div class="badge badge-dim">${entries.length} dias</div></div>
      ${entries.map(s=>renderHistoryEntry(s)).join('')}
    </div>`;
  }).join('');
}

function renderHistoryEntry(s){
  if(s.type==='rest')return`
    <div class="rest-day-entry">
      <span style="font-size:1.2rem">🛌</span>
      <div style="flex:1">
        <div style="font-size:0.88rem;color:var(--text-sec);font-weight:500">Dia de Descanso</div>
        <div style="font-size:0.72rem;color:var(--text-dim)">${fmtDate(s.date)}${s.note?' · '+s.note:''}</div>
      </div>
      ${s.date===today()?`<button class="btn btn-icon btn-danger" onclick="removeRestDay()" title="Remover">🗑</button>`:''}
    </div>`;
  return `
    <div class="history-entry">
      <div class="history-entry-header">
        <div class="history-split-badge">${s.splitLetter}</div>
        <div style="flex:1"><div class="history-entry-name">${s.splitName}</div><div class="history-entry-time">${fmtDate(s.date)}${s.duration?' · '+s.duration+'min':''}</div></div>
        <button class="btn btn-icon" onclick="viewSession('${s.date}')">→</button>
        ${s.date===today()?`<button class="btn btn-icon" title="Editar" style="color:var(--yellow);border-color:rgba(255,209,102,0.3)" onclick="editTodaySession()">✎</button>`:''}
      </div>
      <div class="history-ex-list">
        ${(s.exercises||[]).slice(0,3).map(e=>`<div class="history-ex-item"><div class="history-ex-dot"></div><span>${e.name}</span><span style="color:var(--text-dim)">${e.seriesLog?.filter(x=>x.done).length||0} séries</span></div>`).join('')}
        ${(s.exercises||[]).length>3?`<div style="font-size:0.75rem;color:var(--text-dim);padding-left:10px">+${s.exercises.length-3} mais</div>`:''}
        ${s.extras?.cardio?`<div class="history-ex-item"><div class="history-ex-dot" style="background:var(--blue)"></div><span>Cardio${s.extras.cardioType?' - '+s.extras.cardioType:''}</span></div>`:''}
        ${s.extras?.abs?`<div class="history-ex-item"><div class="history-ex-dot" style="background:var(--green)"></div><span>Abdominal</span></div>`:''}
      </div>
    </div>`;
}

function viewSession(date){
  const s=sessions.find(x=>x.date===date);if(!s||s.type==='rest')return;
  const isToday=date===today();
  const detail=`
    <div style="padding:0 20px 20px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${isToday?'10px':'16px'}">
        <div style="width:44px;height:44px;background:var(--accent-dim);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.3rem;color:var(--accent)">${s.splitLetter}</div>
        <div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1rem">${s.splitName}</div><div style="font-size:0.78rem;color:var(--text-sec)">${fmtDate(s.date)} · ${s.duration||'?'}min</div></div>
      </div>
      ${isToday?`<button class="btn btn-sm btn-block" style="background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(255,209,102,0.3);margin-bottom:14px" onclick="closeModal('modalDetail');editTodaySession()">✎ Editar este treino</button>`:''}
      ${(s.exercises||[]).map(e=>`
        <div class="card" style="margin-bottom:8px">
          <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px">${e.name}${e.technique&&e.technique!=='Normal'?`<span class="badge badge-purple" style="padding:2px 6px;font-size:0.65rem">${e.technique}</span>`:''}</div>
          ${(e.seriesLog||[]).map((sl,i)=>`<div style="display:flex;gap:10px;font-size:0.82rem;padding:3px 0;border-bottom:1px solid var(--border);color:${sl.done?'var(--text)':'var(--text-dim)'}"><span style="color:var(--text-dim);font-weight:600;width:28px">S${i+1}</span><span>${sl.weight||'—'} kg</span><span>×</span><span>${sl.reps||'—'} reps</span>${sl.hint?`<span class="badge badge-purple" style="padding:1px 5px;font-size:0.62rem">${sl.hint}</span>`:''}<span style="margin-left:auto">${sl.done?'✓':''}</span></div>`).join('')}
          ${e.note?`<div style="margin-top:6px;font-size:0.78rem;color:var(--text-sec);padding:6px 8px;background:var(--bg);border-radius:6px">💬 ${e.note}</div>`:''}
        </div>`).join('')}
      ${s.extras?.cardio?`<div class="badge badge-blue" style="margin-right:6px;margin-top:4px">🏃 Cardio${s.extras.cardioType?' - '+s.extras.cardioType:''} ${s.extras.cardioDuration?s.extras.cardioDuration+'min':''}</div>`:''}
      ${s.extras?.abs?`<div class="badge badge-green">🔥 Abdominal${s.extras.absDesc?' - '+s.extras.absDesc:''}</div>`:''}
      ${s.note?`<div style="margin-top:10px;font-size:0.82rem;color:var(--text-sec);padding:10px;background:var(--bg);border-radius:8px">📝 ${s.note}</div>`:''}
    </div>`;
  showDetailModal('Detalhes do Treino',detail);
}

function showDetailModal(title,bodyHTML){
  let m=document.getElementById('modalDetail');
  if(!m){
    m=document.createElement('div');m.className='modal-overlay';m.id='modalDetail';
    m.innerHTML=`<div class="modal-sheet"><div class="modal-drag"></div><div class="modal-header"><div class="modal-title" id="detailTitle"></div><button class="btn btn-icon" onclick="closeModal('modalDetail')">✕</button></div><div id="detailBody" style="max-height:70vh;overflow-y:auto"></div></div>`;
    document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)closeModal('modalDetail')});
  }
  document.getElementById('detailTitle').textContent=title;
  document.getElementById('detailBody').innerHTML=bodyHTML;
  showModal('modalDetail');
}


// ══════════════════════════════════════════
// RETROACTIVE LOG (register past days)
// ══════════════════════════════════════════
let retroDate=null; // the past date being logged

function openRetroLog(dateStr){
  retroDate=dateStr;
  const existing=sessions.find(s=>s.date===dateStr);
  const plan=activePlan();
  const modal=document.getElementById('modalRetroLog');
  // Populate header
  document.getElementById('retroLogDate').textContent=fmtDate(dateStr);
  // Show existing entry info
  const infoEl=document.getElementById('retroExistingInfo');
  if(existing&&existing.type==='workout'){
    infoEl.innerHTML=`<div style="background:var(--yellow-dim);border:1px solid rgba(255,209,102,0.3);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:var(--yellow)">⚡ Já existe um treino <strong>${existing.splitLetter} — ${existing.splitName}</strong> registrado para este dia. Editar vai substituí-lo.</div>`;
  } else if(existing&&existing.type==='rest'){
    infoEl.innerHTML=`<div style="background:var(--blue-dim);border:1px solid rgba(91,141,239,0.3);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:var(--blue)">🛌 Este dia está marcado como descanso. Pode substituir por um treino.</div>`;
  } else {
    infoEl.innerHTML='';
  }
  // Build split selector
  const splitEl=document.getElementById('retroSplitSelect');
  if(plan){
    splitEl.innerHTML=plan.splits.map(s=>`<option value="${s.letter}">${s.letter} — ${s.name}</option>`).join('');
    if(existing&&existing.type==='workout'){
      splitEl.value=existing.splitLetter;
    }
  } else {
    splitEl.innerHTML='<option>Nenhum plano ativo</option>';
  }
  // Build exercise list based on selected split
  renderRetroExercises(existing);
  splitEl.onchange=()=>renderRetroExercises(null);
  // Extras
  document.getElementById('retroCardio').checked=existing?.extras?.cardio||false;
  document.getElementById('retroCardioType').value=existing?.extras?.cardioType||'';
  document.getElementById('retroCardioDuration').value=existing?.extras?.cardioDuration||'';
  document.getElementById('retroCardioDetail').style.display=existing?.extras?.cardio?'':'none';
  document.getElementById('retroAbs').checked=existing?.extras?.abs||false;
  document.getElementById('retroAbsDesc').value=existing?.extras?.absDesc||'';
  document.getElementById('retroAbsDetail').style.display=existing?.extras?.abs?'':'none';
  document.getElementById('retroNote').value=existing?.note||'';
  showModal('modalRetroLog');
}

function renderRetroExercises(existing){
  const plan=activePlan();if(!plan)return;
  const splitLetter=document.getElementById('retroSplitSelect').value;
  const split=plan.splits.find(s=>s.letter===splitLetter);
  if(!split)return;
  // Use existing data if same split, else blank template
  const useExisting=existing&&existing.type==='workout'&&existing.splitLetter===splitLetter;
  const container=document.getElementById('retroExerciseList');
  container.innerHTML=split.exercises.map((ex,i)=>{
    const prevLog=useExisting?existing.exercises.find(e=>e.name===ex.name):null;
    // Find previous session for this split before retroDate for comparison
    const prevSess=[...sessions]
      .filter(s=>s.type==='workout'&&s.splitLetter===splitLetter&&s.date<retroDate)
      .sort((a,b)=>b.date.localeCompare(a.date))[0];
    const prevEx=prevSess?.exercises?.find(e=>e.name===ex.name);
    const prevHint=prevEx?prevEx.seriesLog?.map(sl=>sl.done?`${sl.weight||'—'}kg×${sl.reps||'—'}`:null).filter(Boolean).slice(0,3).join(', '):null;
    const seriesConfig=ex.seriesConfig||Array.from({length:ex.sets||3},()=>({type:'Normal',reps:''}));
    const seriesLog=prevLog?prevLog.seriesLog:seriesConfig.map(sc=>({weight:'',reps:'',done:true,hint:sc.type!=='Normal'?sc.type:(sc.reps?`Alvo: ${sc.reps}`:null)}));
    return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px">
      <div style="font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        ${ex.name}
        ${ex.technique&&ex.technique!=='Normal'?`<span class="badge badge-purple" style="padding:2px 6px;font-size:0.65rem">${ex.technique}</span>`:''}
      </div>
      ${prevHint?`<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:6px">⏮ Ref: ${prevHint}</div>`:''}
      <div id="retroSeries_${i}">
        ${seriesLog.map((sl,si)=>`
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)" id="retroRow_${i}_${si}">
            <span style="font-size:0.7rem;font-weight:700;color:var(--text-dim);width:22px;flex-shrink:0">S${si+1}</span>
            <div style="flex:1;position:relative">
              <label style="position:absolute;top:-8px;left:8px;font-size:0.58rem;color:var(--text-dim);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:var(--bg);padding:0 2px">kg</label>
              <input class="series-input" type="number" step="0.5" placeholder="0" value="${sl.weight||''}" style="padding:7px 4px;font-size:0.85rem">
            </div>
            <div style="flex:1;position:relative">
              <label style="position:absolute;top:-8px;left:8px;font-size:0.58rem;color:var(--text-dim);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:var(--bg);padding:0 2px">reps</label>
              <input class="series-input" type="text" placeholder="0" value="${sl.reps||''}" style="padding:7px 4px;font-size:0.85rem">
            </div>
            ${sl.hint?`<span style="font-size:0.65rem;color:var(--purple);background:var(--purple-dim);border-radius:4px;padding:2px 5px;white-space:nowrap">${sl.hint}</span>`:''}
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="series-act-btn add" onclick="retroAddSeries(${i})">+ série</button>
        <button class="series-act-btn remove" onclick="retroRemoveSeries(${i})">− série</button>
      </div>
      <div style="margin-top:8px">
        <input type="text" id="retroExNote_${i}" placeholder="Observação do exercício..." value="${prevLog?.note||''}" style="font-size:0.8rem;padding:7px 10px">
      </div>
    </div>`;
  }).join('');
}

function retroAddSeries(exIdx){
  const plan=activePlan();if(!plan)return;
  const splitLetter=document.getElementById('retroSplitSelect').value;
  const split=plan.splits.find(s=>s.letter===splitLetter);if(!split)return;
  const container=document.getElementById(`retroSeries_${exIdx}`);
  const rows=container.querySelectorAll('[id^="retroRow_"]');
  const si=rows.length;
  const newRow=document.createElement('div');
  newRow.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)';
  newRow.id=`retroRow_${exIdx}_${si}`;
  newRow.innerHTML=`<span style="font-size:0.7rem;font-weight:700;color:var(--text-dim);width:22px;flex-shrink:0">S${si+1}</span>
    <div style="flex:1;position:relative"><label style="position:absolute;top:-8px;left:8px;font-size:0.58rem;color:var(--text-dim);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:var(--bg);padding:0 2px">kg</label><input class="series-input" type="number" step="0.5" placeholder="0" style="padding:7px 4px;font-size:0.85rem"></div>
    <div style="flex:1;position:relative"><label style="position:absolute;top:-8px;left:8px;font-size:0.58rem;color:var(--text-dim);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:var(--bg);padding:0 2px">reps</label><input class="series-input" type="text" placeholder="0" style="padding:7px 4px;font-size:0.85rem"></div>`;
  container.appendChild(newRow);
}

function retroRemoveSeries(exIdx){
  const container=document.getElementById(`retroSeries_${exIdx}`);
  const rows=container.querySelectorAll('[id^="retroRow_"]');
  if(rows.length<=1){toast('Mínimo de 1 série!','error');return;}
  rows[rows.length-1].remove();
}

function saveRetroLog(){
  const plan=activePlan();if(!plan){toast('Nenhum plano ativo.','error');return;}
  const splitLetter=document.getElementById('retroSplitSelect').value;
  const split=plan.splits.find(s=>s.letter===splitLetter);
  if(!split){toast('Divisão inválida.','error');return;}
  // Collect exercises
  const exercises=split.exercises.map((ex,i)=>{
    const container=document.getElementById(`retroSeries_${i}`);
    const rows=container?container.querySelectorAll('[id^="retroRow_"]'):[];
    const seriesLog=Array.from(rows).map(row=>{
      const inputs=row.querySelectorAll('input');
      return{weight:inputs[0]?.value||'',reps:inputs[1]?.value||'',done:true,hint:null};
    });
    return{
      name:ex.name,technique:ex.technique||'Normal',
      note:document.getElementById(`retroExNote_${i}`)?.value||'',
      seriesLog
    };
  });
  const entry={
    id:uid(),type:'workout',date:retroDate,
    splitLetter,splitName:split.name,
    duration:0, retroLogged:true,
    exercises,
    extras:{
      cardio:document.getElementById('retroCardio').checked,
      cardioType:document.getElementById('retroCardioType').value||'',
      cardioDuration:document.getElementById('retroCardioDuration').value||'',
      abs:document.getElementById('retroAbs').checked,
      absDesc:document.getElementById('retroAbsDesc').value||'',
    },
    note:document.getElementById('retroNote').value||'',
  };
  sessions=sessions.filter(s=>s.date!==retroDate);
  sessions.push(entry);sessions.sort((a,b)=>a.date.localeCompare(b.date));
  save();
  closeModal('modalRetroLog');
  toast(`Treino de ${fmtDate(retroDate)} salvo! ⚡`);
  renderHome();
}

function retroMarkRest(){
  if(!confirm(`Marcar ${fmtDate(retroDate)} como dia de descanso?`))return;
  const entry={id:uid(),type:'rest',date:retroDate,note:document.getElementById('retroNote').value||''};
  sessions=sessions.filter(s=>s.date!==retroDate);
  sessions.push(entry);sessions.sort((a,b)=>a.date.localeCompare(b.date));
  save();closeModal('modalRetroLog');
  toast(`Descanso em ${fmtDate(retroDate)} registrado.`);
  renderHome();
}

// ══════════════════════════════════════════
// STATS
// ══════════════════════════════════════════
function renderStats(){
  const workouts=sessions.filter(s=>s.type==='workout');
  const restDays=sessions.filter(s=>s.type==='rest');
  let streak=0,cd=new Date();
  for(let i=0;i<365;i++){
    const d=cd.toISOString().slice(0,10),s=sessions.find(x=>x.date===d);
    if(s&&s.type==='workout')streak++;
    else if(i>0)break;
    cd.setDate(cd.getDate()-1);
  }
  let totalVol=0;
  workouts.forEach(s=>(s.exercises||[]).forEach(e=>(e.seriesLog||[]).forEach(sl=>{if(sl.done&&sl.weight&&sl.reps)totalVol+=parseFloat(sl.weight||0)*parseFloat(sl.reps||0)})));
  document.getElementById('statsGrid').innerHTML=`
    <div class="stat-card"><div class="stat-number">${workouts.length}</div><div class="stat-label">Treinos realizados</div></div>
    <div class="stat-card"><div class="stat-number" style="color:var(--blue)">${streak}</div><div class="stat-label">Dias seguidos</div></div>
    <div class="stat-card"><div class="stat-number" style="color:var(--green)">${restDays.length}</div><div class="stat-label">Dias de descanso</div></div>
    <div class="stat-card"><div class="stat-number" style="font-size:1.3rem;color:var(--yellow)">${(totalVol/1000).toFixed(1)}t</div><div class="stat-label">Volume total</div></div>`;
  renderHeatmap();
}

function renderHeatmap(){
  const cells=[];
  for(let i=97;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toISOString().slice(0,10),s=sessions.find(x=>x.date===ds);
    let cls='heatmap-cell';
    if(s){if(s.type==='rest')cls+=' rest';else{const sd=s.exercises?.reduce((a,e)=>a+(e.seriesLog?.filter(x=>x.done).length||0),0)||0;cls+=sd>=15?' t3':sd>=8?' t2':' t1';}}
    cells.push({cls,date:ds});
  }
  const cols=[];for(let i=0;i<cells.length;i+=7)cols.push(cells.slice(i,i+7));
  document.getElementById('heatmap').innerHTML=cols.map(col=>`<div class="heatmap-col">${col.map(c=>`<div class="${c.cls}" title="${c.date}"></div>`).join('')}</div>`).join('');
}


// ══════════════════════════════════════════
// LIGHT / DARK THEME
// ══════════════════════════════════════════
function applyTheme(mode){
  if(mode==='light'){
    document.documentElement.classList.add('light');
    const btn=document.getElementById('themeIcon');if(btn)btn.textContent='☀️';
    const lbl=document.getElementById('themeLabel');if(lbl)lbl.textContent='Modo Escuro';
  } else {
    document.documentElement.classList.remove('light');
    const btn=document.getElementById('themeIcon');if(btn)btn.textContent='🌙';
    const lbl=document.getElementById('themeLabel');if(lbl)lbl.textContent='Modo Claro';
  }
}
function toggleTheme(){
  const isDark=!document.documentElement.classList.contains('light');
  const next=isDark?'light':'dark';
  localStorage.setItem('charge_theme',next);
  applyTheme(next);
}

document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(localStorage.getItem('charge_theme')||'dark');
  autoFillRestDays();
  checkDraftOnLoad();
  renderHome();
});

function autoFillRestDays(){
  const activeP=activePlan();
  if(!activeP||sessions.length===0)return;
  const dates=sessions.map(s=>s.date).sort();
  const earliest=new Date(dates[0]+'T12:00:00');
  const yest=new Date();yest.setDate(yest.getDate()-1);
  let changed=false;
  let d=new Date(earliest);
  while(d<=yest){
    const dStr=d.toISOString().slice(0,10);
    if(!sessions.find(x=>x.date===dStr)){
      sessions.push({id:uid(),type:'rest',date:dStr,note:'Descanso automático'});
      changed=true;
    }
    d.setDate(d.getDate()+1);
  }
  if(changed){sessions.sort((a,b)=>a.date.localeCompare(b.date));save();}
}

function checkDraftOnLoad(){
  const draft=loadSessionDraft();
  if(!draft)return;
  // Show banner on home - will be rendered by renderHome
  // Store it for later use
  window._pendingDraft=draft;
}

function renderDraftBanner(){
  const draft=window._pendingDraft||loadSessionDraft();
  const banner=document.getElementById('draftBanner');
  if(!banner)return;
  if(!draft){banner.style.display='none';return;}
  const sub=document.getElementById('draftBannerSub');
  const isPast = draft.date && draft.date < today();
  if(sub){
    if(isPast){
      sub.innerHTML=`<span style="color:var(--red);font-weight:600">Você esqueceu de finalizar este treino em ${fmtDate(draft.date)}. Finalize-o agora!</span>`;
    }else{
      sub.textContent=`Treino ${draft.splitLetter} — ${draft.splitName} · iniciado ${new Date(draft.startTime).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    }
  }
  banner.style.display='flex';
}

function resumeSessionDraft(){
  const draft=window._pendingDraft||loadSessionDraft();
  if(!draft){toast('Nenhum rascunho encontrado.','error');return;}
  session=draft;
  window._pendingDraft=null;
  document.querySelectorAll('.sidebar-item').forEach(n=>n.classList.remove('active'));
  switchScreen('screenSession',null);
  startAutosave();
  renderSession();
  toast('Treino retomado! ⚡');
}

function discardDraft(){
  if(!confirm('Descartar o treino salvo? Não será possível recuperá-lo.'))return;
  window._pendingDraft=null;
  clearSessionDraft();
  const banner=document.getElementById('draftBanner');
  if(banner)banner.style.display='none';
  toast('Rascunho descartado.','error');
}

window.showModal=showModal;
window.editTodaySession=editTodaySession;

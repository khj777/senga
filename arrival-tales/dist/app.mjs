import { STORY, planStory } from './engine.mjs';

const $ = id => document.getElementById(id);
const state = {
  eta: 12, completed: [], history: [], plan: null, current: null, elapsed: 0,
  playing: false, started: false, finished: false, guidance: false,
  sound: false, driving: false, speed: 12, sentence: 0,
  speechDone: false, speechToken: 0, guidanceToken: 0, guidanceTimer: null, toastTimer: null,
};
const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
const synthesis = window.speechSynthesis;
const minutesLabel = n => Number.isInteger(n) ? `${n}` : n.toFixed(1);
const sentences = text => text.match(/[^.!?。！？]+[.!?。！？]?/g)?.map(s => s.trim()).filter(Boolean) || [text];

function notify(message) {
  $('event-note').textContent = message;
}
function toast(message) {
  clearTimeout(state.toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  state.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function cancelSpeech(force = false) {
  state.speechToken++;
  // Web Speech has one queue. A story edit must never cancel active guidance.
  if (!state.guidance || force) synthesis?.cancel();
}
function speakCurrent() {
  if (!state.sound || !synthesis || !state.playing || state.guidance || !state.current || state.finished) return;
  cancelSpeech();
  const token = state.speechToken;
  const phrases = sentences(state.current.text);
  function speakSentence() {
    if (token !== state.speechToken || !state.playing || state.guidance || state.finished) return;
    if (state.sentence >= phrases.length) {
      state.speechDone = true;
      advanceScene(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(phrases[state.sentence]);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.92;
    const voices = synthesis.getVoices();
    const korean = voices.find(v => v.lang.toLowerCase().startsWith('ko'));
    if (korean) utterance.voice = korean;
    utterance.onend = () => {
      if (token !== state.speechToken) return;
      state.sentence++;
      speakSentence();
    };
    utterance.onerror = event => {
      if (token !== state.speechToken || event.error === 'canceled' || event.error === 'interrupted') return;
      state.sound = false;
      toast('기기 음성을 사용할 수 없어요. 화면 시연으로 이어갑니다. 이야기 펼쳐보기에서 내용을 읽을 수 있어요.');
      render();
    };
    synthesis.speak(utterance);
  }
  speakSentence();
}
function applyPlan({ preserve = true } = {}) {
  const previous = state.current;
  state.plan = planStory({ remainingMinutes: state.eta, completedIds: state.completed, currentId: preserve ? previous?.id : null });
  const next = state.plan.scenes[0] || null;
  const changed = next?.id !== previous?.id;
  const revised = next?.text !== previous?.text;
  state.current = next;
  if (changed || revised || !preserve) {
    cancelSpeech();
    state.elapsed = 0;
    state.sentence = 0;
    state.speechDone = false;
  }
  if (state.plan.mode === 'arrived' || state.plan.mode === 'complete') {
    clearTimeout(state.guidanceTimer);
    state.guidanceToken++;
    state.guidance=false;
    cancelSpeech(true);
    state.finished = true;
    state.playing = false;
  }
  render();
  if ((changed || revised || !preserve) && state.playing) speakCurrent();
}
function resetTrip(autoplay = false) {
  clearTimeout(state.guidanceTimer);
  state.guidanceToken++;
  cancelSpeech(true);
  Object.assign(state, { eta: 12, completed: [], history: [], current: null, elapsed: 0, playing: autoplay, started: autoplay, finished: false, guidance: false, sentence: 0, speechDone: false });
  document.querySelectorAll('[data-scenario]').forEach(b => b.classList.remove('selected'));
  applyPlan({preserve:false});
  notify('새로운 여정이에요. 재생 후 주행 상황을 바꾸면 이야기 구성이 달라집니다.');
}
function togglePlayback() {
  if (state.finished) { resetTrip(true); return; }
  state.playing = !state.playing;
  if (state.playing) {
    state.started = true;
    speakCurrent();
    notify(state.sound ? '기기 음성으로 듣고 있어요. 안내가 나오면 읽던 문장부터 다시 이어갑니다.' : '이야기 시연이 시작됐어요. ‘음성 켜기’를 누르면 기기 음성으로 직접 들을 수 있습니다.');
  } else { cancelSpeech(); notify('시연을 잠시 멈췄어요. 다시 재생하면 읽던 장면부터 이어집니다.'); }
  render();
}
function advanceScene(manual = false) {
  if (!state.current || state.finished || state.guidance) return;
  const current = state.current;
  cancelSpeech();
  // A manual skip fast-forwards the scenario. Narration uses its measured
  // wall time instead of pretending its editorial allotment was an audio file.
  if (manual) state.eta = Math.max(0, state.eta - Math.max(0, current.minutes - state.elapsed));
  state.completed.push(current.id);
  state.history.push(current);
  state.current = null;
  state.elapsed = 0;
  state.sentence = 0;
  applyPlan({preserve:false});
  if (state.finished) notify('모로의 배달도, 우리의 이야기도 끝났어요. 남은 길은 조용히 쉬어 가요. 다시 재생하면 새 여정을 시작합니다.');
  else if (manual) notify(`‘${current.title}’을 지나 ‘${state.current.title}’으로 이동했어요.`);
}
function setEta(value, source = 'slider') {
  if (state.finished) {
    toast('이 이야기는 끝났어요. 처음부터 버튼으로 새 여정을 시작해 주세요.');
    render();
    return;
  }
  const oldPlan = state.plan.scenes.map(s => s.id);
  state.eta = Math.max(0, Number(value) || 0);
  // Replan at an explicit scenario event, not on every clock tick.
  applyPlan();
  const optional = state.plan.scenes.filter(s => s.kind === 'optional').length;
  const removed = oldPlan.filter(id => !state.plan.scenes.some(s => s.id === id) && id !== state.current?.id).length;
  if (state.plan.mode === 'arrived') notify('목적지에 도착했어요. 재생을 멈추고 도착 카드를 보여줍니다. 갑작스러운 도착까지 음성 완주를 보장하지는 않습니다.');
  else if (state.plan.mode === 'closing') notify('도착이 가까워졌어요. 이미 들은 내용은 건너뛰고, 남은 핵심 사건과 결말을 짧게 이어갑니다.');
  else if (source === 'longer') notify(`여유가 생겨 앞으로 들을 곁가지 모험 ${optional}개를 담았어요. 지나간 장면은 반복하지 않습니다.`);
  else if (source === 'shorter') notify(removed ? `시간이 줄어 ${removed}개 장면을 덜어냈어요. 현재 장면과 이야기의 핵심, 결말은 이어집니다.` : '남은 시간에 맞춰 다시 계산했어요. 지금 구성의 이야기와 결말이 들어갑니다.');
  else notify(`남은 ${minutesLabel(state.eta)}분에 맞춰 ${state.plan.scenes.length}개 장면을 구성했어요. ${state.plan.reason}`);
}
function navigationPrompt() {
  if (state.guidance) return;
  if (state.finished) { toast('새 여정을 시작한 뒤 길 안내를 시연해 주세요.'); return; }
  cancelSpeech();
  state.guidance = true;
  const token=++state.guidanceToken;
  const initialScene=state.current?.id;
  render();
  notify('길 안내가 먼저예요. 이야기는 잠시 멈췄고, 안내가 끝나면 같은 문장부터 이어집니다.');
  const finish = () => {
    if (token!==state.guidanceToken || !state.guidance || state.finished) return;
    clearTimeout(state.guidanceTimer);
    state.guidance = false;
    render();
    speakCurrent();
    notify(state.playing ? initialScene===state.current?.id ? '길 안내가 끝났어요. 이야기를 듣던 문장부터 다시 이어갑니다.' : '길 안내가 끝났어요. 변경된 남은 시간에 맞춰 이야기를 이어갑니다.' : '길 안내가 끝났어요. 일시정지 상태를 유지합니다.');
  };
  // This is a simulated audio-focus event; production uses AudioManager.
  state.guidanceTimer = setTimeout(finish, 5000);
  if (state.sound && synthesis) {
    const utterance = new SpeechSynthesisUtterance('잠시 후 우회전입니다.');
    utterance.lang = 'ko-KR';
    const korean = synthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('ko'));
    if (korean) utterance.voice = korean;
    utterance.onend = () => { if(token!==state.guidanceToken||!state.guidance||state.finished)return; clearTimeout(state.guidanceTimer); state.guidanceTimer = setTimeout(finish, 650); };
    synthesis.speak(utterance);
  }
}
function render() {
  const {plan,current} = state;
  if (!plan) return;
  $('eta-number').textContent = state.eta < 1 && state.eta > 0 ? '<1' : Math.ceil(state.eta);
  $('eta-slider').value = Math.ceil(state.eta);
  $('eta-output').textContent = `${Math.ceil(state.eta)}분`;
  $('arrival-label').textContent = plan.mode === 'closing' ? '짧은 결말로 이어가기' : state.finished ? '편안한 도착을 준비해요' : '결말까지 여유롭게';
  $('fit-message').textContent = state.finished ? (plan.mode === 'arrived' ? '우리도 도착했어요. 이야기는 여기서 쉬어가요.' : '이야기는 끝났어요. 남은 길은 편안하게.') : plan.mode === 'closing' ? '남은 핵심 사건을 짧은 결말로 이어요.' : `핵심 장면은 그대로, 곁가지 모험 ${plan.scenes.filter(s=>s.kind==='optional').length}개를 더했어요.`;
  $('plan-label').textContent = state.finished ? '여정 마무리' : plan.mode === 'closing' ? '짧은 결말' : `${plan.scenes.length}개 장면`;
  $('chapter-label').textContent = state.finished ? (plan.mode === 'arrived' ? '우리도 도착했어요' : '잘 도착했어, 모로') : state.started ? current?.title || '이야기의 끝' : '이야기가 기다리고 있어요';
  $('player-note').textContent = state.guidance ? '길 안내 후 이어집니다' : state.finished ? '다시 재생하면 새 여정을 시작합니다' : state.playing ? (state.sound ? '기기 음성으로 읽는 중' : `장면 시연 중 · ${state.speed}배속`) : state.started ? '잠시 쉬어가는 중' : '재생을 누르면 여정이 시작됩니다';
  $('play-button').innerHTML = state.playing ? pauseIcon : playIcon;
  $('play-button').setAttribute('aria-label',state.playing ? '이야기 일시정지' : state.finished ? '새 여정 시작' : '이야기 재생');
  $('next-button').disabled = state.finished || state.guidance || !state.started;
  $('equalizer').classList.toggle('active',state.playing && !state.guidance);
  $('sound-button').setAttribute('aria-pressed',String(state.sound));
  $('sound-button').innerHTML = state.sound ? '음성 켜짐 <span aria-hidden="true">◖))</span>' : '음성 켜기 <span aria-hidden="true">◖))</span>';
  $('drive-button').setAttribute('aria-pressed',String(state.driving));
  $('drive-button').textContent = state.driving ? '정차 화면' : '주행 화면';
  document.querySelector('.cockpit').classList.toggle('driving',state.driving);
  $('transcript-button').disabled = state.driving;
  $('guidance-overlay').hidden = !state.guidance;
  $('cabin-status').textContent = state.finished ? '도착을 준비하는 시간' : state.driving ? '주행 중 · 듣기에 집중해요' : '출발 전 · 함께 들을 준비';
  const total = state.completed.length + plan.scenes.length;
  $('player-fraction').innerHTML = `${String(Math.min(state.completed.length + 1, Math.max(1,total))).padStart(2,'0')} <i>/</i> ${String(Math.max(1,total)).padStart(2,'0')}`;
  const timeline = $('story-timeline');
  timeline.replaceChildren();
  if (state.finished && plan.mode === 'complete') {
    const li = document.createElement('li'); li.className='current';
    li.innerHTML = '<span class="dot">✓</span><span class="scene-title">모든 이야기를 들었어요</span><span class="scene-tag">완료</span>';
    timeline.append(li);
  }
  for (const [i,scene] of plan.scenes.entries()) {
    const li = document.createElement('li');
    li.className = i === 0 ? 'current' : '';
    const dot = document.createElement('span'); dot.className='dot'; dot.textContent=i===0&&state.started?'•':String(i+1);
    const title = document.createElement('span'); title.className='scene-title'; title.textContent=scene.title;
    const tag = document.createElement('span'); tag.className='scene-tag';tag.textContent=scene.ending?'결말':scene.kind==='optional'?'곁가지':'핵심';
    li.append(dot,title,tag); timeline.append(li);
  }
  renderProgress();
}
function renderProgress() {
  const percent = state.finished ? 100 : !state.current ? 0 : state.sound ? state.sentence / sentences(state.current.text).length * 100 : Math.min(100,state.elapsed / (state.current.minutes || 1) * 100);
  $('progress-fill').style.width = `${percent}%`;
}
function renderTranscript() {
  const content = $('transcript-content'); content.replaceChildren();
  const past = state.history;
  const list = [...past,...state.plan.scenes];
  if (!list.length) list.push(STORY.scenes.at(-1));
  for (const scene of list) {
    const article=document.createElement('article'); const title=document.createElement('h3'); const text=document.createElement('p');
    title.textContent=scene.title; text.textContent=scene.text; article.append(title,text);content.append(article);
  }
}

$('play-button').addEventListener('click',togglePlayback);
$('restart-button').addEventListener('click',()=>resetTrip(false));
$('reset-trip').addEventListener('click',()=>resetTrip(false));
$('next-button').addEventListener('click',()=>advanceScene(true));
$('sound-button').addEventListener('click',()=>{
  if (!synthesis || !window.SpeechSynthesisUtterance) { toast('이 브라우저는 음성 읽기를 지원하지 않습니다. 이야기 펼쳐보기로 읽어 주세요.');return; }
  state.sound=!state.sound;
  if (state.sound) {
    state.speed=1;
    $('speed-select').value='1';
    speakCurrent();
    toast('음성 듣기는 실시간으로 전환됩니다. 기기의 한국어 음성을 사용해요.');
  } else cancelSpeech();
  render();
});
$('drive-button').addEventListener('click',()=>{state.driving=!state.driving;render();notify(state.driving?'주행 화면은 읽을 내용과 움직임을 줄였어요. 아래 시뮬레이션 버튼은 심사용 제어판입니다.':'정차 화면으로 돌아왔어요. 이야기 구성과 전체 원문을 살펴볼 수 있습니다.');});
$('eta-slider').addEventListener('input',event=>{setEta(Number(event.target.value));document.querySelectorAll('[data-scenario]').forEach(b=>b.classList.remove('selected'));});
$('speed-select').addEventListener('change',event=>{state.speed=Number(event.target.value);render();toast(state.sound?'음성 읽기 속도는 그대로이며, 주행 시간 시뮬레이션만 바뀝니다.':`시연 속도를 ${state.speed}배속으로 바꿨어요.`);});
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.scenario;
  document.querySelectorAll('[data-scenario]').forEach(b=>b.classList.toggle('selected',b===button));
  if (action==='guidance') navigationPrompt();
  else setEta({shorter:5,longer:18,arrive:2}[action],action);
}));
$('about-button').addEventListener('click',()=>$('about-dialog').showModal());
$('listen-tab').addEventListener('click',()=>document.querySelector('.cockpit').scrollIntoView({behavior:'smooth',block:'center'}));
$('transcript-button').addEventListener('click',()=>{renderTranscript();$('transcript-dialog').showModal();});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
});
let last=performance.now();
setInterval(()=>{
  const now=performance.now();const seconds=Math.min((now-last)/1000,1);last=now;
  if (!state.playing || state.guidance || state.finished || !state.current) return;
  const minutes=seconds*state.speed/60;
  state.eta=Math.max(0,state.eta-minutes);
  state.elapsed+=minutes;
  if(state.eta<=0){applyPlan();notify('도착했어요. 재생을 멈추고 도착 카드를 보여줍니다.');return;}
  if(!state.sound&&state.elapsed>=state.current.minutes){advanceScene(false);return;}
  $('eta-number').textContent=state.eta<1?'<1':Math.ceil(state.eta);
  $('eta-slider').value=Math.ceil(state.eta);$('eta-output').textContent=`${Math.ceil(state.eta)}분`;
  renderProgress();
},250);
window.addEventListener('pagehide',()=>{clearTimeout(state.guidanceTimer);state.guidanceToken++;cancelSpeech(true);});
applyPlan({preserve:false});

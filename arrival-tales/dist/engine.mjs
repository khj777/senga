/**
 * A deterministic, dependency-free narrative planner for the Morrow prototype.
 *
 * `minutes` are EDITORIAL ALLOTMENTS for a future produced audio track, including
 * music, pauses and interaction. They are NOT measured Web Speech durations.
 * The prototype can demonstrate planning; a production player must replace the
 * allotments with measured audio durations and replan at sentence boundaries.
 *
 * Modes:
 * - full: every remaining scene fits, while keeping the arrival buffer.
 * - focused: all remaining causal beats fit; some optional scenes are omitted.
 * - closing: a short, coherent recap and ending replaces the remaining scenes.
 * - arrived: a zero-duration arrival CARD, not a zero-duration audio promise.
 * - complete: a terminal ending was already completed; nothing is repeated.
 */

const scenes = [
  {
    id: 'promise', title: '달빛 배달부', kind: 'required', minutes: 1,
    text: '하늘 바다를 헤엄치는 작은 고래 모로에게 달씨앗 하나가 도착했어요. 편지에는 “숲의 등대에 이 씨앗을 심어 주세요. 오늘 밤 길을 잃은 친구들이 집을 찾을 수 있도록요.”라고 적혀 있었지요. 모로는 달씨앗을 등에 조심스럽게 올리고, 숲을 향해 꼬리를 흔들었어요.',
    shortText: '작은 고래 모로는 친구들의 귀갓길을 밝혀 줄 달씨앗을 숲의 등대로 배달하고 있었어요.'
  },
  {
    id: 'cloud-post', title: '구름 우체국', kind: 'optional', minutes: 2,
    text: '솜사탕처럼 둥근 구름 우체국에서 새 한 마리가 모로를 불렀어요. “배달 가는 길이니? 따뜻한 바람을 한 봉투 가져가렴.” 모로가 봉투를 열자 갓 구운 빵 냄새가 퍼졌고, 달씨앗도 간지러운 듯 살짝 반짝였어요.',
    shortText: '구름 사이로 난 길을 지나, 모로는 다시 숲의 등대를 향했어요.'
  },
  {
    id: 'dim-seed', title: '불빛이 작아졌어요', kind: 'required', minutes: 1,
    text: '숲 가까이 다다르자 차가운 바람이 불어 달씨앗의 빛이 아주 작아졌어요. 멀리 있던 등대도 어둠 속에 숨어 버렸지요. 모로는 서두르는 대신 숨을 한 번 천천히 쉬고, 씨앗이 보내는 작은 깜빡임에 귀를 기울였어요.',
    shortText: '차가운 바람에 씨앗의 빛이 작아졌지만, 모로는 숨을 고르며 작은 깜빡임을 살폈어요.'
  },
  {
    id: 'forest-song', title: '숲의 작은 합창', kind: 'optional', minutes: 2,
    text: '아래쪽 숲에서 풀벌레들이 아주 작은 노래를 부르고 있었어요. 한 마리가 “찌르르” 하면 다른 한 마리는 “괜찮아” 하고 답하는 것 같았지요. 모로는 그 노래를 한 번 따라 불렀고, 나뭇잎들이 박수처럼 사각사각 흔들렸어요.',
    shortText: '숲의 노래를 마음에 담은 모로는 등대로 향하는 길을 이어 갔어요.'
  },
  {
    id: 'shared-light', title: '함께 밝히는 길', kind: 'required', minutes: 1,
    text: '모로가 씨앗을 따뜻한 지느러미로 감싸자 작은 빛이 다시 자라났어요. 그 빛을 본 반딧불이들이 하나둘 모여, 숲의 등대까지 점선 같은 길을 만들었지요. “혼자서 전부 밝힐 필요는 없었구나.” 모로는 친구들의 불빛 사이를 천천히 헤엄쳤어요.',
    shortText: '모로가 씨앗을 따뜻하게 감싸자 빛이 살아났고, 반딧불이들이 등대까지 길을 밝혀 주었어요.'
  },
  {
    id: 'star-bridge', title: '별을 세는 다리', kind: 'optional', minutes: 3,
    text: '등대로 가는 길에는 물방울로 엮은 작은 다리가 있었어요. 물방울마다 별 하나씩이 비쳐서, 모로가 지나갈 때마다 별들이 함께 여행하는 것 같았지요. 모로는 가장 작은 별에게도 “잘 따라오고 있니?” 하고 인사를 건넸어요.',
    shortText: '별빛 다리를 건넌 모로의 눈앞에 숲의 등대가 나타났어요.'
  },
  {
    id: 'night-garden', title: '잠들지 않은 정원', kind: 'optional', minutes: 3,
    text: '등대 앞 정원에서는 밤에만 피는 꽃들이 서로 다른 꿈 이야기를 나누고 있었어요. 어떤 꽃은 바다를, 어떤 꽃은 따뜻한 주머니를 꿈꾸었지요. 모로는 “나는 오늘 모두가 편안히 집에 도착하는 꿈을 꿀 거야.” 하고 조용히 말했어요.',
    shortText: '밤꽃들의 인사를 뒤로하고 모로는 등대 앞에 조용히 멈추었어요.'
  },
  {
    id: 'home', title: '달이 도착한 밤', kind: 'required', minutes: 1, ending: true,
    text: '모로가 숲의 등대에 달씨앗을 심자, 둥근 달이 피어나 밤길을 환하게 밝혔어요. 친구들은 자기 집을 찾아 하나둘 손을 흔들었고, 모로도 포근한 구름 집으로 돌아갔지요. 오늘의 배달은 끝났어요. 우리 이야기도 여기서 잠깐 쉬어 갈까요?',
    shortText: '등대에 심은 씨앗은 둥근 달이 되었고, 친구들도 모로도 포근한 집으로 돌아갔어요.'
  }
].map(scene => Object.freeze(scene));

export const STORY = Object.freeze({
  id: 'whale-moon-delivery',
  title: '달을 배달하는 고래',
  subtitle: '작은 불빛들이 함께 만드는 귀갓길',
  scenes: Object.freeze(scenes)
});

const TERMINAL_IDS = new Set(['home', 'brief-ending', 'arrival']);
const round = value => Math.round(value * 100) / 100;
const floorHundredth = value => Math.floor(value * 100) / 100;
const sum = items => round(items.reduce((total, scene) => total + scene.minutes, 0));

function result(selected, reserveMinutes, mode, reason) {
  return {
    scenes: selected,
    totalMinutes: sum(selected),
    // Round down so a sub-minute ETA cannot be exceeded by display precision.
    reserveMinutes: floorHundredth(reserveMinutes),
    mode,
    reason
  };
}

/**
 * Plan from the current story position without repeating completed scenes.
 *
 * A valid currentId anchors the first candidate. Otherwise, playback resumes
 * after the furthest completed canonical scene. Omitted scenes before that
 * frontier stay omitted even if the ETA later grows; time never rewinds.
 *
 * currentId must describe an UNFINISHED scene. completedIds may also contain
 * unknown IDs (ignored), allowing a saved session to survive a content update.
 * Current scenes retain their complete original text unless `mode=closing`.
 * In closing mode, `continuationOf` identifies the scene being bridged, and
 * `beats` lists the required plot beats retained by the compact narration.
 */
export function planStory({ remainingMinutes = 0, completedIds = [], currentId = null } = {}) {
  const remaining = typeof remainingMinutes === 'number' && Number.isFinite(remainingMinutes)
    ? Math.max(0, remainingMinutes) : 0;
  const completed = new Set(Array.isArray(completedIds) ? completedIds.filter(id => typeof id === 'string') : []);
  if ([...TERMINAL_IDS].some(id => completed.has(id))) {
    return result([], 0, 'complete', '이야기를 모두 들었어요. 편안한 도착을 준비해요.');
  }

  const canonicalIndex = new Map(scenes.map((scene, index) => [scene.id, index]));
  const lastCompleted = Math.max(-1, ...[...completed].map(id => canonicalIndex.get(id) ?? -1));
  const requestedIndex = canonicalIndex.get(currentId);
  const currentIndex = requestedIndex !== undefined && !completed.has(currentId) && requestedIndex > lastCompleted
    ? requestedIndex : null;
  const frontier = currentIndex ?? lastCompleted + 1;
  const pending = scenes.slice(frontier).filter(scene => !completed.has(scene.id));
  const current = currentIndex === null ? null : scenes[currentIndex];
  const required = pending.filter(scene => scene.kind === 'required');

  // Reserve is part of the ETA, not extra time added after the ending.
  const reserve = Math.min(1, remaining / 5);
  const budget = Math.max(0, remaining - reserve);
  const mandatory = pending.filter(scene => scene.kind === 'required' || scene.id === current?.id);
  const requiredCost = sum(mandatory);
  const closingText = [
    ...(current?.kind === 'optional' ? [current.shortText] : []),
    ...required.map(scene => scene.shortText)
  ].join(' ');

  if (remaining === 0) {
    return result([{
      id: 'arrival', title: '우리도 도착했어요', kind: 'required', minutes: 0,
      text: closingText || scenes.at(-1).shortText,
      ending: true, displayOnly: true, continuationOf: current?.id ?? null,
      beats: required.map(scene => scene.id)
    }], 0, 'arrived', '도착했어요. 마지막 장면을 읽고 이야기를 마쳐요.');
  }

  if (remaining < 3 || requiredCost > budget + 1e-9 || currentId === 'brief-ending') {
    return result([{
      id: 'brief-ending', title: '달빛을 따라, 집으로', kind: 'required',
      minutes: floorHundredth(Math.min(1.5, budget)), text: closingText || scenes.at(-1).shortText,
      ending: true, continuationOf: current?.id ?? null,
      beats: required.map(scene => scene.id)
    }], reserve, 'closing', '남은 시간에 맞춰 중요한 이야기와 결말을 짧게 이어 들어요.');
  }

  // Exhaustive subset selection is intentionally tiny: only four optional
  // scenes. Prefer more narrative time, then the earliest canonical selection.
  const optional = pending.filter(scene => scene.kind === 'optional' && scene.id !== current?.id);
  let best = [];
  let bestMinutes = -1;
  for (let mask = 0; mask < (1 << optional.length); mask += 1) {
    const candidate = optional.filter((_, index) => (mask & (1 << index)) !== 0);
    const candidateMinutes = sum(candidate);
    if (requiredCost + candidateMinutes <= budget + 1e-9 && candidateMinutes > bestMinutes) {
      best = candidate;
      bestMinutes = candidateMinutes;
    }
  }
  const chosen = new Set([...mandatory, ...best].map(scene => scene.id));
  const selected = pending.filter(scene => chosen.has(scene.id));
  const isFull = selected.length === pending.length;
  return result(selected, reserve, isFull ? 'full' : 'focused', isFull
    ? '남은 시간에 모든 장면을 담을 수 있어요. 이야기가 끝나면 편안히 쉬어요.'
    : '곁가지 장면을 덜어내고, 이야기의 흐름과 결말을 이어 가요.');
}

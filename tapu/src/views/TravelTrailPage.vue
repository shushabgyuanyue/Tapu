<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  confirmTravelTrailReturn,
  resolveTravelTrail,
  setTravelTrailNextDestinationByKey,
} from '../api';
import { appCopy } from '../copy';

const route = useRoute();
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const data = ref<any>(null);
const nextInput = ref('');
const nextNoteInput = ref('');
const returnNote = ref('');

const token = computed(() => String(route.query.key || '').trim());
const trail = computed(() => data.value?.trail || {});
const ritual = computed(() => data.value?.ritual || {});
const places = computed(() => Array.isArray(data.value?.places) ? data.value.places : []);
const nextPlace = computed(() => trail.value.next_place || ritual.value.nextPlace || '');
const nextPlaceNote = computed(() => trail.value.next_place_note || ritual.value.nextPlaceNote || '');
const themeColor = computed(() => data.value?.content?.themeColor || trail.value.theme_color || '#2f6f5e');
const title = computed(() => data.value?.content?.title || trail.value.title || appCopy.travelTrail.fallbackTitle);
const subtitle = computed(() => (
  data.value?.content?.subtitle
  || trail.value.subtitle
  || appCopy.travelTrail.fallbackSubtitle
));
const lifeQuestion = computed(() => ritual.value.lifeQuestion || appCopy.travelTrail.fallbackLifeQuestion);
const objectLabel = computed(() => data.value?.token?.object_label || trail.value.object_label || appCopy.travelTrail.fallbackObjectLabel);

const displayPlaces = computed(() => {
  const base = places.value.map((place: any) => ({ ...place, future: false }));
  if (nextPlace.value) {
    base.push({
      id: '__next',
      name: nextPlace.value,
      note: nextPlaceNote.value,
      future: true,
    });
  }
  return base;
});

const pointFor = (index: number, total: number) => {
  if (total <= 1) return { x: 50, y: 54 };
  const progress = index / Math.max(1, total - 1);
  const x = 10 + progress * 80;
  const y = 50 + Math.sin(progress * Math.PI * 2.2 - 0.8) * 18 + (index % 2 ? 6 : -4);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
};

const points = computed(() => displayPlaces.value.map((place: any, index: number) => ({
  ...pointFor(index, displayPlaces.value.length),
  place,
})));

const pathD = computed(() => {
  if (points.value.length === 0) return '';
  if (points.value.length === 1) return `M ${points.value[0].x} ${points.value[0].y}`;
  return points.value.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points.value[index - 1];
    const cx = (prev.x + point.x) / 2;
    const cy = Math.min(prev.y, point.y) - 16 + (index % 2 ? 8 : 0);
    return `${path} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${point.x} ${point.y}`;
  }, '');
});

const syncTrail = (result: any, nextMessage: string) => {
  data.value = {
    ...data.value,
    trail: result.trail,
    places: result.trail?.places || [],
    ritual: {
      ...(data.value?.ritual || {}),
      nextPlace: result.trail?.next_place || null,
      nextPlaceNote: result.trail?.next_place_note || null,
      journeyState: result.trail?.journey_state || 'planning',
    },
  };
  message.value = nextMessage;
};

const load = async () => {
  loading.value = true;
  error.value = '';
  message.value = '';
  if (!token.value) {
    error.value = appCopy.travelTrail.missingToken;
    loading.value = false;
    return;
  }
  const result = await resolveTravelTrail(token.value);
  if (result.error) {
    error.value = result.error;
  } else {
    data.value = result;
  }
  loading.value = false;
};

const planNextStop = async () => {
  const next = nextInput.value.trim();
  if (!next || saving.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  const result = await setTravelTrailNextDestinationByKey(token.value, {
    next_place: next,
    next_place_note: nextNoteInput.value.trim() || undefined,
  });
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  nextInput.value = '';
  nextNoteInput.value = '';
  syncTrail(result, appCopy.travelTrail.messages.planned(result.trail?.next_place || next));
};

const confirmReturn = async () => {
  if (!nextPlace.value || saving.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  const result = await confirmTravelTrailReturn(token.value, {
    note: returnNote.value.trim() || undefined,
  });
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  returnNote.value = '';
  syncTrail(result, appCopy.travelTrail.messages.returned(result.place?.name || appCopy.travelTrail.messages.returnedFallback));
};

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <main class="trail-page" :style="{ '--trail-accent': themeColor }">
    <div class="stamp stamp-a">{{ appCopy.travelTrail.stamps.brand }}</div>
    <div class="stamp stamp-b">{{ appCopy.travelTrail.stamps.signal }}</div>

    <section class="trail-shell">
      <p class="app-mark">{{ appCopy.travelTrail.mark }}</p>

      <div v-if="loading" class="state-card">
        <span class="loading-dot"></span>
        <h1>{{ appCopy.travelTrail.loading.title }}</h1>
        <p>{{ appCopy.travelTrail.loading.body(objectLabel) }}</p>
      </div>

      <div v-else-if="error && !data" class="state-card">
        <span class="error-dot">?</span>
        <h1>{{ appCopy.travelTrail.error.title }}</h1>
        <p>{{ error }}</p>
      </div>

      <article v-else class="trail-card">
        <header class="trail-head">
          <span>{{ appCopy.travelTrail.stops(places.length, objectLabel) }}</span>
          <p class="question">{{ lifeQuestion }}</p>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </header>

        <section class="map-card">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path v-if="pathD" class="route-shadow" :d="pathD" />
            <path v-if="pathD" class="route-line" :d="pathD" />
          </svg>

          <div
            v-for="(point, index) in points"
            :key="point.place.id || `${point.place.name}-${index}`"
            class="pin"
            :class="{ latest: index === places.length - 1 && !point.place.future, future: point.place.future }"
            :style="{ left: `${point.x}%`, top: `${point.y}%`, '--delay': `${index * 0.08}s` }"
          >
            <span>{{ point.place.future ? '→' : index + 1 }}</span>
            <strong>{{ point.place.name }}</strong>
          </div>

          <div v-if="displayPlaces.length === 0" class="empty-map">
            <strong>{{ appCopy.travelTrail.emptyMap.title }}</strong>
            <p>{{ appCopy.travelTrail.emptyMap.body }}</p>
          </div>
        </section>

        <section v-if="nextPlace" class="ritual-card active-ritual">
          <p>{{ appCopy.travelTrail.activeRitual.kicker }}</p>
          <h2>{{ appCopy.travelTrail.activeRitual.nextTitle(nextPlace) }}</h2>
          <span v-if="nextPlaceNote">{{ nextPlaceNote }}</span>
          <span v-else>{{ appCopy.travelTrail.activeRitual.noNote }}</span>

          <div class="return-row">
            <input v-model="returnNote" :placeholder="appCopy.travelTrail.activeRitual.returnPlaceholder" @keyup.enter="confirmReturn" />
            <button :disabled="saving" @click="confirmReturn">
              {{ saving ? appCopy.travelTrail.activeRitual.saving : appCopy.travelTrail.activeRitual.action }}
            </button>
          </div>
        </section>

        <form v-else class="ritual-card plan-card" @submit.prevent="planNextStop">
          <p>{{ appCopy.travelTrail.plan.kicker }}</p>
          <h2>{{ appCopy.travelTrail.plan.title }}</h2>
          <div class="plan-grid">
            <input v-model="nextInput" :placeholder="appCopy.travelTrail.plan.placePlaceholder" />
            <input v-model="nextNoteInput" :placeholder="appCopy.travelTrail.plan.notePlaceholder" />
            <button :disabled="saving || !nextInput.trim()">{{ saving ? appCopy.travelTrail.plan.saving : appCopy.travelTrail.plan.action }}</button>
          </div>
        </form>

        <p v-if="message" class="message">{{ message }}</p>
        <p v-else-if="error" class="message error">{{ error }}</p>

        <ol v-if="places.length" class="place-list">
          <li v-for="(place, index) in places" :key="place.id || `${place.name}-${index}`">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ place.name }}</strong>
              <p v-if="place.note">{{ place.note }}</p>
            </div>
          </li>
        </ol>
      </article>
    </section>
  </main>
</template>

<style scoped>
.trail-page {
  --trail-accent: #2f6f5e;
  min-height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 30px 16px;
  color: #17211d;
  background:
    radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--trail-accent), transparent 72%), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(185, 130, 52, 0.22), transparent 32%),
    linear-gradient(145deg, #f8f2e8 0%, #e4efe9 52%, #d3dfd6 100%);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.stamp {
  position: absolute;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  border: 2px solid rgba(23, 33, 29, 0.08);
  border-radius: 999px;
  color: rgba(23, 33, 29, 0.08);
  font-size: 28px;
  font-weight: 950;
  letter-spacing: -0.08em;
  transform: rotate(-16deg);
}

.stamp-a {
  left: 6%;
  top: 10%;
}

.stamp-b {
  right: 7%;
  bottom: 10%;
  transform: rotate(14deg);
}

.trail-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 760px);
}

.app-mark {
  margin: 0 0 14px;
  color: rgba(23, 33, 29, 0.54);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.state-card,
.trail-card {
  border: 1px solid rgba(23, 33, 29, 0.12);
  background: rgba(255, 252, 244, 0.86);
  box-shadow: 0 28px 80px rgba(47, 62, 54, 0.18);
  backdrop-filter: blur(18px);
}

.state-card {
  min-height: 430px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  padding: 34px;
  border-radius: 34px;
  text-align: center;
}

.loading-dot,
.error-dot {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: var(--trail-accent);
  box-shadow: 0 0 0 12px color-mix(in srgb, var(--trail-accent), transparent 84%);
}

.loading-dot {
  animation: breathe 1.4s ease-in-out infinite;
}

.error-dot {
  font-size: 28px;
  font-weight: 950;
}

.state-card h1,
.state-card p {
  margin: 0;
}

.trail-card {
  overflow: hidden;
  padding: clamp(22px, 5vw, 38px);
  border-radius: 38px;
  animation: pageIn 0.48s ease both;
}

.trail-head {
  text-align: center;
}

.trail-head span {
  color: var(--trail-accent);
  font-size: 13px;
  font-weight: 950;
  text-transform: uppercase;
}

.question {
  margin: 12px auto 0;
  color: #9a6a2f;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.trail-head h1 {
  margin: 8px 0 10px;
  font-size: clamp(38px, 9vw, 74px);
  line-height: 0.98;
  letter-spacing: -0.08em;
}

.trail-head p:not(.question) {
  max-width: 560px;
  margin: 0 auto;
  color: rgba(23, 33, 29, 0.62);
  line-height: 1.8;
}

.map-card {
  position: relative;
  min-height: 360px;
  margin-top: 28px;
  overflow: hidden;
  border: 1px solid rgba(23, 33, 29, 0.1);
  border-radius: 30px;
  background:
    linear-gradient(90deg, rgba(23, 33, 29, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(23, 33, 29, 0.04) 1px, transparent 1px),
    radial-gradient(circle at 20% 20%, rgba(47, 111, 94, 0.12), transparent 26%),
    #f8f1e4;
  background-size: 28px 28px, 28px 28px, auto, auto;
}

svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.route-shadow,
.route-line {
  fill: none;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-shadow {
  stroke: rgba(23, 33, 29, 0.1);
  stroke-width: 7;
}

.route-line {
  stroke: var(--trail-accent);
  stroke-width: 3;
  stroke-dasharray: 220;
  stroke-dashoffset: 220;
  animation: drawRoute 1.15s ease forwards;
}

.pin {
  --delay: 0s;
  position: absolute;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 6px;
  transform: translate(-50%, -50%);
  animation: pinIn 0.42s ease both;
  animation-delay: var(--delay);
}

.pin span {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 3px solid #fffaf4;
  border-radius: 999px;
  color: #fff;
  background: var(--trail-accent);
  box-shadow: 0 10px 24px rgba(47, 111, 94, 0.24);
  font-size: 12px;
  font-weight: 950;
}

.pin.latest span {
  background: #9a6a2f;
}

.pin.future span {
  border-style: dashed;
  color: var(--trail-accent);
  background: #fffaf4;
}

.pin strong {
  max-width: 120px;
  padding: 5px 8px;
  border-radius: 999px;
  color: #26332e;
  background: rgba(255, 252, 244, 0.9);
  box-shadow: 0 8px 20px rgba(47, 62, 54, 0.08);
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}

.pin.future strong {
  color: #9a6a2f;
}

.empty-map {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  text-align: center;
}

.empty-map strong {
  font-size: 24px;
}

.empty-map p {
  margin: 0;
  color: rgba(23, 33, 29, 0.58);
}

.ritual-card {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid rgba(23, 33, 29, 0.1);
  border-radius: 26px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--trail-accent), transparent 82%), transparent 34%),
    rgba(255, 255, 255, 0.58);
}

.ritual-card p,
.ritual-card h2,
.ritual-card span {
  margin: 0;
}

.ritual-card p {
  color: var(--trail-accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ritual-card h2 {
  margin-top: 8px;
  font-size: clamp(24px, 6vw, 42px);
  letter-spacing: -0.06em;
}

.ritual-card span {
  display: block;
  margin-top: 8px;
  color: rgba(23, 33, 29, 0.6);
  line-height: 1.7;
}

.return-row,
.plan-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-top: 16px;
}

.plan-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
}

input {
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid rgba(23, 33, 29, 0.12);
  border-radius: 15px;
  padding: 0 12px;
  background: rgba(255, 252, 244, 0.92);
  outline: none;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 15px;
  padding: 0 16px;
  color: #fff;
  background: linear-gradient(135deg, #17121a, var(--trail-accent));
  cursor: pointer;
  font-weight: 950;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.message {
  margin: 12px 0 0;
  color: var(--trail-accent);
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.message.error {
  color: #c92752;
}

.place-list {
  display: grid;
  gap: 8px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.place-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
}

.place-list span {
  color: var(--trail-accent);
  font-size: 12px;
  font-weight: 950;
}

.place-list strong,
.place-list p {
  margin: 0;
}

.place-list p {
  margin-top: 3px;
  color: rgba(23, 33, 29, 0.58);
  line-height: 1.6;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes breathe {
  50% { transform: scale(0.9); opacity: 0.72; }
}

@keyframes drawRoute {
  to { stroke-dashoffset: 0; }
}

@keyframes pinIn {
  from { opacity: 0; transform: translate(-50%, -38%) scale(0.72); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@media (max-width: 680px) {
  .trail-page {
    align-items: stretch;
    padding: 18px 12px;
  }

  .trail-shell {
    display: grid;
    align-content: center;
  }

  .trail-card {
    border-radius: 30px;
  }

  .map-card {
    min-height: 300px;
  }

  .return-row,
  .plan-grid {
    grid-template-columns: 1fr;
  }
}
</style>

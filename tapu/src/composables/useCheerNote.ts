import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { cheerNoteCopy, type CheerModeId } from '../copy/cheerNote';

export type CheerTaskState = 'fresh' | 'pressing' | 'done' | 'pending';

export type CheerTask = {
  id: number;
  text: string;
  state: CheerTaskState;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
};

const HOLD_MS = 720;
const TASK_TTL_MS = cheerNoteCopy.lifecycle.ttlHours * 60 * 60 * 1000;
const MAX_ACTIVE_ITEMS = cheerNoteCopy.lifecycle.maxActiveItems;
const STORAGE_KEY = 'whatmint.cheer-note.v1';

type StoredCheerNoteState = {
  nextId: number;
  tasks: CheerTask[];
  archivedUnfinishedCount: number;
  archivedAt: number | null;
};

export function useCheerNote() {
  const draft = ref('');
  const tasks = ref<CheerTask[]>([]);
  const activeMode = ref<CheerModeId>('welcome_back');
  const burstKey = ref(0);
  const composerError = ref('');
  const holdTaskId = ref<number | null>(null);
  const holdProgress = ref(0);
  const holdTimer = ref<number | null>(null);
  const holdFrame = ref<number | null>(null);
  const holdStartedAt = ref(0);
  const burstingTaskId = ref<number | null>(null);
  const taskBurstTimer = ref<number | null>(null);
  const taskRemovalTimer = ref<number | null>(null);
  const nextId = ref(1);
  const archivedUnfinishedCount = ref(0);
  const archivedAt = ref<number | null>(null);
  const hydrated = ref(false);

  const modeCopy = computed(() => cheerNoteCopy.modes[activeMode.value]);
  const hasOpenTasks = computed(() => tasks.value.some(task => task.state !== 'done'));

  function buildTask(text: string): CheerTask {
    const now = Date.now();
    return {
      id: nextId.value,
      text,
      state: 'fresh',
      createdAt: now,
      expiresAt: now + TASK_TTL_MS,
    };
  }

  function normalizeStoredTasks(storedTasks: CheerTask[]) {
    const now = Date.now();
    let unfinished = 0;
    const activeTasks = storedTasks
      .filter(task => {
        if (task.state === 'done') return false;
        if (task.expiresAt > now) return true;
        unfinished += 1;
        return false;
      })
      .map(task => (task.state === 'pressing' ? { ...task, state: 'fresh' as const } : task));

    if (unfinished) {
      archivedUnfinishedCount.value += unfinished;
      archivedAt.value = now;
    }

    return activeTasks.slice(0, MAX_ACTIVE_ITEMS);
  }

  function persistState() {
    if (!hydrated.value) return;
    const payload: StoredCheerNoteState = {
      nextId: nextId.value,
      tasks: tasks.value,
      archivedUnfinishedCount: archivedUnfinishedCount.value,
      archivedAt: archivedAt.value,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function hydrateState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredCheerNoteState>;
      nextId.value = Number.isFinite(parsed.nextId) ? Number(parsed.nextId) : 1;
      archivedUnfinishedCount.value = Number.isFinite(parsed.archivedUnfinishedCount)
        ? Number(parsed.archivedUnfinishedCount)
        : 0;
      archivedAt.value = typeof parsed.archivedAt === 'number' ? parsed.archivedAt : null;
      tasks.value = normalizeStoredTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
    } catch {
      tasks.value = [];
    } finally {
      hydrated.value = true;
      persistState();
    }
  }

  function celebrate(mode: CheerModeId) {
    activeMode.value = mode;
    burstKey.value += 1;
  }

  function burstTask(taskId: number) {
    if (taskBurstTimer.value) window.clearTimeout(taskBurstTimer.value);
    burstingTaskId.value = taskId;
    taskBurstTimer.value = window.setTimeout(() => {
      burstingTaskId.value = null;
      taskBurstTimer.value = null;
    }, 760);
  }

  function removeTaskAfterCheer(taskId: number) {
    if (taskRemovalTimer.value) window.clearTimeout(taskRemovalTimer.value);
    taskRemovalTimer.value = window.setTimeout(() => {
      tasks.value = tasks.value.filter(task => task.id !== taskId);
      taskRemovalTimer.value = null;
    }, 820);
  }

  function addTask() {
    const text = draft.value.trim();
    if (!text) {
      composerError.value = cheerNoteCopy.composer.empty;
      return false;
    }

    tasks.value.unshift(buildTask(text));
    tasks.value = tasks.value.slice(0, MAX_ACTIVE_ITEMS);
    nextId.value += 1;
    draft.value = '';
    composerError.value = '';
    celebrate(text.length <= 5 ? 'tiny_win' : 'task_start');
    return true;
  }

  function clearHold() {
    if (holdTimer.value) window.clearTimeout(holdTimer.value);
    if (holdFrame.value) window.cancelAnimationFrame(holdFrame.value);
    if (holdTaskId.value) {
      const task = tasks.value.find(item => item.id === holdTaskId.value);
      if (task?.state === 'pressing') task.state = 'fresh';
    }
    holdTimer.value = null;
    holdFrame.value = null;
    holdTaskId.value = null;
    holdProgress.value = 0;
    holdStartedAt.value = 0;
  }

  function tickHold() {
    if (!holdTaskId.value || !holdStartedAt.value) return;
    holdProgress.value = Math.min(1, (Date.now() - holdStartedAt.value) / HOLD_MS);
    if (holdProgress.value < 1) {
      holdFrame.value = window.requestAnimationFrame(tickHold);
    }
  }

  function startHold(task: CheerTask) {
    if (task.state === 'done') return;
    clearHold();
    task.state = 'pressing';
    holdTaskId.value = task.id;
    holdStartedAt.value = Date.now();
    tickHold();
    holdTimer.value = window.setTimeout(() => {
      task.state = 'done';
      task.completedAt = Date.now();
      holdTaskId.value = null;
      holdProgress.value = 0;
      holdTimer.value = null;
      burstTask(task.id);
      removeTaskAfterCheer(task.id);
      celebrate('task_complete');
    }, HOLD_MS);
  }

  function completeTask(task: CheerTask) {
    if (task.state === 'done') return;
    clearHold();
    task.state = 'done';
    task.completedAt = Date.now();
    burstTask(task.id);
    removeTaskAfterCheer(task.id);
    celebrate('task_complete');
  }

  function endHold() {
    clearHold();
  }

  function endDay() {
    tasks.value = tasks.value.map(task => (
      task.state === 'done' ? task : { ...task, state: 'pending' }
    ));
    celebrate(hasOpenTasks.value ? 'unfinished_but_full' : 'task_complete');
  }

  function resetDesk() {
    clearTimers();
    tasks.value = [];
    draft.value = '';
    composerError.value = '';
    archivedUnfinishedCount.value = 0;
    archivedAt.value = null;
    celebrate('welcome_back');
  }

  function clearTimers() {
    clearHold();
    if (taskBurstTimer.value) window.clearTimeout(taskBurstTimer.value);
    if (taskRemovalTimer.value) window.clearTimeout(taskRemovalTimer.value);
    burstingTaskId.value = null;
    taskBurstTimer.value = null;
    taskRemovalTimer.value = null;
  }

  onMounted(() => {
    hydrateState();
    celebrate('welcome_back');
  });

  onUnmounted(clearTimers);

  watch([tasks, nextId, archivedUnfinishedCount, archivedAt], persistState, { deep: true });

  return {
    activeMode,
    burstKey,
    burstingTaskId,
    composerError,
    draft,
    holdProgress,
    holdTaskId,
    modeCopy,
    tasks,
    addTask,
    completeTask,
    celebrate,
    endDay,
    endHold,
    resetDesk,
    startHold,
  };
}

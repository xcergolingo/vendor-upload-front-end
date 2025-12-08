<template>
  <div class="detail">
    <button class="back" @click="goBack">← Back</button>
    <header>
      <div>
        <h2>{{ displayName }}</h2>
        <p class="subtitle">{{ decodedFileName }}</p>
      </div>
      <div class="actions">
        <a
          v-if="videoUrl"
          :href="videoUrl"
          target="_blank"
          rel="noreferrer"
          download
        >
          Download video
        </a>
      </div>
    </header>

    <section v-if="videoUrl" class="player">
      <video controls :src="videoUrl"></video>
    </section>

    <div class="tabs">
      <button :class="{ active: activeTab === 'show' }" @click="setTab('show')">
        {{ primaryTabLabel }}
      </button>
      <button :class="{ active: activeTab === 'edit' }" @click="setTab('edit')">
        Edit transcripts
      </button>
    </div>

    <section class="panel" v-if="activeTab === 'show'">
      <p v-if="loading">Loading transcripts...</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <div v-else class="transcript-sections">
        <div class="transcript-block">
          <h3>{{ primaryTabLabel }}</h3>
          <TranscriptViewer :srt="primarySrt" />
        </div>
        <div
          v-if="showOriginalSection"
          class="transcript-block original-block"
        >
          <h3>Original transcripts</h3>
          <TranscriptViewer :srt="originalSrtInput" />
        </div>
      </div>
    </section>

    <section class="panel" v-else>
      <p v-if="loading">Loading transcripts...</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <div v-else>
        <div class="edit-toolbar">
          <button @click="resetTranscripts" :disabled="!isDirty">
            Reset transcripts
          </button>
          <span class="hint">Drag a box onto its neighbor to merge them.</span>
        </div>
        <div class="editable-list">
          <div
            v-for="(entry, index) in editableEntries"
            :key="entry.index + '-' + entry.start + '-' + index"
            class="editable-entry"
            :class="{
              'drag-source': dragSourceIndex === index,
              'drag-target': dragTargetIndex === index && canDropOn(index)
            }"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragover.prevent="handleDragOver($event, index)"
            @dragleave.prevent="handleDragLeave(index)"
            @drop.prevent="handleDrop(index)"
            @dragend="handleDragEnd"
          >
            <div class="time">
              {{ entry.start }} → {{ entry.end }}
            </div>
            <p>{{ entry.text }}</p>
          </div>
        </div>
        <div class="clip-actions">
          <button @click="generateClips" :disabled="clipLoading || !editableEntries.length">
            {{ clipLoading ? 'Generating...' : 'Generate clips' }}
          </button>
          <span v-if="clipStatus" class="clip-status">{{ clipStatus }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import TranscriptViewer from '../components/TranscriptViewer.vue';
import { authState } from '../services/auth';
import { entriesToSrt, parseSrt } from '../utils/srt';

const props = defineProps({
  fileName: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: ''
  }
});

const router = useRouter();
const loading = ref(false);
const error = ref('');
const activeTab = ref('show');
const baselineEntries = ref([]);
const displayEntries = ref([]);
const editableEntries = ref([]);
const dragSourceIndex = ref(null);
const dragTargetIndex = ref(null);
const srtInput = ref('');
const inputLang = ref('');
const outputLang = ref('');
const clipLoading = ref(false);
const clipStatus = ref('');

const decodedFileName = computed(() => {
  try {
    return decodeURIComponent(props.fileName);
  } catch {
    return props.fileName;
  }
});

const displayName = computed(() => decodedFileName.value.split('/').pop());
const videoUrl = computed(() => props.videoUrl || '');
const displaySrt = computed(() => entriesToSrt(displayEntries.value));
const editedSrt = computed(() => entriesToSrt(editableEntries.value));
const originalSrtInput = computed(() => srtInput.value || '');
const isTranslated = computed(
  () =>
    inputLang.value &&
    outputLang.value &&
    inputLang.value.toLowerCase() !== outputLang.value.toLowerCase()
);
const primaryTabLabel = computed(() =>
  isTranslated.value ? 'Translated transcripts' : 'Original transcripts'
);
const primarySrt = computed(() => displaySrt.value);
const showOriginalSection = computed(
  () => isTranslated.value && !!originalSrtInput.value
);

const isDirty = computed(() => {
  if (baselineEntries.value.length !== editableEntries.value.length) return true;
  const originalString = JSON.stringify(baselineEntries.value);
  const editedString = JSON.stringify(editableEntries.value);
  return originalString !== editedString;
});

function setTab(tab) {
  activeTab.value = tab;
}

function cloneEntries(entries) {
  return entries.map(entry => ({ ...entry }));
}

function assignIndexes(entries) {
  return entries.map((entry, idx) => ({
    ...entry,
    index: String(idx + 1)
  }));
}

async function fetchTranscripts() {
  if (!authState.userEmail) {
    error.value = 'You must be logged in to view transcripts.';
    return;
  }
  if (!decodedFileName.value) {
    error.value = 'Missing file reference.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/show-video-transcripts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authState.userEmail,
          file_name: decodedFileName.value
        })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
    const payload = await response.json();
    const body =
      payload && typeof payload.body === 'object' ? payload.body : payload;
    const srtValue = body?.srt || '';
    srtInput.value = body?.srt_input || '';
    inputLang.value = body?.input_lang || '';
    outputLang.value = body?.output_lang || '';
    if (!srtValue) {
      error.value = 'Transcript not available for this video.';
      originalEntries.value = [];
      editableEntries.value = [];
      return;
    }
    const parsed = assignIndexes(parseSrt(srtValue));
    if (!parsed.length) {
      error.value = 'Unable to parse SRT response.';
      return;
    }
    baselineEntries.value = cloneEntries(parsed);
    displayEntries.value = cloneEntries(parsed);
    editableEntries.value = cloneEntries(parsed);
    clearDragState();
  } catch (err) {
    console.error(err);
    error.value = 'Failed to fetch transcripts. Please try again.';
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.back();
}

function canDropOn(index) {
  if (dragSourceIndex.value === null) return false;
  if (dragSourceIndex.value === index) return false;
  return Math.abs(dragSourceIndex.value - index) === 1;
}

function handleDragStart(event, index) {
  dragSourceIndex.value = index;
  dragTargetIndex.value = null;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function handleDragOver(event, index) {
  if (canDropOn(index)) {
    event.dataTransfer.dropEffect = 'move';
    dragTargetIndex.value = index;
  } else {
    event.dataTransfer.dropEffect = 'none';
    dragTargetIndex.value = null;
  }
}

function handleDragLeave(index) {
  if (dragTargetIndex.value === index) {
    dragTargetIndex.value = null;
  }
}

function handleDrop(index) {
  if (!canDropOn(index) || dragSourceIndex.value === null) return;
  mergeEntries(dragSourceIndex.value, index);
  clearDragState();
}

function handleDragEnd() {
  clearDragState();
}

function clearDragState() {
  dragSourceIndex.value = null;
  dragTargetIndex.value = null;
}

function mergeEntries(sourceIndex, targetIndex) {
  const lower = Math.min(sourceIndex, targetIndex);
  const upper = Math.max(sourceIndex, targetIndex);
  try {
    const merged = {
      start: editableEntries.value[lower].start,
      end: editableEntries.value[upper].end,
      text: editableEntries.value
        .slice(lower, upper + 1)
        .map(entry => entry.text)
        .join(' ')
    };
    const updated = [
      ...editableEntries.value.slice(0, lower),
      merged,
      ...editableEntries.value.slice(upper + 1)
    ];
    editableEntries.value = assignIndexes(updated);
  } catch (err) {
    console.error(err);
    alert('Unable to combine the selected entries.');
  }
}

function resetTranscripts() {
  try {
    editableEntries.value = cloneEntries(baselineEntries.value);
    clearDragState();
    clipStatus.value = '';
  } catch (err) {
    console.error(err);
    alert('Unable to reset transcripts.');
  }
}

async function generateClips() {
  if (!authState.userEmail) {
    clipStatus.value = 'You must be logged in.';
    return;
  }
  if (!decodedFileName.value) {
    clipStatus.value = 'Missing file reference.';
    return;
  }
  if (!editableEntries.value.length) {
    clipStatus.value = 'No transcript data to process.';
    return;
  }
  clipLoading.value = true;
  clipStatus.value = '';
  try {
    await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/cut',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'golingo-vendor-video-upload',
          key: decodedFileName.value,
          movie_name: decodedFileName.value,
          srt: editedSrt.value,
          lang: inputLang.value || outputLang.value || 'en',
          user_name: authState.userEmail
        })
      }
    );
    clipStatus.value = 'Clip generation requested.';
  } catch (err) {
    console.error(err);
    clipStatus.value = 'Failed to request clips.';
  } finally {
    clipLoading.value = false;
  }
}

watch(
  () => [decodedFileName.value, authState.userEmail],
  ([file, email], prevValues = []) => {
    const [prevFile, prevEmail] = prevValues;
    if (file && email && (file !== prevFile || email !== prevEmail)) {
      fetchTranscripts();
    }
  },
  { immediate: true }
);

onMounted(() => {
  clearDragState();
});

onBeforeUnmount(() => {
  clearDragState();
});
</script>

<style scoped>
.detail {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgb(0 0 0 / 5%);
}

.back {
  border: none;
  background: transparent;
  color: #4e73df;
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 16px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

h2 {
  margin: 0;
}

.subtitle {
  margin: 4px 0 0;
  color: #858796;
}

.actions a {
  text-decoration: none;
  color: #fff;
  background-color: #36b9cc;
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: 600;
}

.player {
  margin: 20px 0;
}

.player video {
  width: 100%;
  max-height: 360px;
  border-radius: 8px;
  border: 1px solid #e3e6f0;
}

.tabs {
  display: flex;
  margin-bottom: 12px;
}

.tabs button {
  border: none;
  padding: 8px 16px;
  border-bottom: 3px solid transparent;
  background: none;
  cursor: pointer;
  font-weight: 600;
}

.tabs button.active {
  border-color: #4e73df;
  color: #4e73df;
}

.panel {
  min-height: 120px;
}

.error {
  color: #e74a3b;
}

.transcript-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.transcript-block h3 {
  margin: 0 0 10px;
  color: #4e73df;
}

.original-block h3 {
  color: #1cc88a;
}

.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.edit-toolbar button {
  border: none;
  padding: 8px 14px;
  border-radius: 4px;
  background-color: #4e73df;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.edit-toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  color: #858796;
  font-size: 0.9rem;
}

.editable-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.editable-entry {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #d1d5e6;
  background: #ffffff;
  cursor: grab;
  user-select: none;
  box-shadow: 0 6px 18px rgb(0 0 0 / 6%);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.editable-entry.drag-source {
  border-color: #1cc88a;
  transform: scale(0.98);
  opacity: 0.85;
}

.editable-entry.drag-target {
  border-color: #4e73df;
  background-color: #f0f3ff;
}

.editable-entry .time {
  font-weight: 600;
  color: #4e73df;
  margin-bottom: 6px;
}

.clip-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.clip-actions button {
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  background-color: #1cc88a;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.clip-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clip-status {
  color: #4e73df;
  font-weight: 600;
}
</style>

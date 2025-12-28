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
      <video ref="videoRef" controls playsinline webkit-playsinline :src="videoUrl"></video>
    </section>

    <div class="tabs">
      <button :class="{ active: activeTab === 'show' }" @click="setTab('show')">
        {{ showTabLabel }}
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
          <h3>{{ showTabLabel }}</h3>
          <TranscriptViewer
            :entries="displayTranscriptEntries"
            :selectable="!!videoUrl"
            @select="handleTranscriptSelect"
          />
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
          <span v-if="editLangLabel" class="lang-hint">Editing: {{ editLangLabel }}</span>
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
            @click="handleEditableEntryClick(entry)"
            @dragstart="handleDragStart($event, index)"
            @dragover.prevent="handleDragOver($event, index)"
            @dragleave.prevent="handleDragLeave(index)"
            @drop.prevent="handleDrop(index)"
            @dragend="handleDragEnd"
          >
            <div class="time">
              {{ entry.start }} → {{ entry.end }}
            </div>
            <div v-if="isTranslated" class="entry-texts">
              <p v-if="entry.inputText" class="text-line input">{{ entry.inputText }}</p>
              <p v-if="entry.outputText" class="text-line output">{{ entry.outputText }}</p>
            </div>
            <p v-else>{{ entry.text }}</p>
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
const editBaseVariant = ref('output');
const clipLoading = ref(false);
const clipStatus = ref('');
const videoRef = ref(null);
const showTabLabel = 'Show transcripts';
let videoSegmentEndSeconds = null;
let videoTimeUpdateHandler = null;
let lastDragStartAt = 0;

const decodedFileName = computed(() => {
  try {
    return decodeURIComponent(props.fileName);
  } catch {
    return props.fileName;
  }
});

const displayName = computed(() => decodedFileName.value.split('/').pop());
const videoUrl = computed(() => props.videoUrl || '');
const editedSrt = computed(() =>
  entriesToSrt(
    editableEntries.value.map(entry => ({
      start: entry.start,
      end: entry.end,
      text:
        editBaseVariant.value === 'input'
          ? entry.inputText || entry.text || ''
          : entry.outputText || entry.text || ''
    }))
  )
);
const editedLang = computed(() => {
  if (editBaseVariant.value === 'input') return inputLang.value || outputLang.value || 'en';
  return outputLang.value || inputLang.value || 'en';
});
const originalSrtInput = computed(() => srtInput.value || '');
const isTranslated = computed(
  () =>
    inputLang.value &&
    outputLang.value &&
    inputLang.value.toLowerCase() !== outputLang.value.toLowerCase()
);
const editLangLabel = computed(() => {
  const input = (inputLang.value || '').trim();
  const output = (outputLang.value || '').trim();
  if (isTranslated.value) return input || output;
  return output || input;
});
const parsedInputEntries = computed(() =>
  originalSrtInput.value
    ? assignIndexes(parseSrt(originalSrtInput.value))
    : []
);
const displayTranscriptEntries = computed(() => {
  const outputEntries = displayEntries.value;
  const inputEntries = parsedInputEntries.value;
  const shouldOverlay = isTranslated.value && inputEntries.length;
  if (shouldOverlay) {
    return mergeEntriesWithOverlay(inputEntries, outputEntries);
  }
  const singleSource = outputEntries.length ? outputEntries : inputEntries;
  let counter = 1;
  return singleSource.map(entry =>
    buildSingleViewerEntry(entry, 'single', counter++)
  );
});

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

function buildEditableEntries(baseEntries, overlayEntries, baseVariant) {
  const updatedBase = baseEntries.map(entry => ({
    ...entry,
    text: (entry.text || '').trim()
  }));
  if (!overlayEntries?.length) {
    return assignIndexes(updatedBase);
  }

  const normalizedOverlay = overlayEntries.map(entry => ({
    ...entry,
    text: (entry.text || '').trim()
  }));

  const merged = [];
  let overlayIndex = 0;

  for (const baseEntry of updatedBase) {
    let matchedOverlayText = '';
    while (overlayIndex < normalizedOverlay.length) {
      const overlayEntry = normalizedOverlay[overlayIndex];
      if (timestampsMatch(baseEntry, overlayEntry)) {
        matchedOverlayText = overlayEntry.text || '';
        overlayIndex += 1;
        break;
      }
      const overlayStart = timestampToMs(overlayEntry.start);
      const baseStart = timestampToMs(baseEntry.start);
      if (overlayStart < baseStart - 20) {
        overlayIndex += 1;
        continue;
      }
      break;
    }

    if (baseVariant === 'input') {
      merged.push({
        ...baseEntry,
        inputText: baseEntry.text || '',
        outputText: matchedOverlayText
      });
    } else {
      merged.push({
        ...baseEntry,
        inputText: matchedOverlayText,
        outputText: baseEntry.text || ''
      });
    }
  }

  return assignIndexes(merged);
}

function timestampToMs(timestamp) {
  if (!timestamp) return 0;
  const [hours = '0', minutes = '0', secondsWithMs = '0'] = timestamp
    .trim()
    .split(':');
  const [seconds = '0', fraction = '0'] = secondsWithMs
    .split(/[.,]/)
    .map(part => part.trim());
  const paddedFraction = `${fraction}000`.slice(0, 3);
  const hoursMs = Number(hours) * 3600000;
  const minutesMs = Number(minutes) * 60000;
  const secondsMs = Number(seconds) * 1000;
  const fractionMs = Number(paddedFraction);
  return (hoursMs || 0) + (minutesMs || 0) + (secondsMs || 0) + (fractionMs || 0);
}

function stopSegmentPlayback() {
  const video = videoRef.value;
  if (!video) return;
  if (videoTimeUpdateHandler) {
    video.removeEventListener('timeupdate', videoTimeUpdateHandler);
    videoTimeUpdateHandler = null;
  }
  videoSegmentEndSeconds = null;
}

function seekVideoWhenReady(video, seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  if (video.readyState >= 1) {
    try {
      video.currentTime = safeSeconds;
    } catch (err) {
      console.warn('Unable to seek video.', err);
    }
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const handleLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      try {
        video.currentTime = safeSeconds;
      } catch (err) {
        console.warn('Unable to seek video.', err);
      }
      resolve();
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
  });
}

async function playTranscriptSegment(startTimestamp, endTimestamp) {
  const video = videoRef.value;
  if (!video) return;

  const startSeconds = timestampToMs(startTimestamp) / 1000;
  const endSeconds = endTimestamp ? timestampToMs(endTimestamp) / 1000 : null;

  stopSegmentPlayback();

  await seekVideoWhenReady(video, startSeconds);

  if (Number.isFinite(endSeconds) && endSeconds !== null && endSeconds > startSeconds + 0.01) {
    videoSegmentEndSeconds = endSeconds;
    videoTimeUpdateHandler = () => {
      if (videoSegmentEndSeconds === null) return;
      if (video.currentTime >= videoSegmentEndSeconds) {
        video.pause();
        stopSegmentPlayback();
      }
    };
    video.addEventListener('timeupdate', videoTimeUpdateHandler);
  }

  try {
    await video.play();
  } catch (err) {
    console.warn('Unable to autoplay segment.', err);
  }
}

function handleTranscriptSelect(entry) {
  playTranscriptSegment(entry?.start, entry?.end);
}

function timestampsMatch(entryA = {}, entryB = {}) {
  const startDelta = Math.abs(timestampToMs(entryA.start) - timestampToMs(entryB.start));
  const endA = entryA.end;
  const endB = entryB.end;
  const endDelta = Math.abs(timestampToMs(endA) - timestampToMs(endB));
  const startsMatch = startDelta <= 20;
  if (!startsMatch) return false;
  if (!endA || !endB) return true;
  return endDelta <= 20;
}

function buildSingleViewerEntry(entry = {}, variant, id) {
  return {
    id: `entry-${id}`,
    start: entry.start || '',
    end: entry.end || '',
    segments: [
      {
        text: (entry.text || '').trim(),
        variant
      }
    ]
  };
}

function buildCombinedViewerEntry(primaryEntry = {}, secondaryEntry = {}, id) {
  return {
    id: `entry-${id}`,
    start: primaryEntry.start || secondaryEntry.start || '',
    end: primaryEntry.end || secondaryEntry.end || '',
    segments: [
      {
        text: (primaryEntry.text || '').trim(),
        variant: 'input'
      },
      {
        text: (secondaryEntry.text || '').trim(),
        variant: 'output'
      }
    ]
  };
}

function mergeEntriesWithOverlay(inputEntries, outputEntries) {
  const merged = [];
  let inputIndex = 0;
  let outputIndex = 0;
  let counter = 1;
  while (
    inputIndex < inputEntries.length ||
    outputIndex < outputEntries.length
  ) {
    const inputEntry = inputEntries[inputIndex];
    const outputEntry = outputEntries[outputIndex];
    if (inputEntry && outputEntry) {
      if (timestampsMatch(inputEntry, outputEntry)) {
        merged.push(
          buildCombinedViewerEntry(inputEntry, outputEntry, counter++)
        );
        inputIndex += 1;
        outputIndex += 1;
        continue;
      }
      const inputMs = timestampToMs(inputEntry.start);
      const outputMs = timestampToMs(outputEntry.start);
      if (inputMs <= outputMs) {
        merged.push(buildSingleViewerEntry(inputEntry, 'input', counter++));
        inputIndex += 1;
      } else {
        merged.push(buildSingleViewerEntry(outputEntry, 'output', counter++));
        outputIndex += 1;
      }
      continue;
    }
    if (inputEntry) {
      merged.push(buildSingleViewerEntry(inputEntry, 'input', counter++));
      inputIndex += 1;
      continue;
    }
    if (outputEntry) {
      merged.push(buildSingleViewerEntry(outputEntry, 'output', counter++));
      outputIndex += 1;
    }
  }
  return merged;
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
    const outputSrtValue = body?.srt || '';
    const inputSrtValue = body?.srt_input || '';
    const inputLanguage = body?.input_lang || '';
    const outputLanguage = body?.output_lang || '';

    srtInput.value = inputSrtValue;
    inputLang.value = inputLanguage;
    outputLang.value = outputLanguage;

    const isActuallyTranslated =
      inputLanguage &&
      outputLanguage &&
      inputLanguage.toLowerCase() !== outputLanguage.toLowerCase();

    const parsedOutput = outputSrtValue
      ? assignIndexes(parseSrt(outputSrtValue))
      : [];
    const parsedInput = inputSrtValue ? assignIndexes(parseSrt(inputSrtValue)) : [];

    if (!parsedOutput.length && !parsedInput.length) {
      error.value = 'Transcript not available for this video.';
      baselineEntries.value = [];
      displayEntries.value = [];
      editableEntries.value = [];
      return;
    }

    displayEntries.value = cloneEntries(parsedOutput);

    const baseVariant = isActuallyTranslated && parsedInput.length ? 'input' : 'output';
    editBaseVariant.value = baseVariant;
    const baseEntries =
      baseVariant === 'input'
        ? parsedInput
        : parsedOutput.length
          ? parsedOutput
          : parsedInput;
    const overlayEntries = baseVariant === 'input' ? parsedOutput : parsedInput;
    const editable = isActuallyTranslated
      ? buildEditableEntries(baseEntries, overlayEntries, baseVariant)
      : assignIndexes(baseEntries);

    baselineEntries.value = cloneEntries(editable);
    editableEntries.value = cloneEntries(editable);
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
  lastDragStartAt = Date.now();
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

function handleEditableEntryClick(entry) {
  if (Date.now() - lastDragStartAt < 250) return;
  playTranscriptSegment(entry?.start, entry?.end);
}

function mergeEntries(sourceIndex, targetIndex) {
  const lower = Math.min(sourceIndex, targetIndex);
  const upper = Math.max(sourceIndex, targetIndex);
  try {
    const joinField = field =>
      editableEntries.value
        .slice(lower, upper + 1)
        .map(entry => (entry?.[field] || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();

    const merged = {
      start: editableEntries.value[lower].start,
      end: editableEntries.value[upper].end,
      text: joinField('text')
    };
    if (isTranslated.value) {
      merged.inputText = joinField('inputText');
      merged.outputText = joinField('outputText');
      merged.text =
        editBaseVariant.value === 'input'
          ? merged.inputText || merged.text
          : merged.outputText || merged.text;
    }
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
          lang: editedLang.value,
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
  stopSegmentPlayback();
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

.lang-hint {
  color: #4e73df;
  font-size: 0.9rem;
  font-weight: 600;
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

.entry-texts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.text-line {
  margin: 0;
  color: #2c3e50;
}

.text-line.input {
  color: #1cc88a;
}

.text-line.output {
  color: #4e73df;
  font-weight: 600;
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

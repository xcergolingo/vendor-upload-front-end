<template>
  <div class="detail">
    <header class="compact-header">
      <button class="back" @click="goBack">← Back</button>
      <a
        v-if="videoUrl"
        class="download-btn"
        :href="videoUrl"
        target="_blank"
        rel="noreferrer"
        download
      >
        Download video
      </a>
    </header>

    <section v-if="videoUrl" class="player">
      <video ref="videoRef" controls playsinline webkit-playsinline :src="videoUrl"></video>
      <div class="player-controls">
        <div class="speed-control">
          <label>Speed:</label>
          <select v-model="playbackSpeed" @change="updatePlaybackSpeed">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        <button class="tips-btn" @click="toggleTips">
          ▶ {{ showTips ? 'Hide tips' : 'Show tips' }}
        </button>
      </div>
      <div v-if="showTips" class="tips-panel">
        <p><strong>Tips:</strong></p>
        <ul>
          <li>Use +/- buttons to adjust timestamps by 100ms</li>
          <li>Click → to play from that timestamp</li>
          <li>Drag entries to merge them</li>
          <li>Edit to modify text and times</li>
        </ul>
      </div>
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
          <button class="reset-btn" @click="resetTranscripts" :disabled="!isDirty">
            Reset transcripts
          </button>
          <span v-if="editLangLabel" class="lang-hint">Editing: {{ editLangLabel }}</span>
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
          >
            <!-- Entry Card -->
            <div class="entry-card">
              <!-- Top action buttons (clone/delete) -->
              <div class="entry-top-actions">
                <button type="button" class="top-btn add-btn" @click.stop="cloneEntry(index)" title="Add/Clone">+</button>
                <button type="button" class="top-btn delete-btn" @click.stop="deleteEntry(index)" title="Delete">×</button>
              </div>

              <!-- Time controls row 1: Start time + Merge buttons -->
              <div class="time-row">
                <button 
                  type="button" 
                  class="time-adjust" 
                  @click.stop="adjustTime(index, 'start', -100)"
                  @dblclick.stop.prevent="adjustTime(index, 'start', -100)"
                >−</button>
                <span 
                  class="time-value" 
                  :class="{ 'editing': editingTimeIndex === index && editingTimeField === 'start' }"
                  @click.stop="playFromStartTime(entry.start, index)"
                  @dblclick.stop.prevent="startTimeEdit(index, 'start', entry.start)"
                >
                  <input 
                    v-if="editingTimeIndex === index && editingTimeField === 'start'"
                    v-model="editingTimeValue"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9:,]*"
                    class="time-input"
                    @blur="saveTimeEdit(index, 'start')"
                    @keyup.enter="saveTimeEdit(index, 'start')"
                    ref="timeInputRef"
                  />
                  <template v-else>{{ entry.start }}</template>
                </span>
                <button 
                  type="button" 
                  class="time-adjust" 
                  @click.stop="adjustTime(index, 'start', 100)"
                  @dblclick.stop.prevent="adjustTime(index, 'start', 100)"
                >+</button>
                <button 
                  type="button" 
                  class="copy-btn" 
                  @click.stop="copyEndFromPrevious(index)" 
                  :disabled="index === 0"
                  title="Copy end time from previous clip"
                >←</button>
                <button type="button" class="merge-btn" @click.stop="mergeWithPrevious(index)" :disabled="index === 0">↑ Merge</button>
                <button type="button" class="merge-btn" @click.stop="mergeWithNext(index)" :disabled="index === editableEntries.length - 1">↓</button>
              </div>

              <!-- Time controls row 2: End time + Edit/Regen buttons -->
              <div class="time-row">
                <button 
                  type="button" 
                  class="time-adjust" 
                  @click.stop="adjustTime(index, 'end', -100)"
                  @dblclick.stop.prevent="adjustTime(index, 'end', -100)"
                >−</button>
                <span 
                  class="time-value"
                  :class="{ 'editing': editingTimeIndex === index && editingTimeField === 'end' }"
                  @click.stop="playFromEndTimeBefore(entry.end, 2500)"
                  @dblclick.stop.prevent="startTimeEdit(index, 'end', entry.end)"
                >
                  <input 
                    v-if="editingTimeIndex === index && editingTimeField === 'end'"
                    v-model="editingTimeValue"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9:,]*"
                    class="time-input"
                    @blur="saveTimeEdit(index, 'end')"
                    @keyup.enter="saveTimeEdit(index, 'end')"
                  />
                  <template v-else>{{ entry.end }}</template>
                </span>
                <button 
                  type="button" 
                  class="time-adjust" 
                  @click.stop="adjustTime(index, 'end', 100)"
                  @dblclick.stop.prevent="adjustTime(index, 'end', 100)"
                >+</button>
                <button 
                  type="button" 
                  class="copy-btn" 
                  @click.stop="copyStartFromNext(index)" 
                  :disabled="index === editableEntries.length - 1"
                  title="Copy start time from next clip"
                >→</button>
                <button type="button" class="action-btn edit-btn" @click.stop="startEntryEdit(entry, index)" :disabled="editingIndex !== null && editingIndex !== index">Edit</button>
                <button type="button" class="action-btn regen-btn" @click.stop="regenEntry(index)" :disabled="entry.isRegenerating">{{ entry.isRegenerating ? 'Gen...' : 'Gen' }}</button>
              </div>

              <!-- Editor panel (when editing full entry) -->
              <div v-if="editingIndex === index" class="entry-editor">
                <!-- Text preview (shows translation) -->
                <div class="edit-text-preview">
                  <p v-if="isTranslated" class="text-line input">{{ entry.inputText || '' }}</p>
                  <p v-if="isTranslated" class="text-line output">{{ entry.outputText || '' }}</p>
                  <p v-if="!isTranslated" class="text-line single">{{ entry.text }}</p>
                </div>
                <div class="editor-time-row">
                  <button type="button" class="editor-time-btn" @click.stop="playFromStartTime(draftStart, index)">Start</button>
                  <input v-model="draftStart" class="editor-input time-input-edit" type="text" inputmode="numeric" />
                </div>
                <div class="editor-time-row">
                  <button type="button" class="editor-time-btn" @click.stop="playFromEndTimeBefore(draftEnd, 2500)">End</button>
                  <input v-model="draftEnd" class="editor-input time-input-edit" type="text" inputmode="numeric" />
                </div>
                <template v-if="isTranslated">
                  <label class="editor-label input">Input</label>
                  <textarea v-model="draftInputText" class="editor-textarea input" rows="2" />
                  <label class="editor-label output">Output</label>
                  <textarea v-model="draftOutputText" class="editor-textarea output" rows="2" />
                </template>
                <template v-else>
                  <textarea v-model="draftSingleText" class="editor-textarea single" rows="3" />
                </template>
                <div class="editor-actions">
                  <button type="button" class="editor-btn save" @click.stop="saveEntryEdit(index)">Save</button>
                  <button type="button" class="editor-btn cancel" @click.stop="cancelEntryEdit">Cancel</button>
                </div>
              </div>

              <!-- Text content - tap to play, double-tap to play from middle -->
              <div v-else class="entry-content" 
                @click.stop="playEntryFull(entry)"
                @dblclick.stop.prevent="playEntryFromMiddle(entry)"
              >
                <p v-if="isTranslated" class="text-line input">{{ entry.inputText || '' }}</p>
                <p v-if="isTranslated" class="text-line output">{{ entry.outputText || '' }}</p>
                <p v-if="!isTranslated" class="text-line single">{{ entry.text }}</p>
              </div>
            </div>
          </div>
        </div>
                <div class="clip-actions">
          <div class="clip-folder">
            <div class="folder-select-row">
              <select
                id="clip-folder-select"
                v-model="selectedFolderPath"
                :disabled="folderLoading || !folderOptions.length"
              >
                <option value="">None</option>
                <option v-for="option in folderOptions" :key="option.path" :value="option.path">
                  {{ option.label }}
                </option>
              </select>
              <button 
                type="button" 
                class="delete-folder-btn" 
                @click="deleteSelectedFolder"
                :disabled="!selectedFolderPath || deletingFolder"
                title="Delete selected folder"
              >
                {{ deletingFolder ? '...' : '🗑' }}
              </button>
            </div>
            <span v-if="folderLoading" class="clip-folder-status">Loading folders...</span>
            <span v-else-if="folderError" class="clip-folder-status error">{{ folderError }}</span>
          </div>
          <button class="generate-btn" @click="generateClips" :disabled="clipLoading || !editableEntries.length">
            {{ clipLoading ? 'Generating...' : 'Generate clips' }}
          </button>
          <span v-if="clipStatus" class="clip-status">{{ clipStatus }}</span>
        </div>
        <div class="new-subfolder">
          <h4>New subfolder</h4>
          <div class="subfolder-form">
            <input 
              v-model="newSubfolderName" 
              type="text" 
              placeholder="Folder name"
              class="subfolder-input"
            />
            <button 
              class="create-btn" 
              @click="createSubfolder" 
              :disabled="!newSubfolderName.trim() || creatingSubfolder"
            >
              {{ creatingSubfolder ? 'Creating...' : 'Create' }}
            </button>
          </div>
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
const editingIndex = ref(null);
const draftStart = ref('');
const draftEnd = ref('');
const draftInputText = ref('');
const draftOutputText = ref('');
const draftSingleText = ref('');
const clipLoading = ref(false);
const clipStatus = ref('');
const manualFolderPaths = ref([]);
const selectedFolderPath = ref('');
const folderLoading = ref(false);
const folderError = ref('');
const videoRef = ref(null);
const playbackSpeed = ref('1');
const showTips = ref(false);
const newSubfolderName = ref('');
const creatingSubfolder = ref(false);
const deletingFolder = ref(false);
const editingTimeIndex = ref(null);
const editingTimeField = ref(null);
const editingTimeValue = ref('');
const showTabLabel = 'Show transcripts';
let videoSegmentEndSeconds = null;
let videoTimeUpdateHandler = null;
let lastDragStartAt = 0;
const isSyncingTranscriptState = ref(false);
let uploadTimer = null;
let lastUploadedSrt = '';

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
const outputSrt = computed(() =>
  entriesToSrt(
    editableEntries.value.map(entry => ({
      start: entry.start,
      end: entry.end,
      text: entry.outputText || entry.text || ''
    }))
  )
);

function normalizeFolderPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function buildFolderNodes(paths) {
  const nodes = new Map();
  const ensureNode = path => {
    if (nodes.has(path)) return nodes.get(path);
    const segments = path.split('/');
    const name = segments[segments.length - 1] || '';
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : '';
    const node = {
      path,
      name,
      parentPath,
      children: []
    };
    nodes.set(path, node);
    return node;
  };

  paths.forEach(path => {
    const normalized = normalizeFolderPath(path);
    if (!normalized) return;
    const segments = normalized.split('/');
    let current = '';
    segments.forEach(segment => {
      current = current ? `${current}/${segment}` : segment;
      ensureNode(current);
    });
  });

  nodes.forEach(node => {
    if (node.parentPath && nodes.has(node.parentPath)) {
      nodes.get(node.parentPath).children.push(node);
    }
  });

  nodes.forEach(node => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  });

  const roots = Array.from(nodes.values()).filter(node => !node.parentPath);
  roots.sort((a, b) => a.name.localeCompare(b.name));
  return roots;
}

function flattenFolderNodes(nodes, depth = 0) {
  const flattened = [];
  nodes.forEach(node => {
    flattened.push({
      ...node,
      depth
    });
    if (node.children.length) {
      flattened.push(...flattenFolderNodes(node.children, depth + 1));
    }
  });
  return flattened;
}

const folderNodesFlat = computed(() => {
  if (!manualFolderPaths.value.length) return [];
  const nodes = buildFolderNodes(manualFolderPaths.value);
  return flattenFolderNodes(nodes);
});

const folderOptions = computed(() =>
  folderNodesFlat.value.map(node => ({
    path: node.path,
    label: `${'-- '.repeat(node.depth)}${node.name}`
  }))
);
const editedLang = computed(() => {
  if (editBaseVariant.value === 'input') return inputLang.value || outputLang.value || 'en';
  return outputLang.value || inputLang.value || 'en';
});
const outputLangForPayload = computed(() => outputLang.value || inputLang.value || 'en');
function normalizeLang(value) {
  const textValue = String(value ?? '').trim();
  if (!textValue) return '';
  const lowered = textValue.toLowerCase();
  if (lowered === 'none' || lowered === 'null' || lowered === 'undefined') return '';
  return textValue;
}
const cutLang = computed(() => normalizeLang(inputLang.value) || normalizeLang(outputLang.value) || 'en');
const cutLangTranslation = computed(() => normalizeLang(outputLang.value));
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

async function uploadEditedTranscript() {
  if (!authState.userEmail) return;
  if (!decodedFileName.value) return;
  if (!baselineEntries.value.length) return;

  const payloadSrt = isDirty.value ? editedSrt.value : '';
  if (payloadSrt === lastUploadedSrt) return;
  lastUploadedSrt = payloadSrt;

  try {
    await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/upload-edited-srt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authState.userEmail,
          file_name: decodedFileName.value,
          srt_edited: payloadSrt
        })
      }
    );
  } catch (err) {
    console.error('Failed to upload edited transcripts.', err);
  }
}

function scheduleEditedTranscriptUpload() {
  if (isSyncingTranscriptState.value) return;
  if (uploadTimer) {
    clearTimeout(uploadTimer);
  }
  uploadTimer = setTimeout(() => {
    uploadEditedTranscript();
  }, 600);
}

function setTab(tab) {
  activeTab.value = tab;
  cancelEntryEdit();
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
  
  // If entry counts are similar, use index-based matching as fallback
  const useIndexFallback = Math.abs(updatedBase.length - normalizedOverlay.length) <= 2;

  for (let baseIndex = 0; baseIndex < updatedBase.length; baseIndex++) {
    const baseEntry = updatedBase[baseIndex];
    let matchedOverlayText = '';
    
    // First try: find by timestamp match (with wider tolerance)
    for (let i = 0; i < normalizedOverlay.length; i++) {
      const overlayEntry = normalizedOverlay[i];
      const startDelta = Math.abs(timestampToMs(baseEntry.start) - timestampToMs(overlayEntry.start));
      // Wider tolerance: 500ms instead of 20ms
      if (startDelta <= 500) {
        matchedOverlayText = overlayEntry.text || '';
        break;
      }
    }
    
    // Fallback: match by index if counts are similar and no timestamp match found
    if (!matchedOverlayText && useIndexFallback && baseIndex < normalizedOverlay.length) {
      matchedOverlayText = normalizedOverlay[baseIndex].text || '';
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
  isSyncingTranscriptState.value = true;
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
    let body =
      payload && typeof payload.body === 'object' ? payload.body : payload;
    if (payload && typeof payload.body === 'string') {
      try {
        body = JSON.parse(payload.body);
      } catch (err) {
        console.warn('Unable to parse transcript response body.', err);
      }
    }
    const outputSrtValue = body?.srt || '';
    const editedSrtValue = body?.srt_edited || '';
    const inputSrtValue = body?.srt_input || '';
    const inputLanguage =
      body?.input_lang ?? body?.lang ?? body?.lang_input ?? body?.input_language ?? '';
    const outputLanguage =
      body?.output_lang ??
      body?.lang_translation ??
      body?.translated_lang ??
      body?.output_language ??
      '';

    srtInput.value = inputSrtValue;
    inputLang.value = inputLanguage;
    outputLang.value = outputLanguage;

    const isActuallyTranslated =
      inputLanguage &&
      outputLanguage &&
      inputLanguage.toLowerCase() !== outputLanguage.toLowerCase();

    const parsedOutput = outputSrtValue ? assignIndexes(parseSrt(outputSrtValue)) : [];
    const parsedInput = inputSrtValue ? assignIndexes(parseSrt(inputSrtValue)) : [];
    const outputSrtForEditing = editedSrtValue || outputSrtValue;
    const parsedOutputForEditing = outputSrtForEditing
      ? assignIndexes(parseSrt(outputSrtForEditing))
      : [];

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
        : parsedOutputForEditing.length
          ? parsedOutputForEditing
          : parsedInput;
    const overlayEntries = baseVariant === 'input' ? parsedOutputForEditing : parsedInput;
    const baselineBaseEntries =
      baseVariant === 'input'
        ? parsedInput
        : parsedOutput.length
          ? parsedOutput
          : parsedInput;
    const baselineOverlayEntries = baseVariant === 'input' ? parsedOutput : parsedInput;
    const editable = isActuallyTranslated
      ? buildEditableEntries(baseEntries, overlayEntries, baseVariant)
      : assignIndexes(baseEntries);
    const baseline = isActuallyTranslated
      ? buildEditableEntries(baselineBaseEntries, baselineOverlayEntries, baseVariant)
      : assignIndexes(baselineBaseEntries);

    baselineEntries.value = cloneEntries(baseline);
    editableEntries.value = cloneEntries(editable);
    lastUploadedSrt = editedSrtValue || '';

    clearDragState();
  } catch (err) {
    console.error(err);
    error.value = 'Failed to fetch transcripts. Please try again.';
  } finally {
    isSyncingTranscriptState.value = false;
    loading.value = false;
  }
}

async function fetchFolderTree() {
  if (!authState.userEmail || folderLoading.value) return;
  folderLoading.value = true;
  folderError.value = '';
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/folder_fetch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authState.userEmail })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
    const payload = await response.json();
    const folderPaths = Array.isArray(payload?.folders)
      ? payload.folders.map(folder => folder?.path).filter(Boolean)
      : [];
    manualFolderPaths.value = folderPaths;
  } catch (err) {
    console.error(err);
    folderError.value = 'Unable to load folders. Please try again.';
  } finally {
    folderLoading.value = false;
  }
}

function updatePlaybackSpeed() {
  if (videoRef.value) {
    videoRef.value.playbackRate = parseFloat(playbackSpeed.value);
  }
}

function toggleTips() {
  showTips.value = !showTips.value;
}

function parseTimeToMs(timeStr) {
  // Parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" format to milliseconds
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const [, hours, minutes, seconds, ms] = match;
  return (parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(ms);
}

function msToTimeStr(ms) {
  // Convert milliseconds to "HH:MM:SS,mmm" format
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function adjustTime(index, field, deltaMs) {
  const entry = editableEntries.value[index];
  if (!entry) return;
  const currentMs = parseTimeToMs(entry[field]);
  const newMs = Math.max(0, currentMs + deltaMs);
  entry[field] = msToTimeStr(newMs);
}

function playFromTime(timeStr) {
  if (!videoRef.value) return;
  const ms = parseTimeToMs(timeStr);
  videoRef.value.currentTime = ms / 1000;
  videoRef.value.play();
}

function playFromTimeBefore(timeStr, beforeMs) {
  if (!videoRef.value) return;
  const ms = parseTimeToMs(timeStr);
  const targetMs = Math.max(0, ms - beforeMs);
  videoRef.value.currentTime = targetMs / 1000;
  videoRef.value.play();
}

// Play from start time (just plays, no stop)
// Play from start time and stop at end time of the entry
function playFromStartTime(startTimeStr, index) {
  if (!videoRef.value) return;
  const entry = editableEntries.value[index];
  if (!entry) return;
  const startMs = parseTimeToMs(startTimeStr);
  const endMs = parseTimeToMs(entry.end);
  videoRef.value.currentTime = startMs / 1000;
  videoRef.value.play();
  
  // Stop at end time
  const checkStop = () => {
    if (videoRef.value && videoRef.value.currentTime >= endMs / 1000) {
      videoRef.value.pause();
      videoRef.value.removeEventListener('timeupdate', checkStop);
    }
  };
  videoRef.value.addEventListener('timeupdate', checkStop);
}

// Play from 2.5s before end time and stop at end time
function playFromEndTimeBefore(endTimeStr, beforeMs) {
  if (!videoRef.value) return;
  const endMs = parseTimeToMs(endTimeStr);
  const targetMs = Math.max(0, endMs - beforeMs);
  videoRef.value.currentTime = targetMs / 1000;
  videoRef.value.play();
  
  // Stop at end time
  const checkStop = () => {
    if (videoRef.value && videoRef.value.currentTime >= endMs / 1000) {
      videoRef.value.pause();
      videoRef.value.removeEventListener('timeupdate', checkStop);
    }
  };
  videoRef.value.addEventListener('timeupdate', checkStop);
}

// Play from start to end (stop at end timestamp)
function playEntryFull(entry) {
  if (!videoRef.value) return;
  const startMs = parseTimeToMs(entry.start);
  const endMs = parseTimeToMs(entry.end);
  videoRef.value.currentTime = startMs / 1000;
  videoRef.value.play();
  
  // Set up listener to stop at end time
  const checkStop = () => {
    if (videoRef.value && videoRef.value.currentTime >= endMs / 1000) {
      videoRef.value.pause();
      videoRef.value.removeEventListener('timeupdate', checkStop);
    }
  };
  videoRef.value.addEventListener('timeupdate', checkStop);
}

// Play from middle to end (stop at end timestamp)
function playEntryFromMiddle(entry) {
  if (!videoRef.value) return;
  const startMs = parseTimeToMs(entry.start);
  const endMs = parseTimeToMs(entry.end);
  const middleMs = (startMs + endMs) / 2;
  videoRef.value.currentTime = middleMs / 1000;
  videoRef.value.play();
  
  // Set up listener to stop at end time
  const checkStop = () => {
    if (videoRef.value && videoRef.value.currentTime >= endMs / 1000) {
      videoRef.value.pause();
      videoRef.value.removeEventListener('timeupdate', checkStop);
    }
  };
  videoRef.value.addEventListener('timeupdate', checkStop);
}

// Copy end time from previous clip to this clip's start
function copyEndFromPrevious(index) {
  if (index === 0) return;
  const previousEntry = editableEntries.value[index - 1];
  const currentEntry = editableEntries.value[index];
  if (previousEntry && currentEntry) {
    currentEntry.start = previousEntry.end;
  }
}

// Copy start time from next clip to this clip's end
function copyStartFromNext(index) {
  if (index >= editableEntries.value.length - 1) return;
  const nextEntry = editableEntries.value[index + 1];
  const currentEntry = editableEntries.value[index];
  if (nextEntry && currentEntry) {
    currentEntry.end = nextEntry.start;
  }
}

function startTimeEdit(index, field, currentValue) {
  editingTimeIndex.value = index;
  editingTimeField.value = field;
  editingTimeValue.value = currentValue;
  // Focus the input on next tick
  setTimeout(() => {
    const input = document.querySelector('.time-input');
    if (input) input.focus();
  }, 50);
}

function saveTimeEdit(index, field) {
  if (editingTimeIndex.value !== index || editingTimeField.value !== field) return;
  const entry = editableEntries.value[index];
  if (entry && editingTimeValue.value) {
    entry[field] = editingTimeValue.value;
  }
  editingTimeIndex.value = null;
  editingTimeField.value = null;
  editingTimeValue.value = '';
}

function deleteEntry(index) {
  const confirmed = window.confirm('Delete this entry?');
  if (!confirmed) return;
  editableEntries.value.splice(index, 1);
}

function mergeWithPrevious(index) {
  if (index === 0) return;
  const current = editableEntries.value[index];
  const previous = editableEntries.value[index - 1];
  // Merge: keep previous start, use current end, concatenate text
  previous.end = current.end;
  if (previous.inputText !== undefined) {
    previous.inputText = (previous.inputText || '') + ' ' + (current.inputText || '');
    previous.outputText = (previous.outputText || '') + ' ' + (current.outputText || '');
  } else {
    previous.text = (previous.text || '') + ' ' + (current.text || '');
  }
  editableEntries.value.splice(index, 1);
}

function mergeWithNext(index) {
  if (index >= editableEntries.value.length - 1) return;
  const current = editableEntries.value[index];
  const next = editableEntries.value[index + 1];
  // Merge: keep current start, use next end, concatenate text
  current.end = next.end;
  if (current.inputText !== undefined) {
    current.inputText = (current.inputText || '') + ' ' + (next.inputText || '');
    current.outputText = (current.outputText || '') + ' ' + (next.outputText || '');
  } else {
    current.text = (current.text || '') + ' ' + (next.text || '');
  }
  editableEntries.value.splice(index + 1, 1);
}

async function regenEntry(index) {
  const entry = editableEntries.value[index];
  if (!entry || entry.isRegenerating) return;
  entry.isRegenerating = true;
  try {
    // Call regeneration API - placeholder for now
    // This would typically call an API to regenerate the translation
    await new Promise(resolve => setTimeout(resolve, 1000));
    // For now, just mark as done
    alert('Regeneration complete (API integration needed)');
  } catch (err) {
    console.error(err);
    alert('Failed to regenerate. Please try again.');
  } finally {
    entry.isRegenerating = false;
  }
}

function buildFolderPayload(paths) {
  const folders = [];
  const uniquePaths = Array.from(
    new Set(
      paths
        .map(path => normalizeFolderPath(path))
        .filter(Boolean)
    )
  );
  uniquePaths.forEach(path => {
    const segments = path.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : null;
    folders.push({
      id: path,
      name,
      parent_id: parentPath
    });
  });
  return folders;
}

async function saveFolderTree() {
  if (!authState.userEmail) return;
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/folder_update',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authState.userEmail.toLowerCase(),
          folders: buildFolderPayload(manualFolderPaths.value)
        })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function createSubfolder() {
  const name = newSubfolderName.value.trim();
  if (!name) return;
  if (name.includes('/')) {
    alert('Folder name cannot contain "/"');
    return;
  }
  creatingSubfolder.value = true;
  try {
    const parentPath = selectedFolderPath.value;
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    
    // Check if already exists
    if (manualFolderPaths.value.includes(newPath)) {
      alert('This folder already exists.');
      return;
    }
    
    manualFolderPaths.value = [...manualFolderPaths.value, newPath];
    await saveFolderTree();
    selectedFolderPath.value = newPath;
    newSubfolderName.value = '';
  } catch (err) {
    console.error(err);
    alert('Failed to create subfolder.');
  } finally {
    creatingSubfolder.value = false;
  }
}

async function deleteSelectedFolder() {
  const folderPath = selectedFolderPath.value;
  if (!folderPath) return;
  
  const confirmed = window.confirm(`Delete folder "${folderPath}" and all its subfolders?`);
  if (!confirmed) return;
  
  deletingFolder.value = true;
  try {
    // Remove this folder and all subfolders
    manualFolderPaths.value = manualFolderPaths.value.filter(
      path => path !== folderPath && !path.startsWith(folderPath + '/')
    );
    await saveFolderTree();
    selectedFolderPath.value = '';
  } catch (err) {
    console.error(err);
    alert('Failed to delete folder.');
  } finally {
    deletingFolder.value = false;
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
  if (editingIndex.value !== null) return;
  playTranscriptSegment(entry?.start, entry?.end);
}

function startEntryEdit(entry, index) {
  editingIndex.value = index;
  draftStart.value = entry?.start || '';
  draftEnd.value = entry?.end || '';
  draftSingleText.value = entry?.text || '';
  draftInputText.value = entry?.inputText ?? '';
  draftOutputText.value = entry?.outputText ?? '';
}

function cancelEntryEdit() {
  editingIndex.value = null;
  draftStart.value = '';
  draftEnd.value = '';
  draftSingleText.value = '';
  draftInputText.value = '';
  draftOutputText.value = '';
}

	function saveEntryEdit(index) {
	  const entry = editableEntries.value[index];
	  if (!entry) return;

  if (isTranslated.value) {
    const updated = {
      ...entry,
      start: draftStart.value,
      end: draftEnd.value,
      inputText: draftInputText.value,
      outputText: draftOutputText.value
    };
    updated.text =
      editBaseVariant.value === 'input'
        ? updated.inputText || ''
        : updated.outputText || '';
    editableEntries.value[index] = updated;
  } else {
    editableEntries.value[index] = {
      ...entry,
      start: draftStart.value,
      end: draftEnd.value,
      text: draftSingleText.value
    };
  }

	  cancelEntryEdit();
	}

	function cloneEntry(index) {
	  if (editingIndex.value !== null) return;
	  const entry = editableEntries.value[index];
	  if (!entry) return;
	  try {
	    clearDragState();
	    const cloned = { ...entry };
	    delete cloned.index;
	    const updated = [
	      ...editableEntries.value.slice(0, index + 1),
	      cloned,
	      ...editableEntries.value.slice(index + 1)
	    ];
	    editableEntries.value = assignIndexes(updated);
	  } catch (err) {
	    console.error(err);
	    alert('Unable to clone this entry.');
	  }
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
    cancelEntryEdit();
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
    const folderPath = normalizeFolderPath(selectedFolderPath.value);
    const cutPayload = {
      bucket: 'golingo-vendor-video-upload',
      key: decodedFileName.value,
      movie_name: decodedFileName.value,
      srt: editedSrt.value,
      srt_translation: outputSrt.value,
      lang: cutLang.value,
      lang_translation: cutLangTranslation.value,
      user_name: authState.userEmail
    };
    if (folderPath) {
      cutPayload.folder = folderPath;
    }
    console.log('[vendor/cut] payload summary', {
      bucket: cutPayload.bucket,
      key: cutPayload.key,
      movie_name: cutPayload.movie_name,
      lang: cutPayload.lang,
      lang_translation: cutPayload.lang_translation,
      user_name: cutPayload.user_name,
      srt_length: cutPayload.srt?.length ?? 0,
      srt_translation_length: cutPayload.srt_translation?.length ?? 0
    });
    console.log('[vendor/cut] payload', cutPayload);
    await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/cut',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cutPayload)
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

watch(
  () => authState.userEmail,
  email => {
    if (email) {
      fetchFolderTree();
    }
  },
  { immediate: true }
);

watch(
  () => editableEntries.value,
  () => {
    scheduleEditedTranscriptUpload();
  },
  { deep: true }
);

onMounted(() => {
  clearDragState();
});

onBeforeUnmount(() => {
  clearDragState();
  stopSegmentPlayback();
  if (uploadTimer) {
    clearTimeout(uploadTimer);
  }
});
</script>

<style scoped>
.detail {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgb(0 0 0 / 5%);
}

.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.back {
  border: none;
  background: transparent;
  color: #4e73df;
  cursor: pointer;
  font-weight: 600;
}

.download-btn {
  padding: 8px 16px;
  background: #1cc88a;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
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
  gap: 14px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
  padding-top: 12px;
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
  position: relative;
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

.edit-entry {
  position: absolute;
  top: 10px;
  right: 10px;
  border: 1px solid #d1d5e6;
  background: #fff;
  color: #4e73df;
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 600;
  cursor: pointer;
}

	.edit-entry:disabled {
	  opacity: 0.4;
	  cursor: not-allowed;
	}

	.clone-entry {
	  position: absolute;
	  top: 38px;
	  right: 10px;
	  border: 1px solid #d1d5e6;
	  background: #fff;
	  color: #858796;
	  border-radius: 999px;
	  padding: 2px 10px;
	  font-weight: 600;
	  cursor: pointer;
	}

	.clone-entry:disabled {
	  opacity: 0.4;
	  cursor: not-allowed;
	}

@media (max-width: 480px) {
  .editable-entry {
    display: flex;
    flex-direction: column;
  }

  .edit-entry,
  .clone-entry {
    position: static;
    margin-left: auto;
  }

  .edit-entry {
    margin-bottom: 6px;
  }

  .clone-entry {
    margin-bottom: 10px;
  }
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

.entry-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-label {
  font-weight: 700;
  font-size: 0.85rem;
}

.editor-label.input {
  color: #1cc88a;
}

.editor-label.output {
  color: #4e73df;
}

.editor-label.time {
  color: #858796;
}

.editor-times {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}

.edit-text-preview {
  margin-bottom: 12px;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 6px;
  border-left: 3px solid #4e73df;
}

.edit-text-preview .text-line {
  margin: 4px 0;
}

.editor-time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.editor-time-btn {
  padding: 6px 12px;
  border: 1px solid #4e73df;
  border-radius: 6px;
  background: #4e73df;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  touch-action: manipulation;
  min-width: 50px;
}

.editor-time-btn:hover {
  background: #3a5fc8;
}

.time-input-edit {
  flex: 1;
  font-family: monospace;
  font-size: 0.9rem;
}

.editor-input {
  border: 1px solid #d1d5e6;
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  width: 100%;
}

.editor-textarea {
  width: 100%;
  border: 1px solid #d1d5e6;
  border-radius: 8px;
  padding: 8px 10px;
  resize: vertical;
  font: inherit;
}

.editor-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.editor-btn {
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.editor-btn.save {
  background-color: #1cc88a;
  color: white;
}

.editor-btn.cancel {
  background-color: #858796;
  color: white;
}

.clip-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.clip-folder {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.clip-folder label {
  font-weight: 600;
  color: #4e73df;
}

.clip-folder select {
  border: 1px solid #d1d5e6;
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  color: #111827;
  background: white;
}

.clip-folder-status {
  font-size: 0.85rem;
  color: #6b7280;
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

.player-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 8px;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-control label {
  font-weight: 600;
  color: #5a5c69;
}

.speed-control select {
  padding: 6px 10px;
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  font-size: 0.95rem;
  background: white;
}

.tips-btn {
  padding: 8px 14px;
  border: 1px solid #4e73df;
  border-radius: 6px;
  background: #4e73df;
  color: white;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.tips-btn:hover {
  background: #3a5fc8;
}

.tips-btn:active {
  background: #2e4da3;
}

.player {
  margin-bottom: 16px;
}

.tips-panel {
  margin-top: 12px;
  padding: 12px 16px;
  background: #e8f4fd;
  border-radius: 8px;
  border-left: 4px solid #4e73df;
}

.tips-panel p {
  margin: 0 0 8px;
}

.tips-panel ul {
  margin: 0;
  padding-left: 20px;
}

.tips-panel li {
  margin: 4px 0;
  color: #5a5c69;
}

.time-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: nowrap;
}

@media (max-width: 480px) {
  .time-row {
    gap: 3px;
  }
  
  .time-adjust {
    width: 26px;
    height: 26px;
    font-size: 1rem;
  }
  
  .copy-btn {
    width: 22px;
    height: 22px;
    font-size: 0.75rem;
  }
  
  .merge-btn {
    padding: 2px 5px;
    font-size: 0.65rem;
  }
  
  .action-btn {
    padding: 2px 5px;
    font-size: 0.65rem;
  }
  
  .entry-card {
    padding: 10px;
    padding-top: 18px; /* Space below + and x buttons */
  }
  
  .entry-top-actions {
    top: -6px;
    right: -6px;
  }
  
  .top-btn {
    width: 20px;
    height: 20px;
    font-size: 0.85rem;
  }
  
  .time-value {
    min-width: 80px;
    font-size: 0.75rem;
  }
  
  .entry-content {
    margin-left: 30px; /* Align with - button on mobile */
    padding: 6px;
  }
  
  .text-line.input {
    font-size: 0.85rem;
  }
  
  .text-line.output {
    font-size: 0.8rem;
  }
  
  .text-line.single {
    font-size: 0.85rem;
  }
}

.time-adjust {
  width: 24px;
  height: 24px;
  border: 1px solid #d1d3e2;
  border-radius: 4px;
  background: #f8f9fc;
  color: #4e73df;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.time-adjust:hover {
  background: #4e73df;
  color: white;
}

.time-value {
  font-family: monospace;
  font-size: 0.8rem;
  color: #5a5c69;
  min-width: 90px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.time-value.editing {
  min-width: 100px;
}

.time-input {
  width: 100%;
  max-width: 110px;
  padding: 4px 6px;
  border: 2px solid #4e73df;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  text-align: center;
}

.time-play {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #1cc88a;
  color: white;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-play:hover {
  background: #17a673;
}

.entry-card {
  position: relative;
  border: 1px solid #e3e6f0;
  border-radius: 10px;
  padding: 12px;
  padding-top: 20px; /* More space below + and x buttons */
  background: white;
  margin-bottom: 12px;
}

.entry-top-actions {
  position: absolute;
  top: -8px;
  right: -8px;
  display: flex;
  gap: 2px;
  z-index: 5;
}

.top-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.add-btn {
  background: #1cc88a;
  color: white;
}

.delete-btn {
  background: #e74a3b;
  color: white;
}

.top-btn:hover {
  opacity: 0.8;
}

.copy-btn {
  width: 22px;
  height: 22px;
  border: 1px solid #36b9cc;
  border-radius: 4px;
  background: white;
  color: #36b9cc;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}

.copy-btn:hover:not(:disabled) {
  background: #36b9cc;
  color: white;
}

.copy-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.merge-btn {
  padding: 2px 6px;
  border: 1px solid #4e73df;
  border-radius: 4px;
  background: white;
  color: #4e73df;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.merge-btn:hover:not(:disabled) {
  background: #4e73df;
  color: white;
}

.merge-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn {
  padding: 2px 8px;
  border: 1px solid #d1d3e2;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
}

.edit-btn {
  background: white;
  color: #5a5c69;
}

.edit-btn:hover:not(:disabled) {
  background: #5a5c69;
  color: white;
}

.regen-btn {
  background: white;
  color: #e74a3b;
  border-color: #e74a3b;
}

.regen-btn:hover:not(:disabled) {
  background: #e74a3b;
  color: white;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.entry-content {
  margin-top: 10px;
  margin-left: 28px; /* Align with the decrease button */
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.15s;
  user-select: text;
  -webkit-user-select: text;
}

.entry-content:hover {
  background: #f8f9fc;
}

.entry-content:active {
  background: #e8f4fd;
}

.text-line.input {
  color: #4e73df;
  font-weight: 600;
  font-size: 0.9rem;
  margin: 0 0 6px;
  line-height: 1.4;
}

.text-line.output {
  color: #1cc88a;
  font-weight: 600;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
}

.text-line.single {
  color: #5a5c69;
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.4;
}

.reset-btn {
  background: #e74a3b;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.generate-btn {
  background: #1cc88a;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.generate-btn:hover:not(:disabled) {
  background: #17a673;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.folder-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.folder-select-row select {
  flex: 1;
}

.delete-folder-btn {
  padding: 6px 10px;
  border: 1px solid #e74a3b;
  border-radius: 6px;
  background: white;
  color: #e74a3b;
  font-size: 0.9rem;
  cursor: pointer;
  touch-action: manipulation;
}

.delete-folder-btn:hover:not(:disabled) {
  background: #e74a3b;
  color: white;
}

.delete-folder-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.new-subfolder {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e3e6f0;
}

.new-subfolder h4 {
  margin: 0 0 10px;
  color: #5a5c69;
  font-weight: 600;
}

.subfolder-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.subfolder-input {
  flex: 1;
  max-width: 200px;
  padding: 8px 12px;
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  font-size: 0.95rem;
}

.create-btn {
  padding: 8px 16px;
  background: #858796;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.create-btn:hover:not(:disabled) {
  background: #6b6d7d;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

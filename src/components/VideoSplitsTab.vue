<template>
  <div class="video-splits">
    <div class="toolbar">
      <h2>Video Splits & Sentences</h2>
      <div class="toolbar-actions">
        <button class="secondary" @click="fetchSplits" :disabled="loading || loadingMore">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button class="primary" @click="downloadSelected" :disabled="downloadSelections.length === 0">
          Download
        </button>
      </div>
    </div>
    <p class="note">
      Use “Add to search” to push a clip into search indexing, or collect clips and export them as a JSON payload.
    </p>
    <p v-if="loading" class="info">Loading video splits...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <div v-else class="split-content">
      <div class="folder-panel">
        <div class="folder-header">
          <h3>Folders</h3>
          <p class="folder-subtitle">
            Create folders to organize clips. Videos with a folder field appear in the matching folder too.
          </p>
        </div>
        <div class="folder-form">
          <label>
            Folder name
            <input v-model.trim="newFolderName" type="text" placeholder="New folder name" />
          </label>
          <label>
            Parent folder
            <select v-model="newFolderParent">
              <option value="">Root</option>
              <option
                v-for="option in folderOptions"
                :key="option.path"
                :value="option.path"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <button class="secondary" type="button" :disabled="folderSaving" @click="addFolder">
            {{ folderSaving ? 'Saving...' : 'Add folder' }}
          </button>
        </div>
        <p v-if="folderError" class="error">{{ folderError }}</p>
        <p v-if="folderLoading" class="info">Loading folders...</p>
        <p v-if="!folderNodesFlat.length" class="info">No folders yet.</p>
        <ul v-else class="folder-tree">
          <li
            v-for="folder in folderNodesFlat"
            :key="folder.path"
            class="folder-node"
            :style="{ paddingLeft: `${folder.depth * 18}px` }"
          >
            <div class="folder-row">
              <template v-if="renamingFolder === folder.path">
                <div class="folder-rename-form">
                  <input 
                    v-model.trim="renameNewName" 
                    type="text" 
                    class="folder-rename-input"
                    @keyup.enter="confirmRenameFolder(folder)"
                    @keyup.escape="cancelRenameFolder"
                  />
                  <button type="button" class="folder-rename-btn save" @click="confirmRenameFolder(folder)">Save</button>
                  <button type="button" class="folder-rename-btn cancel" @click="cancelRenameFolder">Cancel</button>
                </div>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="folder-toggle"
                  :aria-expanded="isFolderExpanded(folder.path)"
                  @click="toggleFolder(folder.path)"
                >
                  <span class="folder-name">{{ folder.name }}</span>
                  <span class="folder-toggle-label">
                    {{ isFolderExpanded(folder.path) ? 'Hide' : 'Show' }}
                  </span>
                </button>
                <div class="folder-row-actions">
                  <button type="button" class="folder-rename-trigger" @click="startRenameFolder(folder)">Rename</button>
                  <span class="folder-meta">
                    {{ folder.splits.length }} video{{ folder.splits.length === 1 ? '' : 's' }}
                  </span>
                </div>
              </template>
            </div>
            <!-- Folder quick actions -->
            <div v-if="folder.splits.length" class="folder-quick-actions">
              <button 
                type="button" 
                class="quick-btn index-all"
                :disabled="folder.isIndexingAll"
                @click="indexAllInFolder(folder)"
              >
                {{ folder.isIndexingAll ? 'Indexing...' : 'Index All' }}
              </button>
              <button 
                type="button" 
                class="quick-btn download-all"
                @click="addAllToDownload(folder)"
              >
                Add All to Download
              </button>
              <button 
                type="button" 
                class="quick-btn delete-all"
                :disabled="folder.isDeletingAll"
                @click="deleteAllInFolder(folder)"
              >
                {{ folder.isDeletingAll ? 'Deleting...' : 'Delete All' }}
              </button>
            </div>
            <ul v-if="folder.splits.length && isFolderExpanded(folder.path)" class="folder-videos">
              <li
                v-for="(split, fSplitIndex) in folder.splits"
                :key="`folder-${folder.path}-${getSplitId(split)}`"
                class="folder-video-card"
              >
                <div 
                  class="sentence"
                  @click="playFolderSplitFromBeginning(folder.path, split, fSplitIndex)"
                  @dblclick="playFolderSplitFromMiddle(folder.path, split, fSplitIndex)"
                >{{ split.sent }}</div>
                <div 
                  v-if="shouldShowTranslation(split)" 
                  class="sentence translation"
                  @click="playFolderSplitFromBeginning(folder.path, split, fSplitIndex)"
                  @dblclick="playFolderSplitFromMiddle(folder.path, split, fSplitIndex)"
                >
                  {{ translationText(split) }}
                </div>
                <video 
                  :ref="el => { if (el) folderVideoRefs[`${folder.path}-${fSplitIndex}`] = el }"
                  controls 
                  playsinline 
                  webkit-playsinline 
                  preload="metadata" 
                  :src="split.video_url"
                ></video>
                <div class="video-controls">
                  <div class="timestamp-control">
                    <button type="button" class="time-btn" @click="adjustFolderSplitTime(folder.path, split, fSplitIndex, -0.1)" @dblclick.prevent="adjustFolderSplitTime(folder.path, split, fSplitIndex, -0.3)">−</button>
                    <span 
                      class="time-display clickable" 
                      @click="playFolderSplitAtTimestamp(folder.path, split, fSplitIndex)"
                    >{{ formatTime(split.currentTime || 0) }}</span>
                    <button type="button" class="time-btn" @click="adjustFolderSplitTime(folder.path, split, fSplitIndex, 0.1)" @dblclick.prevent="adjustFolderSplitTime(folder.path, split, fSplitIndex, 0.3)">+</button>
                  </div>
                  <div class="position-buttons">
                    <button type="button" class="pos-btn" @click="playFolderSplitAt(folder.path, split, fSplitIndex, 'beginning')">Beginning</button>
                    <button type="button" class="pos-btn" @click="playFolderSplitAt(folder.path, split, fSplitIndex, 'middle')">Middle</button>
                    <button type="button" class="pos-btn" @click="playFolderSplitAtEnd(folder.path, split, fSplitIndex)">End</button>
                  </div>
                </div>
                <!-- Folder move dropdown -->
                <div class="folder-move">
                  <label>Move to:</label>
                  <select 
                    :value="split.folder || ''" 
                    @change="moveSplitToFolder(split, $event.target.value)"
                  >
                    <option value="">None</option>
                    <option
                      v-for="opt in folderOptions"
                      :key="opt.path"
                      :value="opt.path"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <p v-if="split.video_url" class="video-url">
                  <a :href="split.video_url" target="_blank" rel="noopener noreferrer">
                    {{ split.video_url }}
                  </a>
                </p>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <ul class="split-list">
        <li v-for="(split, splitIndex) in splits" :key="getSplitId(split)" class="split-card">
          <div 
            class="sentence" 
            @click="playSplitFromBeginning(split, splitIndex)"
            @dblclick="playSplitFromMiddle(split, splitIndex)"
          >{{ split.sent }}</div>
          <div 
            v-if="shouldShowTranslation(split)" 
            class="sentence translation"
            @click="playSplitFromBeginning(split, splitIndex)"
            @dblclick="playSplitFromMiddle(split, splitIndex)"
          >
            {{ translationText(split) }}
          </div>
          <video 
            :ref="el => { if (el) splitVideoRefs[splitIndex] = el }"
            controls 
            playsinline 
            webkit-playsinline 
            preload="metadata" 
            :src="split.video_url"
          ></video>
          <div class="video-controls">
            <div class="timestamp-control">
              <button type="button" class="time-btn" @click="adjustSplitTime(split, splitIndex, -0.1)" @dblclick.prevent="adjustSplitTime(split, splitIndex, -0.3)">−</button>
              <span 
                class="time-display clickable" 
                @click="playSplitAtTimestamp(split, splitIndex)"
              >{{ formatTime(split.currentTime || 0) }}</span>
              <button type="button" class="time-btn" @click="adjustSplitTime(split, splitIndex, 0.1)" @dblclick.prevent="adjustSplitTime(split, splitIndex, 0.3)">+</button>
            </div>
            <div class="position-buttons">
              <button type="button" class="pos-btn" @click="playSplitAt(split, splitIndex, 'beginning')">Beginning</button>
              <button type="button" class="pos-btn" @click="playSplitAt(split, splitIndex, 'middle')">Middle</button>
              <button type="button" class="pos-btn" @click="playSplitAtEnd(split, splitIndex)">End</button>
            </div>
          </div>
          <!-- Folder move dropdown -->
          <div class="folder-move">
            <label>Move to:</label>
            <select 
              :value="split.folder || ''" 
              @change="moveSplitToFolder(split, $event.target.value)"
            >
              <option value="">None</option>
              <option
                v-for="opt in folderOptions"
                :key="opt.path"
                :value="opt.path"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <p v-if="split.video_url" class="video-url">
            <a :href="split.video_url" target="_blank" rel="noopener noreferrer">
              {{ split.video_url }}
            </a>
          </p>
          <div class="actions">
            <template v-if="!split.if_indexed && split.showPriorityInput">
              <span class="priority-label">Priority score</span>
              <div class="priority-stepper" :aria-disabled="split.isIndexing">
                <button
                  type="button"
                  class="priority-stepper-button"
                  :disabled="split.isIndexing || split.priority_score <= 1"
                  aria-label="Decrease priority score"
                  @click="adjustPriorityScore(split, -1)"
                >
                  -
                </button>
                <span class="priority-value" aria-label="Priority score value">{{ split.priority_score }}</span>
                <button
                  type="button"
                  class="priority-stepper-button"
                  :disabled="split.isIndexing || split.priority_score >= 10"
                  aria-label="Increase priority score"
                  @click="adjustPriorityScore(split, 1)"
                >
                  +
                </button>
              </div>
              <button class="primary" :disabled="split.isIndexing" @click="submitIndexSplit(split)">
                {{ split.isIndexing ? 'Indexing...' : 'Submit' }}
              </button>
              <button class="secondary" :disabled="split.isIndexing" @click="cancelIndexSplit(split)">
                Cancel
              </button>
            </template>
            <button
              v-else
              class="primary"
              :disabled="split.if_indexed || split.isIndexing"
              @click="startIndexSplit(split)"
            >
              <span v-if="split.if_indexed">Indexed</span>
              <span v-else-if="split.isIndexing">Indexing...</span>
              <span v-else>Add to search</span>
            </button>
            <button
              class="secondary"
              :disabled="isInDownload(split)"
              @click="addToDownload(split)"
            >
              {{ isInDownload(split) ? 'Added' : 'Add to download' }}
            </button>
            <button
              class="danger small"
              type="button"
              :disabled="
                split.isIndexing ||
                split.isDeleting ||
                split.timestamp === undefined ||
                split.timestamp === null ||
                split.timestamp === ''
              "
              @click="deleteSplit(split)"
            >
              {{ split.isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </li>
        <li v-if="!splits.length" class="info">No splits found.</li>
      </ul>
    </div>

    <div v-if="!loading && !error && splits.length" class="pagination">
      <button
        v-if="nextPageToken"
        class="secondary"
        type="button"
        :disabled="loadingMore"
        @click="loadMoreSplits"
      >
        {{ loadingMore ? 'Loading...' : 'Load more' }}
      </button>
      <p v-if="loadMoreError" class="error load-more-error">{{ loadMoreError }}</p>
    </div>

    <div v-if="showDownloadDialog" class="download-overlay" @click.self="closeDownloadDialog">
      <div class="download-dialog" role="dialog" aria-modal="true" aria-label="Download options">
        <h3>Download options</h3>
        <label>
          Movie title
          <input v-model.trim="downloadMovieTitle" type="text" placeholder="Movie title" />
        </label>
        <label>
          Chapter no.
          <select v-model.number="downloadChapterNo">
            <option v-for="n in 30" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <label>
          Tags (comma separated)
          <input v-model.trim="downloadCustomTags" type="text" placeholder="tag1, tag2" />
        </label>
        <div class="download-dialog-actions">
          <button class="secondary" type="button" @click="closeDownloadDialog">Cancel</button>
          <button class="primary" type="button" @click="confirmDownload">Download</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const PAGE_SIZE = 50;

const splits = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const loadMoreError = ref('');
const downloadSelections = ref([]);
const downloadIds = ref(new Set());
const showDownloadDialog = ref(false);
const downloadMovieTitle = ref('');
const downloadChapterNo = ref(1);
const downloadCustomTags = ref('');
const nextPageToken = ref(null);
const manualFolderPaths = ref([]);
const newFolderName = ref('');
const newFolderParent = ref('');
const folderError = ref('');
const folderLoading = ref(false);
const folderSaving = ref(false);
const expandedFolders = ref(new Set());
const splitVideoRefs = ref({});
const folderVideoRefs = ref({});
const renamingFolder = ref(null);
const renameNewName = ref('');

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
}

function getVideoDuration(videoEl) {
  return videoEl && videoEl.duration ? videoEl.duration : 0;
}

function playSplitFromBeginning(split, index) {
  const video = splitVideoRefs.value[index];
  if (video) {
    video.currentTime = 0;
    video.play();
  }
}

function playSplitFromMiddle(split, index) {
  const video = splitVideoRefs.value[index];
  if (video && video.duration) {
    video.currentTime = video.duration / 2;
    video.play();
  }
}

function playSplitAt(split, index, position) {
  const video = splitVideoRefs.value[index];
  if (!video) return;
  const duration = video.duration || 0;
  let time = 0;
  if (position === 'beginning') time = 0;
  else if (position === 'middle') time = duration / 2;
  else if (position === 'end') time = Math.max(0, duration - 2.5);
  video.currentTime = time;
  split.currentTime = time;
  video.play();
}

function adjustSplitTime(split, index, delta) {
  const video = splitVideoRefs.value[index];
  if (!video) return;
  const duration = video.duration || 0;
  const currentTime = split.currentTime !== undefined ? split.currentTime : (video.currentTime || 0);
  const newTime = Math.max(0, Math.min(duration, currentTime + delta));
  video.currentTime = newTime;
  split.currentTime = newTime;
}

// Play video at the current displayed timestamp
function playSplitAtTimestamp(split, index) {
  const video = splitVideoRefs.value[index];
  if (!video) return;
  const time = split.currentTime !== undefined ? split.currentTime : 0;
  video.currentTime = time;
  video.play();
}

function playFolderSplitFromBeginning(folderPath, split, index) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (video) {
    video.currentTime = 0;
    video.play();
  }
}

function playFolderSplitFromMiddle(folderPath, split, index) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (video && video.duration) {
    video.currentTime = video.duration / 2;
    video.play();
  }
}

function playFolderSplitAt(folderPath, split, index, position) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (!video) return;
  const duration = video.duration || 0;
  let time = 0;
  if (position === 'beginning') time = 0;
  else if (position === 'middle') time = duration / 2;
  else if (position === 'end') time = Math.max(0, duration - 2.5);
  video.currentTime = time;
  split.currentTime = time;
  video.play();
}

function adjustFolderSplitTime(folderPath, split, index, delta) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (!video) return;
  const duration = video.duration || 0;
  const currentTime = split.currentTime !== undefined ? split.currentTime : (video.currentTime || 0);
  const newTime = Math.max(0, Math.min(duration, currentTime + delta));
  video.currentTime = newTime;
  split.currentTime = newTime;
}

function playFolderSplitAtTimestamp(folderPath, split, index) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (!video) return;
  const time = split.currentTime !== undefined ? split.currentTime : 0;
  video.currentTime = time;
  video.play();
}

// Set timestamp to 2.5 seconds before end (or 0 if negative) and play
function playSplitAtEnd(split, index) {
  const video = splitVideoRefs.value[index];
  if (!video) return;
  const duration = video.duration || 0;
  const time = Math.max(0, duration - 2.5);
  video.currentTime = time;
  split.currentTime = time;
  video.play();
}

function playFolderSplitAtEnd(folderPath, split, index) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (!video) return;
  const duration = video.duration || 0;
  const time = Math.max(0, duration - 2.5);
  video.currentTime = time;
  split.currentTime = time;
  video.play();
}

// Play from timestamp and loop
function playSplitLoop(split, index) {
  const video = splitVideoRefs.value[index];
  if (!video) return;
  video.loop = true;
  video.play();
}

function playFolderSplitLoop(folderPath, split, index) {
  const video = folderVideoRefs.value[`${folderPath}-${index}`];
  if (!video) return;
  video.loop = true;
  video.play();
}

// Folder bulk actions
async function indexAllInFolder(folder) {
  if (!folder.splits.length) return;
  const confirmed = window.confirm(`Index all ${folder.splits.length} clips in "${folder.name}"? This will add them to search.`);
  if (!confirmed) return;
  
  folder.isIndexingAll = true;
  try {
    for (const split of folder.splits) {
      if (split.if_indexed) continue;
      await fetch(
        'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/index-video-split-and-sentence-to-search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: props.userEmail,
            timestamp: split.timestamp,
            priority_score: 1
          })
        }
      );
      split.if_indexed = true;
    }
    alert(`Successfully indexed ${folder.splits.length} clips.`);
  } catch (err) {
    console.error(err);
    alert('Failed to index some clips.');
  } finally {
    folder.isIndexingAll = false;
  }
}

function addAllToDownload(folder) {
  if (!folder.splits.length) return;
  const confirmed = window.confirm(`Add all ${folder.splits.length} clips from "${folder.name}" to download?`);
  if (!confirmed) return;
  
  let added = 0;
  for (const split of folder.splits) {
    if (!isInDownload(split)) {
      addToDownload(split);
      added++;
    }
  }
  alert(`Added ${added} clips to download.`);
}

async function deleteAllInFolder(folder) {
  if (!folder.splits.length) return;
  const confirmed = window.confirm(`DELETE all ${folder.splits.length} clips in "${folder.name}"? This cannot be undone!`);
  if (!confirmed) return;
  
  folder.isDeletingAll = true;
  try {
    for (const split of folder.splits) {
      if (split.timestamp === undefined || split.timestamp === null) continue;
      await fetch(
        'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/delete-video-split-clip-and-sentence',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: props.userEmail, timestamp: split.timestamp })
        }
      );
    }
    await fetchSplits();
    alert('All clips deleted.');
  } catch (err) {
    console.error(err);
    alert('Failed to delete some clips.');
  } finally {
    folder.isDeletingAll = false;
  }
}

// Move split to different folder
async function moveSplitToFolder(split, newFolderPath) {
  if (!props.userEmail) return;
  
  try {
    await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/update-video-split-folder',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: props.userEmail,
          timestamp: split.timestamp,
          folder: newFolderPath
        })
      }
    );
    split.folder = newFolderPath;
    // Refresh to update folder groupings
    await fetchSplits();
  } catch (err) {
    console.error(err);
    alert('Failed to move clip. Please try again.');
  }
}

function normalizeLanguageCode(value) {
  return String(value || '').trim().toLowerCase();
}

function translationLanguage(split) {
  return split?.lang_translation || split?.lang_transation || '';
}

function translationText(split) {
  return split?.sent_translation || split?.sent_transation || '';
}

function isSameLanguage(split) {
  const inputLang = normalizeLanguageCode(split?.lang);
  const outputLang = normalizeLanguageCode(translationLanguage(split));
  return Boolean(inputLang && outputLang && inputLang === outputLang);
}

function shouldShowTranslation(split) {
  const text = translationText(split);
  if (!text) return false;
  return !isSameLanguage(split);
}

function normalizeFolderPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function buildFolderNodes(paths, splitList) {
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
      children: [],
      splits: []
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

  splitList.forEach(split => {
    const folderPath = normalizeFolderPath(split?.folder);
    if (!folderPath) return;
    const node = nodes.get(folderPath);
    if (node) node.splits.push(split);
  });

  nodes.forEach(node => {
    node.splits.sort((a, b) => {
      const aValue = Number(a?.timestamp);
      const bValue = Number(b?.timestamp);
      const aFinite = Number.isFinite(aValue);
      const bFinite = Number.isFinite(bValue);
      if (aFinite && bFinite) return aValue - bValue;
      if (aFinite) return -1;
      if (bFinite) return 1;
      return 0;
    });
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

const folderPathsFromSplits = computed(() => {
  const paths = new Set();
  splits.value.forEach(split => {
    const normalized = normalizeFolderPath(split?.folder);
    if (!normalized) return;
    const segments = normalized.split('/');
    let current = '';
    segments.forEach(segment => {
      current = current ? `${current}/${segment}` : segment;
      paths.add(current);
    });
  });
  return paths;
});

const allFolderPaths = computed(() => {
  const paths = new Set();
  manualFolderPaths.value.forEach(path => {
    const normalized = normalizeFolderPath(path);
    if (normalized) paths.add(normalized);
  });
  folderPathsFromSplits.value.forEach(path => paths.add(path));
  return Array.from(paths);
});

const folderNodesFlat = computed(() => {
  if (!allFolderPaths.value.length) return [];
  const nodes = buildFolderNodes(allFolderPaths.value, splits.value);
  return flattenFolderNodes(nodes);
});

const folderOptions = computed(() =>
  folderNodesFlat.value.map(node => ({
    path: node.path,
    label: `${'-- '.repeat(node.depth)}${node.name}`
  }))
);

function addFolder() {
  const name = String(newFolderName.value || '').trim();
  const parent = normalizeFolderPath(newFolderParent.value);
  if (!name) {
    folderError.value = 'Please enter a folder name.';
    return;
  }
  if (name.includes('/')) {
    folderError.value = 'Use a single folder name without "/".';
    return;
  }
  const path = parent ? `${parent}/${name}` : name;
  if (allFolderPaths.value.includes(path)) {
    folderError.value = 'That folder already exists.';
    return;
  }
  manualFolderPaths.value = [...manualFolderPaths.value, path];
  newFolderName.value = '';
  folderError.value = '';
  saveFolderTree();
}

function startRenameFolder(folder) {
  renamingFolder.value = folder.path;
  renameNewName.value = folder.name;
}

function cancelRenameFolder() {
  renamingFolder.value = null;
  renameNewName.value = '';
}

async function confirmRenameFolder(folder) {
  const newName = String(renameNewName.value || '').trim();
  if (!newName) {
    alert('Please enter a new folder name.');
    return;
  }
  if (newName.includes('/')) {
    alert('Folder name cannot contain "/".');
    return;
  }
  
  const oldPath = folder.path;
  const parentPath = folder.parentPath || '';
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  
  if (oldPath === newPath) {
    cancelRenameFolder();
    return;
  }
  
  if (allFolderPaths.value.includes(newPath)) {
    alert('A folder with that name already exists.');
    return;
  }
  
  try {
    // Update all splits that are in this folder or subfolders
    const splitsToUpdate = splits.value.filter(split => {
      const splitFolder = normalizeFolderPath(split?.folder);
      return splitFolder === oldPath || splitFolder.startsWith(oldPath + '/');
    });
    
    for (const split of splitsToUpdate) {
      const splitFolder = normalizeFolderPath(split.folder);
      const updatedFolder = splitFolder === oldPath 
        ? newPath 
        : newPath + splitFolder.slice(oldPath.length);
      
      await fetch(
        'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/update-video-split-folder',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: props.userEmail,
            timestamp: split.timestamp,
            folder: updatedFolder
          })
        }
      );
      split.folder = updatedFolder;
    }
    
    // Update manual folder paths
    manualFolderPaths.value = manualFolderPaths.value.map(path => {
      if (path === oldPath) return newPath;
      if (path.startsWith(oldPath + '/')) return newPath + path.slice(oldPath.length);
      return path;
    });
    
    await saveFolderTree();
    await fetchSplits();
    cancelRenameFolder();
  } catch (err) {
    console.error('Failed to rename folder:', err);
    alert('Failed to rename folder. Please try again.');
  }
}

function isFolderExpanded(path) {
  return expandedFolders.value.has(path);
}

function toggleFolder(path) {
  const next = new Set(expandedFolders.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  expandedFolders.value = next;
}

function resetDownloadState() {
  downloadSelections.value = [];
  downloadIds.value = new Set();
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
  if (!props.userEmail || folderSaving.value) return;
  folderSaving.value = true;
  folderError.value = '';
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/folder_update',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: props.userEmail,
          folders: buildFolderPayload(manualFolderPaths.value)
        })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
  } catch (err) {
    console.error(err);
    folderError.value = 'Unable to save folders. Please try again.';
  } finally {
    folderSaving.value = false;
  }
}

async function fetchFolderTree() {
  if (!props.userEmail || folderLoading.value) return;
  folderLoading.value = true;
  folderError.value = '';
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/folder_fetch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: props.userEmail })
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

function getSplitId(split) {
  if (split.timestamp !== undefined && split.timestamp !== null) {
    return String(split.timestamp);
  }
  return `${split.video_url || ''}__${split.sent || ''}`;
}

function decorateSplit(split) {
  return {
    ...split,
    isIndexing: false,
    isDeleting: false,
    showPriorityInput: false,
    priority_score: 1
  };
}

function mergeSplits(existingSplits, incomingSplits) {
  const byId = new Map();
  existingSplits.forEach(split => {
    byId.set(getSplitId(split), split);
  });
  incomingSplits.forEach(split => {
    const id = getSplitId(split);
    if (!byId.has(id)) {
      byId.set(id, split);
    }
  });
  return Array.from(byId.values());
}

async function fetchSplits(options = {}) {
  const { append = false } = options;
  if (!props.userEmail) return;
  if (append) {
    if (!nextPageToken.value || loadingMore.value || loading.value) return;
    loadingMore.value = true;
    loadMoreError.value = '';
  } else {
    loading.value = true;
    error.value = '';
    loadMoreError.value = '';
    nextPageToken.value = null;
  }
  try {
    const requestBody = {
      user_name: props.userEmail,
      page_size: PAGE_SIZE
    };
    if (append) {
      requestBody.page_token = nextPageToken.value;
    }

    const response = await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/list-latest-video-splits-and-sentences',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
    const payload = await response.json();
    const pageSplits = (payload?.body || []).map(decorateSplit);
    splits.value = append ? mergeSplits(splits.value, pageSplits) : pageSplits;
    nextPageToken.value = payload?.next_page_token ?? null;
    if (!append) resetDownloadState();
  } catch (err) {
    console.error(err);
    if (append) {
      loadMoreError.value = 'Unable to load more video splits. Please try again.';
    } else {
      error.value = 'Unable to load video splits. Please try again.';
    }
  } finally {
    if (append) {
      loadingMore.value = false;
    } else {
      loading.value = false;
    }
  }
}

function loadMoreSplits() {
  fetchSplits({ append: true });
}

async function deleteSplit(split) {
  if (!props.userEmail || split.isDeleting || split.isIndexing) return;
  if (split.timestamp === undefined || split.timestamp === null || split.timestamp === '') {
    alert('Unable to delete this split because it is missing a timestamp.');
    return;
  }
  const confirmed = window.confirm('Delete this video split from the database? This cannot be undone.');
  if (!confirmed) return;

  split.isDeleting = true;
  try {
    const response = await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/delete-video-split-clip-and-sentence',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: props.userEmail, timestamp: split.timestamp })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
    await fetchSplits();
  } catch (err) {
    console.error(err);
    alert('Failed to delete this split. Please try again.');
  } finally {
    split.isDeleting = false;
  }
}

function isInDownload(split) {
  return downloadIds.value.has(getSplitId(split));
}

function addToDownload(split) {
  if (isInDownload(split)) return;
  const id = getSplitId(split);
  const sameLanguage = isSameLanguage(split);
  downloadSelections.value.push({
    id,
    sent: split.sent || '',
    sent_translation: sameLanguage ? '' : translationText(split),
    lang: split.lang || '',
    lang_translation: sameLanguage ? '' : translationLanguage(split),
    video_url: split.video_url || '',
    timestamp: split.timestamp ?? null
  });
  downloadIds.value = new Set(downloadIds.value).add(id);
}

function downloadSelected() {
  if (!downloadSelections.value.length) return;
  showDownloadDialog.value = true;
}

function closeDownloadDialog() {
  showDownloadDialog.value = false;
}

function buildTagsString(movieTitle, chapterNo, customTags) {
  const parts = [];
  const title = String(movieTitle || '').trim();
  if (title) parts.push(title);
  const chapter = Number(chapterNo);
  if (Number.isInteger(chapter) && chapter > 0) parts.push(`chapter${chapter}`);
  const tags = String(customTags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  parts.push(...tags);
  return parts.join(',');
}

function confirmDownload() {
  const tags = buildTagsString(
    downloadMovieTitle.value,
    downloadChapterNo.value,
    downloadCustomTags.value
  );
  if (!tags) {
    alert('Please enter at least a movie title or a tag.');
    return;
  }
  const chapterNo = Number(downloadChapterNo.value);
  if (!Number.isInteger(chapterNo) || chapterNo < 1 || chapterNo > 30) {
    alert('Please select a chapter number between 1 and 30.');
    return;
  }

  closeDownloadDialog();
  const languageDisplayName = value => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    const known = {
      en: 'English',
      zh: 'Chinese',
      zh_cn: 'Chinese',
      zh_tw: 'Chinese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      ja: 'Japanese',
      ko: 'Korean',
      pt: 'Portuguese',
      ru: 'Russian',
      ar: 'Arabic',
      hi: 'Hindi'
    };
    return known[normalized] || value;
  };
  const first = downloadSelections.value[0] || {};
  const firstLang = normalizeLanguageCode(first.lang);
  const firstTranslationLang = normalizeLanguageCode(first.lang_translation);
  const courseName =
    firstLang && firstTranslationLang && firstLang !== firstTranslationLang
      ? `${languageDisplayName(first.lang_translation)} -> ${languageDisplayName(first.lang)}`.trim()
      : languageDisplayName(first.lang);

  const sortedSelections = [...downloadSelections.value].sort((a, b) => {
    const aValue = Number(a?.timestamp);
    const bValue = Number(b?.timestamp);
    const aFinite = Number.isFinite(aValue);
    const bFinite = Number.isFinite(bValue);
    if (aFinite && bFinite) return aValue - bValue;
    if (aFinite) return -1;
    if (bFinite) return 1;
    return 0;
  });

  const formatIndex = index => String(index).padStart(2, '0');
  const payload = {
    courseName,
    contents: sortedSelections.map((selection, index) => {
      const inputLang = normalizeLanguageCode(selection?.lang);
      const outputLang = normalizeLanguageCode(selection?.lang_translation);
      const sameLanguage = Boolean(inputLang && outputLang && inputLang === outputLang);
      return {
        mPhoneticStory: '',
        mVideoUrl: selection.video_url,
        mTags: tags,
        mWebName: '',
        mWebLink: '',
        mContent: selection.sent,
        mTranslatedContent: sameLanguage ? '' : selection.sent_translation || '',
        mIndices: `${chapterNo}${formatIndex(index + 1)}00`,
        mImageStr: '',
        mPhoneticInfo: '',
        mOnlineTranslation: ''
      };
    })
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'video_splits.golingocontent';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function startIndexSplit(split) {
  if (split.if_indexed || split.isIndexing) return;
  normalizePriorityScore(split);
  split.showPriorityInput = true;
}

function adjustPriorityScore(split, delta) {
  if (split.isIndexing) return;
  const numericValue = Number(split.priority_score);
  const currentValue = Number.isFinite(numericValue) ? Math.trunc(numericValue) : 1;
  split.priority_score = currentValue + delta;
  normalizePriorityScore(split);
}

function normalizePriorityScore(split) {
  const numericValue = Number(split.priority_score);
  split.priority_score = Number.isFinite(numericValue)
    ? Math.min(10, Math.max(1, Math.trunc(numericValue)))
    : 1;
}

function cancelIndexSplit(split) {
  if (split.isIndexing) return;
  split.showPriorityInput = false;
}

async function submitIndexSplit(split) {
  if (split.if_indexed || split.isIndexing) return;
  normalizePriorityScore(split);
  split.isIndexing = true;
  try {
    await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/index-video-split-and-sentence-to-search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: props.userEmail,
          timestamp: split.timestamp,
          priority_score: split.priority_score
        })
      }
    );
    split.if_indexed = true;
    split.showPriorityInput = false;
  } catch (err) {
    console.error(err);
    alert('Failed to index this split. Please try again.');
  } finally {
    split.isIndexing = false;
  }
}

watch(
  () => props.userEmail,
  email => {
    if (email) {
      fetchFolderTree();
      fetchSplits();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.video-splits {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sentence.translation {
  color: #6b7280;
  font-size: 14px;
  margin-top: 6px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar button {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
}

.toolbar button.primary {
  background-color: #4e73df;
  color: white;
}

.toolbar button.secondary {
  background-color: #858796;
  color: white;
}

.toolbar button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.note {
  color: #858796;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.split-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.folder-panel {
  border: 1px solid #e3e6f0;
  border-radius: 10px;
  padding: 16px;
  background: #f8f9fc;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.folder-header h3 {
  margin: 0;
}

.folder-subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.folder-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.folder-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: #6b7280;
}

.folder-form input,
.folder-form select {
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #111827;
  background: white;
}

.folder-form button {
  height: 38px;
}

.folder-tree {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-node {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid #e3e6f0;
}

.folder-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.folder-toggle-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6b7280;
}

.folder-name {
  font-weight: 700;
  color: #4e73df;
}

.folder-meta {
  font-size: 0.85rem;
  color: #6b7280;
}

.folder-videos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.folder-video-card {
  border: 1px solid #e3e6f0;
  border-radius: 8px;
  padding: 12px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pagination {
  display: flex;
  justify-content: center;
}

.pagination button.secondary {
  border: none;
  border-radius: 6px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
  background-color: #858796;
  color: white;
}

.pagination button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info {
  color: #4e73df;
}

.error {
  color: #e74a3b;
}

.load-more-error {
  margin: 0 0 0 12px;
  align-self: center;
}

.download-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.download-dialog {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 10px 25px rgb(0 0 0 / 15%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.download-dialog h3 {
  margin: 0;
}

.download-dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: #858796;
}

.download-dialog input,
.download-dialog select {
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 1rem;
  font-weight: 500;
  color: #111827;
}

.download-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.split-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.split-card {
  border: 1px solid #e3e6f0;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 8px 20px rgb(0 0 0 / 5%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sentence {
  font-weight: 600;
  color: #4e73df;
}

video {
  width: 100%;
  border-radius: 6px;
}

.video-url {
  font-size: 0.85rem;
  color: #6b7280;
  word-break: break-word;
  margin: 0;
}

.video-url a {
  color: inherit;
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.actions button {
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
}

.actions .primary {
  background-color: #1cc88a;
  color: white;
}

.actions .secondary {
  background-color: #36b9cc;
  color: white;
}

.actions .danger {
  background-color: #e74a3b;
  color: white;
}

.actions .small {
  padding: 6px 10px;
  font-size: 0.9rem;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.priority-label {
  font-weight: 600;
  color: #4e73df;
  align-self: center;
}

.priority-stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.priority-stepper-button {
  padding: 6px 10px;
  border: none;
  background: #f8f9fc;
  color: #4e73df;
  font-weight: 700;
  cursor: pointer;
}

.priority-stepper-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.priority-value {
  display: inline-block;
  min-width: 26px;
  text-align: center;
  padding: 6px 10px;
  font-weight: 700;
  color: #4e73df;
  background: white;
}

@media (max-width: 720px) {
  .folder-form {
    grid-template-columns: 1fr;
  }

  .folder-form button {
    width: 100%;
  }
}

.video-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 8px;
}

.timestamp-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  background: white;
  color: #4e73df;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.time-btn:hover {
  background: #4e73df;
  color: white;
}

.time-display {
  font-family: monospace;
  font-size: 1rem;
  color: #5a5c69;
  min-width: 60px;
  text-align: center;
}

.position-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pos-btn {
  padding: 6px 12px;
  border: 1px solid #4e73df;
  border-radius: 6px;
  background: white;
  color: #4e73df;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.pos-btn:hover {
  background: #4e73df;
  color: white;
}

.sentence {
  cursor: pointer;
  user-select: text;
  -webkit-user-select: text;
}

.sentence:hover {
  opacity: 0.8;
}

@media (max-width: 480px) {
  .position-buttons {
    justify-content: center;
  }
  
  .pos-btn {
    flex: 1;
    min-width: 80px;
    text-align: center;
  }
}

/* Folder quick actions */
.folder-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background: #f0f3ff;
  border-radius: 6px;
}

.quick-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.quick-btn.index-all {
  background: #1cc88a;
  color: white;
}

.quick-btn.download-all {
  background: #36b9cc;
  color: white;
}

.quick-btn.delete-all {
  background: #e74a3b;
  color: white;
}

.quick-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Folder move dropdown */
.folder-move {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fc;
  border-radius: 6px;
}

.folder-move label {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 600;
}

.folder-move select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d3e2;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
}

/* Clickable timestamp */
.time-display.clickable {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.time-display.clickable:hover {
  background: #e8f4fd;
}

.time-display.clickable:active {
  background: #d0e8f7;
}

@media (max-width: 480px) {
  .folder-quick-actions {
    flex-direction: column;
  }
  
  .quick-btn {
    width: 100%;
    text-align: center;
  }
  
  .folder-move {
    flex-direction: column;
    align-items: stretch;
  }
}

/* Folder rename */
.folder-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.folder-rename-trigger {
  padding: 4px 10px;
  border: 1px solid #d1d3e2;
  border-radius: 4px;
  background: white;
  color: #6b7280;
  font-size: 0.8rem;
  cursor: pointer;
}

.folder-rename-trigger:hover {
  background: #f3f4f6;
  color: #4e73df;
}

.folder-rename-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
}

.folder-rename-input {
  flex: 1;
  min-width: 120px;
  padding: 6px 10px;
  border: 1px solid #4e73df;
  border-radius: 6px;
  font-size: 0.9rem;
}

.folder-rename-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.folder-rename-btn.save {
  background: #1cc88a;
  color: white;
}

.folder-rename-btn.cancel {
  background: #858796;
  color: white;
}

@media (max-width: 480px) {
  .folder-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .folder-row-actions {
    justify-content: space-between;
  }
  
  .folder-rename-form {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    width: 100%;
  }
  
  .folder-rename-input {
    grid-column: 1 / -1;
    width: 100%;
  }
  
  .folder-rename-btn {
    min-width: 60px;
  }
}
</style>

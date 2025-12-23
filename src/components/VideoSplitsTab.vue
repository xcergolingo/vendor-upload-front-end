<template>
  <div class="video-splits">
    <div class="toolbar">
      <h2>Video Splits & Sentences</h2>
      <div class="toolbar-actions">
        <button class="secondary" @click="fetchSplits" :disabled="loading">
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
    <ul v-else class="split-list">
      <li v-for="split in splits" :key="getSplitId(split)" class="split-card">
        <div class="sentence">{{ split.sent }}</div>
        <video controls playsinline webkit-playsinline preload="metadata" :src="split.video_url"></video>
        <div class="actions">
          <button
            class="primary"
            :disabled="split.if_indexed || split.isIndexing"
            @click="indexSplit(split)"
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
        </div>
      </li>
      <li v-if="!splits.length" class="info">No splits found.</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const splits = ref([]);
const loading = ref(false);
const error = ref('');
const downloadSelections = ref([]);
const downloadIds = ref(new Set());

function resetDownloadState() {
  downloadSelections.value = [];
  downloadIds.value = new Set();
}

function getSplitId(split) {
  if (split.timestamp !== undefined && split.timestamp !== null) {
    return String(split.timestamp);
  }
  return `${split.video_url || ''}__${split.sent || ''}`;
}

async function fetchSplits() {
  if (!props.userEmail) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/list-latest-video-splits-and-sentences',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: props.userEmail })
      }
    );
    if (!response.ok) {
      throw new Error('Request failed');
    }
    const payload = await response.json();
    splits.value = (payload?.body || []).map(split => ({
      ...split,
      isIndexing: false
    }));
    resetDownloadState();
  } catch (err) {
    console.error(err);
    error.value = 'Unable to load video splits. Please try again.';
  } finally {
    loading.value = false;
  }
}

function isInDownload(split) {
  return downloadIds.value.has(getSplitId(split));
}

function addToDownload(split) {
  if (isInDownload(split)) return;
  const id = getSplitId(split);
  downloadSelections.value.push({
    id,
    sent: split.sent || '',
    video_url: split.video_url || ''
  });
  downloadIds.value = new Set(downloadIds.value).add(id);
}

function downloadSelected() {
  if (!downloadSelections.value.length) return;
  const payload = {
    courseName: '',
    contents: downloadSelections.value.map(selection => ({
      mPhoneticStory: '',
      mVideoUrl: selection.video_url,
      mTags: '',
      mWebName: '',
      mWebLink: '',
      mContent: selection.sent,
      mTranslatedContent: '',
      mIndices: '',
      mImageStr: '',
      mPhoneticInfo: '',
      mOnlineTranslation: ''
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'video_splits.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function indexSplit(split) {
  if (split.if_indexed || split.isIndexing) return;
  split.isIndexing = true;
  try {
    await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/index-video-split-and-sentence-to-search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: props.userEmail,
          timestamp: split.timestamp
        })
      }
    );
    split.if_indexed = true;
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

.info {
  color: #4e73df;
}

.error {
  color: #e74a3b;
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

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

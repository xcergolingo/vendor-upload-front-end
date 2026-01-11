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
        <div v-if="shouldShowTranslation(split)" class="sentence translation">
          {{ translationText(split) }}
        </div>
        <video controls playsinline webkit-playsinline preload="metadata" :src="split.video_url"></video>
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
const showDownloadDialog = ref(false);
const downloadMovieTitle = ref('');
const downloadChapterNo = ref(1);
const downloadCustomTags = ref('');

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
      isIndexing: false,
      isDeleting: false,
      showPriorityInput: false,
      priority_score: 1
    }));
    resetDownloadState();
  } catch (err) {
    console.error(err);
    error.value = 'Unable to load video splits. Please try again.';
  } finally {
    loading.value = false;
  }
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

.info {
  color: #4e73df;
}

.error {
  color: #e74a3b;
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
</style>

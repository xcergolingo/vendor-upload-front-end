<template>
  <div class="mobile-check-videos">
    <div class="header">
      <h2>Uploaded Videos</h2>
      <button class="refresh" @click="fetchVideos" :disabled="loading">
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>
    <p class="note">
      Videos may take a short while to appear. Use the in-list player to preview
      or open the transcript view to inspect captions.
    </p>
    
    <ul v-if="paginatedVideos.length > 0" class="video-list">
      <li v-for="video in paginatedVideos" :key="video.name" class="video-card">
        <div class="video-info">
          <strong class="video-name">{{ video.name }}</strong>
          <video 
            controls 
            playsinline 
            webkit-playsinline 
            preload="metadata" 
            :src="video.url"
            @play="handleVideoPlay($event, video)"
          ></video>
        </div>
        
        <button 
          class="show-transcripts-btn" 
          @click="toggleTranscripts(video)"
          :class="{ active: expandedVideo === video.name }"
        >
          {{ expandedVideo === video.name ? 'Hide transcripts' : 'Show transcripts' }}
        </button>
        
        <!-- Inline Transcript Viewer -->
        <transition name="slide">
          <div v-if="expandedVideo === video.name" class="transcript-panel">
            <div v-if="loadingTranscripts" class="transcript-loading">
              <div class="spinner"></div>
              <span>Loading transcripts...</span>
            </div>
            <div v-else-if="transcriptError" class="transcript-error">
              {{ transcriptError }}
            </div>
            <div v-else-if="currentTranscripts.length > 0" class="transcript-list">
              <div 
                v-for="(transcript, index) in currentTranscripts" 
                :key="index" 
                class="transcript-item"
                @click="seekToTimestamp(video, transcript)"
              >
                <span class="timestamp">{{ formatTimestamp(transcript.start_time) }}</span>
                <span class="text">{{ transcript.text }}</span>
                <span v-if="transcript.translation" class="translation">{{ transcript.translation }}</span>
              </div>
            </div>
            <div v-else class="transcript-empty">
              No transcripts available for this video.
            </div>
          </div>
        </transition>
      </li>
    </ul>
    
    <p v-else class="empty">
      {{ loading ? 'Loading videos...' : 'No videos found.' }}
    </p>
    
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
        Previous
      </button>
      <span class="page-info">Page {{ currentPage }} / {{ totalPages }}</span>
      <button
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
      >
        Next
      </button>
    </div>
    
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const videos = ref([]);
const loading = ref(false);
const error = ref('');
const currentPage = ref(1);
const pageSize = 10;

// Transcript state
const expandedVideo = ref(null);
const currentTranscripts = ref([]);
const loadingTranscripts = ref(false);
const transcriptError = ref('');
const transcriptCache = ref(new Map());

// Video element refs for seeking
const videoElements = ref(new Map());

const totalPages = computed(() =>
  Math.max(1, Math.ceil(videos.value.length / pageSize))
);

const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return videos.value.slice(start, start + pageSize);
});

async function fetchVideos() {
  if (!props.userEmail) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/list-uploaded-video',
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
    videos.value = Array.isArray(payload?.body) ? payload.body : [];
    currentPage.value = 1;
    // Reset expanded state
    expandedVideo.value = null;
    currentTranscripts.value = [];
  } catch (err) {
    console.error(err);
    error.value = 'Unable to load videos. Please try again.';
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value);
  // Collapse any expanded transcript when changing pages
  expandedVideo.value = null;
  currentTranscripts.value = [];
}

async function toggleTranscripts(video) {
  if (expandedVideo.value === video.name) {
    // Collapse
    expandedVideo.value = null;
    currentTranscripts.value = [];
    return;
  }
  
  // Expand and fetch transcripts
  expandedVideo.value = video.name;
  transcriptError.value = '';
  
  // Check cache first
  if (transcriptCache.value.has(video.name)) {
    currentTranscripts.value = transcriptCache.value.get(video.name);
    return;
  }
  
  loadingTranscripts.value = true;
  currentTranscripts.value = [];
  
  try {
    const response = await fetch(
      'https://ln686uub5b.execute-api.us-east-1.amazonaws.com/prod/vendor/get-video-transcripts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_name: props.userEmail,
          video_name: video.name,
          video_url: video.url
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Request failed');
    }
    
    const payload = await response.json();
    const transcripts = Array.isArray(payload?.body) ? payload.body : [];
    
    // Cache the results
    transcriptCache.value.set(video.name, transcripts);
    currentTranscripts.value = transcripts;
    
    // Scroll to transcript panel
    await nextTick();
    const panel = document.querySelector('.transcript-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    console.error(err);
    transcriptError.value = 'Unable to load transcripts. Please try again.';
  } finally {
    loadingTranscripts.value = false;
  }
}

function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function handleVideoPlay(event, video) {
  // Store reference to video element
  videoElements.value.set(video.name, event.target);
  
  // Pause other videos when one starts playing
  document.querySelectorAll('.video-card video').forEach(v => {
    if (v !== event.target && !v.paused) {
      v.pause();
    }
  });
}

function seekToTimestamp(video, transcript) {
  const videoEl = document.querySelector(`.video-card video[src="${video.url}"]`);
  if (videoEl && transcript.start_time !== undefined) {
    videoEl.currentTime = transcript.start_time;
    videoEl.play().catch(err => console.log('Autoplay prevented:', err));
    
    // Scroll video into view
    videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

watch(
  () => props.userEmail,
  email => {
    if (email) {
      fetchVideos();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.mobile-check-videos {
  padding: 12px;
  max-width: 100%;
  overflow-x: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #4e73df;
}

.note {
  color: #858796;
  font-size: 0.85rem;
  margin-bottom: 16px;
  line-height: 1.4;
}

.video-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.video-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e3e6f0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.video-name {
  font-size: 0.85rem;
  color: #5a5c69;
  word-break: break-all;
  line-height: 1.3;
}

.video-card video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  max-height: 200px;
  object-fit: contain;
}

.show-transcripts-btn {
  width: 100%;
  border: none;
  background-color: #1cc88a;
  color: white;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: background-color 0.2s, transform 0.1s;
  touch-action: manipulation;
}

.show-transcripts-btn:active {
  transform: scale(0.98);
}

.show-transcripts-btn.active {
  background-color: #17a673;
}

.refresh {
  border: none;
  background-color: #36b9cc;
  color: white;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.refresh:disabled {
  opacity: 0.6;
}

/* Transcript Panel */
.transcript-panel {
  background: #f8f9fc;
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.transcript-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: #858796;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e3e6f0;
  border-top-color: #4e73df;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.transcript-error {
  color: #e74a3b;
  text-align: center;
  padding: 16px;
}

.transcript-empty {
  color: #858796;
  text-align: center;
  padding: 16px;
}

.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transcript-item {
  background: white;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid #e3e6f0;
}

.transcript-item:active {
  background-color: #eef2ff;
}

.timestamp {
  font-size: 0.75rem;
  color: #4e73df;
  font-weight: 600;
  font-family: monospace;
}

.text {
  font-size: 0.9rem;
  color: #5a5c69;
  line-height: 1.4;
}

.translation {
  font-size: 0.85rem;
  color: #858796;
  font-style: italic;
  margin-top: 2px;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.pagination button {
  border: none;
  padding: 10px 16px;
  background-color: #4e73df;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}

.pagination button:disabled {
  background-color: #d1d3e2;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.9rem;
  color: #5a5c69;
}

.empty {
  text-align: center;
  color: #858796;
  padding: 40px 20px;
}

.error {
  color: #e74a3b;
  text-align: center;
  margin-top: 16px;
}

/* Slide Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Mobile-specific optimizations */
@media (max-width: 480px) {
  .mobile-check-videos {
    padding: 10px;
  }
  
  .header h2 {
    font-size: 1.1rem;
  }
  
  .video-card {
    padding: 12px;
  }
  
  .video-name {
    font-size: 0.8rem;
  }
  
  .show-transcripts-btn {
    padding: 14px 16px;
  }
}

/* Safe area for notched phones */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .mobile-check-videos {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
</style>

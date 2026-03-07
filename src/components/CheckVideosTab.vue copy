<template>
  <div class="check-videos">
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
      <li v-for="video in paginatedVideos" :key="video.name">
        <div class="info">
          <strong>{{ video.name }}</strong>
          <video controls playsinline webkit-playsinline preload="metadata" :src="video.url"></video>
        </div>
        <button class="detail" @click="openDetails(video)">
          Show transcripts
        </button>
      </li>
    </ul>
    <p v-else class="empty">
      {{ loading ? 'Loading videos...' : 'No videos found.' }}
    </p>
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
        Previous
      </button>
      <span>Page {{ currentPage }} / {{ totalPages }}</span>
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
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const router = useRouter();
const videos = ref([]);
const loading = ref(false);
const error = ref('');
const currentPage = ref(1);
const pageSize = 10;

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
  } catch (err) {
    console.error(err);
    error.value = 'Unable to load videos. Please try again.';
  } finally {
    loading.value = false;
  }
}

function changePage(page) {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value);
}

function openDetails(video) {
  router.push({
    name: 'video-detail',
    params: { fileName: video.name },
    query: { url: video.url }
  });
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
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.note {
  color: #858796;
  font-size: 0.9rem;
}

.video-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
}

.video-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e3e6f0;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info video {
  max-width: 360px;
  width: 100%;
  border-radius: 6px;
  border: 1px solid #e3e6f0;
}

.detail {
  border: none;
  background-color: #1cc88a;
  color: white;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
}

.refresh {
  border: none;
  background-color: #36b9cc;
  color: white;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}

.pagination button {
  border: none;
  padding: 8px 12px;
  background-color: #4e73df;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.empty {
  text-align: center;
  color: #858796;
}

.error {
  color: #e74a3b;
  text-align: center;
}
</style>

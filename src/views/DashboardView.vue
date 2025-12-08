<template>
  <div class="dashboard">
    <div class="tabs">
      <button
        :class="{ active: activeTab === 'upload' }"
        @click="setTab('upload')"
      >
        Upload Video
      </button>
      <button :class="{ active: activeTab === 'check' }" @click="setTab('check')">
        Check Video
      </button>
      <button :class="{ active: activeTab === 'splits' }" @click="setTab('splits')">
        Video Splits
      </button>
    </div>
    <section class="tab-content">
      <UploadTab
        v-if="activeTab === 'upload'"
        :user-email="authState.userEmail"
      />
      <CheckVideosTab
        v-else-if="activeTab === 'check'"
        :user-email="authState.userEmail"
      />
      <VideoSplitsTab
        v-else
        :user-email="authState.userEmail"
      />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import UploadTab from '../components/UploadTab.vue';
import CheckVideosTab from '../components/CheckVideosTab.vue';
import VideoSplitsTab from '../components/VideoSplitsTab.vue';
import { authState } from '../services/auth';

const route = useRoute();
const router = useRouter();
const validTabs = ['upload', 'check', 'splits'];

const activeTab = computed({
  get: () =>
    validTabs.includes(route.query.tab)
      ? route.query.tab
      : 'upload',
  set: value => {
    router.replace({
      query: {
        ...route.query,
        tab: value
      }
    });
  }
});

function setTab(tab) {
  activeTab.value = tab;
}
</script>

<style scoped>
.tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  gap: 12px;
}

.tabs button {
  padding: 10px 24px;
  border: 1px solid #4e73df;
  border-radius: 25px;
  background: transparent;
  color: #4e73df;
  font-weight: 600;
  cursor: pointer;
}

.tabs button.active {
  background-color: #4e73df;
  color: white;
}

.tab-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgb(0 0 0 / 5%);
}
</style>

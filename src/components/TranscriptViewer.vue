<template>
  <div class="transcript-viewer" v-if="entries.length">
    <div v-for="entry in entries" :key="entry.index" class="entry">
      <div class="time">
        {{ entry.start }} → {{ entry.end }}
      </div>
      <p>{{ entry.text }}</p>
    </div>
  </div>
  <p v-else class="empty">No transcript data available.</p>
</template>

<script setup>
import { computed } from 'vue';
import { parseSrt } from '../utils/srt';

const props = defineProps({
  srt: {
    type: String,
    default: ''
  }
});

const entries = computed(() => parseSrt(props.srt));
</script>

<style scoped>
.transcript-viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.entry {
  padding: 12px;
  border-radius: 6px;
  background-color: #f8f9fc;
  border: 1px solid #e3e6f0;
}

.time {
  font-weight: 600;
  color: #4e73df;
  margin-bottom: 6px;
}

.empty {
  text-align: center;
  color: #858796;
}
</style>

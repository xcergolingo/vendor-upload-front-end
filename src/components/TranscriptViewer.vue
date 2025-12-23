<template>
  <div class="transcript-viewer" v-if="renderEntries.length">
    <div
      v-for="entry in renderEntries"
      :key="entry.id"
      class="entry"
      :class="{ selectable: selectable }"
      :role="selectable ? 'button' : undefined"
      :tabindex="selectable ? 0 : undefined"
      @click="handleSelect(entry)"
      @keydown.enter.prevent="handleSelect(entry)"
      @keydown.space.prevent="handleSelect(entry)"
    >
      <div class="time">
        {{ entry.start }} → {{ entry.end }}
      </div>
      <div class="segments">
        <p
          v-for="(segment, index) in entry.segments"
          :key="segment.variant + '-' + index"
          class="segment"
          :class="segment.variant"
        >
          {{ segment.text }}
        </p>
      </div>
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
  },
  entries: {
    type: Array,
    default: () => []
  },
  selectable: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select']);

function handleSelect(entry) {
  if (!props.selectable) return;
  emit('select', entry);
}

const renderEntries = computed(() => {
  if (props.entries?.length) {
    return props.entries;
  }
  if (!props.srt) {
    return [];
  }
  return parseSrt(props.srt).map((entry, index) => ({
    id: entry.index || `entry-${index + 1}`,
    start: entry.start,
    end: entry.end,
    segments: [
      {
        text: (entry.text || '').trim(),
        variant: 'single'
      }
    ]
  }));
});
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

.entry.selectable {
  cursor: pointer;
}

.entry.selectable:hover {
  border-color: #4e73df;
  background-color: #f0f3ff;
}

.time {
  font-weight: 600;
  color: #4e73df;
  margin-bottom: 6px;
}

.segments {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.segment {
  margin: 0;
  color: #2c3e50;
}

.segment.input {
  color: #1cc88a;
}

.segment.output {
  color: #4e73df;
  font-weight: 600;
}

.empty {
  text-align: center;
  color: #858796;
}
</style>

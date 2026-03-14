<template>
  <form class="upload-form" @submit.prevent="handleSubmit">
    <h2>Upload Video</h2>
    
    <!-- Upload mode toggle -->
    <div class="upload-mode-toggle">
      <button 
        type="button" 
        :class="{ active: uploadMode === 'file' }"
        @click="uploadMode = 'file'"
      >
        📁 Upload File
      </button>
      <button 
        type="button" 
        :class="{ active: uploadMode === 'youtube' }"
        @click="uploadMode = 'youtube'"
      >
        🎬 YouTube URL
      </button>
    </div>

    <!-- File upload mode -->
    <label v-if="uploadMode === 'file'">
      Choose File
      <input
        ref="fileInput"
        type="file"
        accept=".mp4,.mov,video/*"
        @change="onFileChange"
        :required="uploadMode === 'file'"
      />
    </label>
    
    <!-- YouTube URL mode -->
    <label v-if="uploadMode === 'youtube'">
      YouTube Video URL
      <input
        v-model.trim="youtubeUrl"
        type="url"
        placeholder="https://www.youtube.com/watch?v=..."
        :required="uploadMode === 'youtube'"
      />
      <span class="hint">Paste a YouTube video link. The video will be downloaded and processed automatically.</span>
    </label>
    <label>
      Choose Input Language
      <select v-model="language">
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.label }}
        </option>
      </select>
    </label>
    <label>
      Choose Output Language
      <select v-model="outputLanguage">
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.label }}
        </option>
      </select>
    </label>
    <label>
      Index (Optional)
      <input v-model.trim="indexValue" type="number" min="0" step="any" placeholder="0" />
    </label>
    <label>
      Tags (Optional)
      <input v-model.trim="tags" type="text" placeholder="comma separated tags" />
    </label>
    <label>
      Weblink (Optional)
      <input v-model.trim="weblink" type="text" placeholder="www.youtube.com" />
    </label>
    <label>
      Link Name (Optional)
      <input v-model.trim="linkName" type="text" placeholder="youtube" />
    </label>
    <button type="submit" :disabled="uploading">
      {{ uploading ? 'Uploading...' : 'Upload' }}
    </button>
    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const languages = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'fi', label: 'Finnish' },
  { code: 'ko', label: 'Korean' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'vi', label: 'Vietnamese' }
];

const fileInput = ref(null);
const selectedFile = ref(null);
const uploadMode = ref('file'); // 'file' or 'youtube'
const youtubeUrl = ref('');
const language = ref('auto');
const outputLanguage = ref('auto');
const indexValue = ref('');
const tags = ref('');
const weblink = ref('');
const linkName = ref('');
const uploading = ref(false);
const message = ref('');
const error = ref('');

function onFileChange(event) {
  const files = event.target.files;
  selectedFile.value = files && files[0] ? files[0] : null;
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function handleSubmit() {
  if (!props.userEmail) {
    error.value = 'Missing user email.';
    return;
  }

  if (uploadMode.value === 'youtube') {
    await handleYouTubeSubmit();
  } else {
    await handleFileSubmit();
  }
}

async function handleYouTubeSubmit() {
  if (!youtubeUrl.value) {
    error.value = 'Please enter a YouTube URL.';
    return;
  }
  
  const videoId = extractYouTubeId(youtubeUrl.value);
  if (!videoId) {
    error.value = 'Invalid YouTube URL. Please check the link.';
    return;
  }

  uploading.value = true;
  error.value = '';
  message.value = '';

  const requestBody = {
    user_name: props.userEmail,
    youtube_url: youtubeUrl.value,
    youtube_id: videoId,
    lang: language.value,
    output_lang: outputLanguage.value,
    theme_title: `YouTube_${videoId}`
  };

  if (indexValue.value) requestBody.index = indexValue.value;
  if (tags.value) requestBody.tags = tags.value;
  if (weblink.value) requestBody.weblink = weblink.value || youtubeUrl.value;
  if (linkName.value) requestBody.link_name = linkName.value || 'YouTube';

  try {
    const response = await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/process-youtube',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to process YouTube video.');
    }
    
    message.value = 'YouTube video submitted for processing! Check back in a few minutes.';
    youtubeUrl.value = '';
    indexValue.value = '';
    tags.value = '';
    weblink.value = '';
    linkName.value = '';
  } catch (err) {
    console.error(err);
    error.value = err.message || 'YouTube processing failed. Please try again.';
  } finally {
    uploading.value = false;
  }
}

async function handleFileSubmit() {
  if (!selectedFile.value) {
    error.value = 'Please choose a video file.';
    return;
  }

  uploading.value = true;
  error.value = '';
  message.value = '';

  const requestBody = {
    user_name: props.userEmail,
    filename: selectedFile.value.name,
    lang: language.value,
    output_lang: outputLanguage.value,
    theme_title: selectedFile.value.name
  };

  if (indexValue.value) requestBody.index = indexValue.value;
  if (tags.value) requestBody.tags = tags.value;
  if (weblink.value) requestBody.weblink = weblink.value;
  if (linkName.value) requestBody.link_name = linkName.value;

  try {
    const urlResponse = await fetch(
      'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/generate-upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    if (!urlResponse.ok) {
      throw new Error('Failed to request upload URL.');
    }
    const data = await urlResponse.json();
    const uploadUrl = data?.body?.url;
    if (!uploadUrl) {
      throw new Error('Upload URL not returned.');
    }
    await uploadFile(uploadUrl);
    message.value = 'File uploaded successfully!';
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    indexValue.value = '';
    tags.value = '';
    weblink.value = '';
    linkName.value = '';
    selectedFile.value = null;
  } catch (err) {
    console.error(err);
    error.value = err.message || 'Upload failed. Please try again.';
  } finally {
    uploading.value = false;
  }
}

function getContentType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

async function uploadFile(url) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': getContentType(selectedFile.value.name)
    },
    body: selectedFile.value
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
</script>

<style scoped>
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h2 {
  margin-top: 0;
  color: #4e73df;
}

.upload-mode-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.upload-mode-toggle button {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #d1d3e2;
  border-radius: 8px;
  background: #fff;
  color: #858796;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-mode-toggle button:hover {
  border-color: #4e73df;
  color: #4e73df;
}

.upload-mode-toggle button.active {
  border-color: #4e73df;
  background: #4e73df;
  color: #fff;
}

.hint {
  font-size: 0.8rem;
  color: #858796;
  margin-top: 4px;
  font-weight: 400;
}

label {
  display: flex;
  flex-direction: column;
  text-align: left;
  font-weight: 600;
  color: #858796;
  font-size: 0.95rem;
}

input,
select {
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid #d1d3e2;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  width: 160px;
  align-self: center;
  padding: 10px 14px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.message {
  color: #1cc88a;
  text-align: center;
}

.error {
  color: #e74a3b;
  text-align: center;
}
</style>

<template>
  <form class="upload-form" @submit.prevent="handleSubmit">
    <h2>Upload Video</h2>
    <label>
      Choose File
<input
        ref="fileInput"
        type="file"
        accept=".mp4,.mov,video/*"
        @change="onFileChange"
        required
      />
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
      Sentence
      <input v-model.trim="sentence" type="text" placeholder="Sentence associated with the video" required />
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
const language = ref('en');
const outputLanguage = ref('en');
const sentence = ref('');
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

async function handleSubmit() {
  if (!selectedFile.value) {
    error.value = 'Please choose a video file.';
    return;
  }
  if (!props.userEmail) {
    error.value = 'Missing user email.';
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
    theme_title: sentence.value
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
    sentence.value = '';
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

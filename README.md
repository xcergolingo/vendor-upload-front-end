<<<<<<< HEAD
# vendor-upload-front-end
=======
# Golingo Vendor Site (Vue 3)

Vue 3 + Vite rewrite of the HTML vendor upload portal. The MVP keeps the existing Auth0 username/password login plus the upload and check tabs, and adds a video detail view that shows parsed transcripts for each uploaded asset.

## Features

- Auth0 email/password login, logout, and registration.
- Upload videos with language, output language, and metadata fields using the existing presigned upload endpoint.
- Check uploaded videos via the `vendor/list-uploaded-video` API, with pagination and quick refresh.
- Review indexed clips under the Video Splits tab, push individual clips into search, or bulk-download selected clips as JSON.
- Open any video to a dedicated detail page that embeds the media, shows translated transcripts (and original captions when a different output language is requested), offers an edit tab where you can drag one caption box onto its neighbor to merge them, and provides a “Generate clips” action that posts the edited transcript back to the backend.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the dev server**

   ```bash
   npm run dev
   ```

   The app listens on `http://localhost:5173`. Auth0 callbacks are already configured for this origin.

3. **Build for production**

   ```bash
   npm run build
   npm run preview # optional static preview
   ```

## Configuration

Auth0 settings (domain, client ID, and redirect URI) are taken directly from the previous HTML site. If you need to change any of these, update `src/services/auth.js`. Other API endpoints for uploads, listings, and transcripts are hard-coded in the corresponding components and can be moved to environment variables later if needed.

## Project Structure

- `src/services/auth.js` – lightweight Auth0 wrapper handling login/register/logout and session state.
- `src/views/DashboardView.vue` – upload/check/splits tab shell.
- `src/components/UploadTab.vue` – upload form with presigned PUT.
- `src/components/CheckVideosTab.vue` – pagination, new listing endpoint, and detail navigation.
- `src/views/VideoDetailView.vue` & `src/components/TranscriptViewer.vue` – transcripts page and SRT parsing/display.
- `src/components/VideoSplitsTab.vue` – video split indexing and bulk download tools.

## Next Steps

- Wire up persistence for transcript edits (if needed) or connect the clip generation response once the backend is ready.
- Externalize API endpoints and durations into environment variables if this deployment will target multiple environments.
>>>>>>> 323d70c (initial port)

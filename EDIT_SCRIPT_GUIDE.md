# Edit Script Page - User Guide

## Overview
The Edit Script page allows you to review and edit video transcripts, adjust timing, and generate clips for language learning content.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Video Player]                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [▶ Global Offset]  ← Click to expand/collapse              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Adjust: [-0.3s][-0.1s][====slider====][+0.1s][+0.3s]│   │
│  │ [Apply] [Reset]                                      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Entry 1:                                    [+] [×]        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [-] 00:00:05,000 [+]  [←][↑][↓][→]  [Edit] [Gen]   │   │
│  │ [-] 00:00:08,500 [+]                                │   │
│  │ "Original text in source language"                   │   │
│  │ "Translated text in target language"                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Entry 2: ...                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Features & How to Use

### 1. Video Playback
- Click anywhere on a timestamp to **play from that point**
- Video syncs with the transcript entries

### 2. Global Offset (Collapsible)
Click **"▶ Global Offset"** to expand timing controls:
- **−0.3s / −0.1s**: Shift ALL timestamps earlier
- **+0.1s / +0.3s**: Shift ALL timestamps later
- **Slider**: Fine-tune offset (−2s to +2s)
- **Apply**: Apply the slider offset to all entries
- **Reset**: Reset slider to 0

> 💡 Use this when the entire transcript is consistently early or late

### 3. Entry Controls

#### Top Actions
| Button | Action |
|--------|--------|
| **+** | Clone/duplicate this entry |
| **×** | Delete this entry |

#### Time Controls
| Button | Action |
|--------|--------|
| **−** / **+** | Adjust start/end time by 0.1s (hold for continuous) |
| **←** | Copy start time from previous entry's end |
| **→** | Copy start time from next entry's start |
| **↑** | Merge with previous entry |
| **↓** | Merge with next entry |

#### Action Buttons
| Button | Action |
|--------|--------|
| **Edit** | Open full editor for this entry (text + timing) |
| **Gen** | Generate/regenerate the video clip for this entry |

### 4. Editing an Entry
Click **Edit** to open the editor panel:
1. Adjust **Start** and **End** times
2. Edit **Input text** (original language)
3. Edit **Output text** (translation)
4. Click **Save** to apply changes
5. Click **Cancel** to discard

### 5. Generating Clips
Click **Gen** to create a video clip:
- Sends the entry's timing and text to the server
- Server cuts the video and adds subtitles
- Button shows "Gen..." while processing

> ⚠️ Make sure you're logged in before generating clips

---

## Workflow Tips

### Typical Editing Workflow
1. **Watch** the video and identify timing issues
2. **Adjust Global Offset** if entire transcript is off
3. **Fine-tune** individual entries with +/− buttons
4. **Edit** text if transcription has errors
5. **Merge** short entries if needed
6. **Generate** clips when timing is correct

### Keyboard Shortcuts
- Click timestamp → Jump video to that time
- Hold +/− buttons → Continuous adjustment

---

## Troubleshooting

### Gen button not working?
1. Check browser console (F12) for error messages
2. Ensure you're logged in
3. Verify a video file is selected
4. Check network connection

### Timing seems off?
1. Try Global Offset first for bulk adjustment
2. Use individual +/− for fine-tuning
3. Click timestamp to preview exact position

---

## Need Help?
Check the browser console (F12 → Console) for detailed logs when using the Gen button.

/**
 * Mobile Video Transcript Viewer Script
 * For vendor.golingoapp.com
 * 
 * Shows video clips/sentences inline instead of navigating to detail page.
 * Tap any sentence to open the video clip.
 */

(function() {
  'use strict';

  const CONFIG = {
    splitsApiUrl: 'https://igr9sg55zi.execute-api.us-east-1.amazonaws.com/prod/list-latest-video-splits-and-sentences',
    pageSize: 100,
    cacheEnabled: true
  };

  const state = {
    expandedVideo: null,
    splitsCache: null,
    userEmail: null
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    state.userEmail = window.__VENDOR_USER_EMAIL__ || getUserEmailFromPage() || getUserEmailFromStorage();
    injectMobileStyles();
    enhanceVideoList();
    observeVideoList();
    console.log('[MobileShowScript] Initialized for user:', state.userEmail);
  }

  function getUserEmailFromPage() {
    // Try to get email from the page's displayed user info
    const userEl = document.querySelector('nav .user-email, [class*="user"]');
    return userEl?.textContent?.trim();
  }

  function getUserEmailFromStorage() {
    try {
      return localStorage.getItem('vendorUserEmail') || sessionStorage.getItem('vendorUserEmail');
    } catch (e) {
      return null;
    }
  }

  function injectMobileStyles() {
    const styleId = 'mobile-transcript-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .mobile-transcript-panel {
        background: #f8f9fc;
        border-radius: 8px;
        padding: 12px;
        margin-top: 12px;
        max-height: 350px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        animation: mtSlideDown 0.3s ease;
      }

      @keyframes mtSlideDown {
        from { opacity: 0; max-height: 0; padding: 0 12px; }
        to { opacity: 1; max-height: 350px; padding: 12px; }
      }

      .mobile-transcript-panel.collapsing {
        animation: mtSlideUp 0.25s ease forwards;
      }

      @keyframes mtSlideUp {
        from { opacity: 1; max-height: 350px; }
        to { opacity: 0; max-height: 0; padding: 0 12px; }
      }

      .mobile-transcript-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        color: #858796;
      }

      .mobile-transcript-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e3e6f0;
        border-top-color: #4e73df;
        border-radius: 50%;
        animation: mtSpin 0.8s linear infinite;
      }

      @keyframes mtSpin { to { transform: rotate(360deg); } }

      .mobile-transcript-error {
        color: #e74a3b;
        text-align: center;
        padding: 16px;
      }

      .mobile-transcript-empty {
        color: #858796;
        text-align: center;
        padding: 16px;
      }

      .mobile-transcript-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .mobile-transcript-item {
        background: white;
        border-radius: 6px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
        transition: background-color 0.15s, transform 0.1s;
        border: 1px solid #e3e6f0;
      }

      .mobile-transcript-item:active {
        background-color: #eef2ff;
        transform: scale(0.98);
      }

      .mobile-transcript-number {
        font-size: 0.7rem;
        color: #4e73df;
        font-weight: 700;
      }

      .mobile-transcript-text {
        font-size: 0.9rem;
        color: #374151;
        line-height: 1.4;
      }

      .mobile-transcript-translation {
        font-size: 0.85rem;
        color: #6b7280;
        font-style: italic;
        margin-top: 2px;
      }

      .mobile-transcript-count {
        text-align: center;
        color: #858796;
        font-size: 0.8rem;
        padding: 8px;
        border-top: 1px solid #e3e6f0;
        margin-top: 8px;
      }

      /* Button state when expanded */
      button.detail.mt-expanded {
        background-color: #17a673 !important;
      }

      /* Fix button inside card - Mobile layout */
      .video-list {
        list-style: none;
        padding: 0;
        margin: 16px 0;
      }

      .video-list li {
        display: flex;
        flex-direction: column !important;
        align-items: stretch !important;
        padding: 12px !important;
        border: 1px solid #e3e6f0;
        border-radius: 10px;
        margin-bottom: 12px;
        background: #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      }

      .video-list li .info {
        width: 100% !important;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .video-list li .info strong {
        font-size: 0.8rem;
        color: #5a5c69;
        word-break: break-all;
        line-height: 1.3;
      }

      .video-list li .info video {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 8px;
        background: #000;
      }

      .video-list li .detail,
      .video-list li button.detail,
      .video-list li button {
        width: 100% !important;
        margin-top: 10px !important;
        padding: 12px 16px !important;
        font-size: 0.95rem !important;
        border-radius: 8px !important;
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(styles);
  }

  function enhanceVideoList() {
    const detailButtons = document.querySelectorAll('button');
    
    detailButtons.forEach(button => {
      if (!button.textContent.includes('Show transcripts') && !button.textContent.includes('Hide transcripts')) return;
      if (button.dataset.mtEnhanced) return;
      
      button.dataset.mtEnhanced = 'true';
      
      const listItem = button.closest('li');
      if (!listItem) return;
      
      const videoNameEl = listItem.querySelector('strong');
      if (!videoNameEl) return;
      
      const videoName = videoNameEl.textContent;
      
      button.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await handleShowTranscripts(this, listItem, videoName);
      }, { capture: true });
    });
  }

  async function handleShowTranscripts(button, listItem, videoName) {
    const existingPanel = listItem.querySelector('.mobile-transcript-panel');
    
    if (existingPanel) {
      collapsePanel(existingPanel, button);
      state.expandedVideo = null;
      return;
    }
    
    // Collapse any other open panels
    document.querySelectorAll('.mobile-transcript-panel').forEach(panel => {
      const parentButton = panel.closest('li')?.querySelector('button.mt-expanded');
      collapsePanel(panel, parentButton);
    });
    
    state.expandedVideo = videoName;
    button.textContent = 'Loading...';
    button.classList.add('mt-expanded');
    
    const panel = createTranscriptPanel();
    listItem.appendChild(panel);
    
    panel.innerHTML = `
      <div class="mobile-transcript-loading">
        <div class="mobile-transcript-spinner"></div>
        <span>Loading clips...</span>
      </div>
    `;
    
    try {
      const splits = await fetchSplitsForVideo(videoName);
      renderSplits(panel, splits, button);
    } catch (error) {
      console.error('[MobileShowScript] Error:', error);
      panel.innerHTML = `
        <div class="mobile-transcript-error">
          Unable to load clips. Please try again.
        </div>
      `;
      button.textContent = 'Show transcripts';
      button.classList.remove('mt-expanded');
    }
  }

  function createTranscriptPanel() {
    const panel = document.createElement('div');
    panel.className = 'mobile-transcript-panel';
    return panel;
  }

  function collapsePanel(panel, button) {
    panel.classList.add('collapsing');
    if (button) {
      button.textContent = 'Show transcripts';
      button.classList.remove('mt-expanded');
    }
    setTimeout(() => panel.remove(), 250);
  }

  async function fetchSplitsForVideo(videoName) {
    // Fetch all splits (with caching)
    if (!state.splitsCache || !CONFIG.cacheEnabled) {
      const response = await fetch(CONFIG.splitsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: state.userEmail,
          page_size: CONFIG.pageSize
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const payload = await response.json();
      state.splitsCache = Array.isArray(payload?.body) ? payload.body : [];
    }
    
    // Filter splits for this video
    const baseName = videoName.replace(/\.[^.]+$/, '').substring(0, 35);
    
    return state.splitsCache.filter(split => {
      const url = split.video_url || '';
      return url.includes(baseName);
    });
  }

  function renderSplits(panel, splits, button) {
    if (!splits || splits.length === 0) {
      panel.innerHTML = `
        <div class="mobile-transcript-empty">
          No clips found for this video yet.
        </div>
      `;
      button.textContent = 'Show transcripts';
      button.classList.remove('mt-expanded');
      return;
    }
    
    const listHtml = splits.map((split, index) => {
      const text = escapeHtml(split.sent || '');
      const translation = split.sent_translation || split.sent_transation || '';
      const videoUrl = split.video_url || '';
      
      return `
        <div class="mobile-transcript-item" data-url="${escapeHtml(videoUrl)}">
          <span class="mobile-transcript-number">#${index + 1}</span>
          <span class="mobile-transcript-text">${text}</span>
          ${translation ? `<span class="mobile-transcript-translation">${escapeHtml(translation)}</span>` : ''}
        </div>
      `;
    }).join('');
    
    panel.innerHTML = `
      <div class="mobile-transcript-list">${listHtml}</div>
      <div class="mobile-transcript-count">${splits.length} clip${splits.length === 1 ? '' : 's'} • Tap to play</div>
    `;
    
    // Add click handlers
    panel.querySelectorAll('.mobile-transcript-item').forEach(item => {
      item.addEventListener('click', function() {
        const url = this.dataset.url;
        if (url) window.open(url, '_blank');
      });
    });
    
    button.textContent = 'Hide transcripts';
    
    // Scroll panel into view
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function observeVideoList() {
    const observer = new MutationObserver((mutations) => {
      let shouldEnhance = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.matches?.('li, .video-list') || node.querySelector?.('button')) {
                shouldEnhance = true;
                break;
              }
            }
          }
        }
        if (shouldEnhance) break;
      }
      
      if (shouldEnhance) {
        setTimeout(enhanceVideoList, 100);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Public API
  window.MobileShowScript = {
    setUserEmail(email) {
      state.userEmail = email;
    },
    clearCache() {
      state.splitsCache = null;
    },
    refresh() {
      state.splitsCache = null;
      enhanceVideoList();
    }
  };

})();

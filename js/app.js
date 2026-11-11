/**
 * Corpus Cleaner - Web Application Controller
 * ============================================
 * Manages UI interactions, batch file processing, bilingual NLP pipelines
 * (Arabic & English), visual diff highlighting, small preview rendering,
 * and client-side ZIP/CSV export.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    files: [], // Array of { id, name, size, rawText, cleanedText, stats }
    langMode: 'arabic', // 'arabic' | 'english'
    arabicConfig: {
      removeTashkeel: true,
      normalizeAlef: true,
      normalizeYaa: true,
      removeKashida: true,
      removeHtml: true,
      removeMarkdown: true,
      removeLinks: true,
      removeStrangeChars: true,
      removeExtraSpaces: true,
      removeExtraLines: true,
      normalizeTaaHaa: false,
      normalizeHamza: false,
      removePunctuation: false,
      removeNumbers: false
    },
    englishConfig: {
      toLowerCase: true,
      expandContractions: true,
      removeAccents: true,
      removeHtml: true,
      removeMarkdown: true,
      removeLinks: true,
      removeEmails: true,
      removeStrangeChars: true,
      removeExtraSpaces: true,
      removeExtraLines: true,
      removePunctuation: false,
      removeNumbers: false
    },
    appendCleanedSuffix: true,
    activePreviewFileId: null,
    diffMode: 'highlighted', // 'highlighted' | 'plain'
    expandedPreviews: new Set()
  };

  // DOM Elements
  const DOM = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),
    filesSection: document.getElementById('filesSection'),
    filesTableBody: document.getElementById('filesTableBody'),
    emptyState: document.getElementById('emptyState'),

    // Language Tabs & Containers
    langTabArabic: document.getElementById('langTabArabic'),
    langTabEnglish: document.getElementById('langTabEnglish'),
    arabicOptionsSection: document.getElementById('arabicOptionsSection'),
    englishOptionsSection: document.getElementById('englishOptionsSection'),

    // KPIs
    kpiFilesCount: document.getElementById('kpiFilesCount'),
    kpiCharsBefore: document.getElementById('kpiCharsBefore'),
    kpiCharsAfter: document.getElementById('kpiCharsAfter'),
    kpiReductionPct: document.getElementById('kpiReductionPct'),
    kpiProcessTime: document.getElementById('kpiProcessTime'),

    // Actions
    downloadZipBtn: document.getElementById('downloadZipBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    themeToggleText: document.getElementById('themeToggleText'),
    appendSuffixCheckbox: document.getElementById('appendSuffixCheckbox'),

    // Modal
    diffModal: document.getElementById('diffModal'),
    modalFileName: document.getElementById('modalFileName'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCopyCleanBtn: document.getElementById('modalCopyCleanBtn'),
    modalDiffModeBtn: document.getElementById('modalDiffModeBtn'),
    diffModeText: document.getElementById('diffModeText'),
    diffOriginalPane: document.getElementById('diffOriginalPane'),
    diffCleanedPane: document.getElementById('diffCleanedPane'),
    diffCharStats: document.getElementById('diffCharStats')
  };

  /**
   * Initialize App
   */
  function init() {
    setupTheme();
    setupEventListeners();
    updateOptionCardsUI();
  }

  /**
   * Setup Theme (Dark / Light)
   */
  function setupTheme() {
    const savedTheme = localStorage.getItem('corpus_cleaner_theme') || 'dark';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('corpus_cleaner_theme', theme);
    if (DOM.themeToggleIcon && DOM.themeToggleText) {
      if (theme === 'dark') {
        DOM.themeToggleIcon.textContent = '☀️';
        DOM.themeToggleText.textContent = 'الوضع الفاتح';
      } else {
        DOM.themeToggleIcon.textContent = '🌙';
        DOM.themeToggleText.textContent = 'الوضع الداكن';
      }
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Theme toggle
    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Language switcher tabs
    if (DOM.langTabArabic) {
      DOM.langTabArabic.addEventListener('click', () => switchLanguageMode('arabic'));
    }
    if (DOM.langTabEnglish) {
      DOM.langTabEnglish.addEventListener('click', () => switchLanguageMode('english'));
    }

    // Drag & Drop
    if (DOM.dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        DOM.dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          DOM.dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        DOM.dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          DOM.dropzone.classList.remove('dragover');
        });
      });

      DOM.dropzone.addEventListener('drop', handleFileDrop);
      DOM.dropzone.addEventListener('click', () => DOM.fileInput.click());
    }

    // File inputs
    if (DOM.fileInput) {
      DOM.fileInput.addEventListener('change', e => handleFilesSelected(e.target.files));
    }
    if (DOM.folderInput) {
      DOM.folderInput.addEventListener('change', e => handleFilesSelected(e.target.files));
    }

    // Suffix Checkbox
    if (DOM.appendSuffixCheckbox) {
      DOM.appendSuffixCheckbox.checked = state.appendCleanedSuffix;
      DOM.appendSuffixCheckbox.addEventListener('change', e => {
        state.appendCleanedSuffix = e.target.checked;
      });
    }

    // Clear All
    if (DOM.clearAllBtn) {
      DOM.clearAllBtn.addEventListener('click', clearAllFiles);
    }

    // Download ZIP
    if (DOM.downloadZipBtn) {
      DOM.downloadZipBtn.addEventListener('click', downloadCleanedZip);
    }

    // Export Decisions CSV
    if (DOM.exportCsvBtn) {
      DOM.exportCsvBtn.addEventListener('click', exportDecisionsCsv);
    }

    // Option Toggle Cards (both Arabic and English)
    document.querySelectorAll('.toggle-card').forEach(card => {
      const lang = card.getAttribute('data-lang');
      const optionKey = card.getAttribute('data-option');
      const checkbox = card.querySelector('.toggle-checkbox');

      card.addEventListener('click', e => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }

        const config = lang === 'arabic' ? state.arabicConfig : state.englishConfig;
        config[optionKey] = checkbox.checked;
        card.classList.toggle('active', checkbox.checked);

        reprocessAllFiles();
      });
    });

    // Modal Close
    if (DOM.modalCloseBtn) {
      DOM.modalCloseBtn.addEventListener('click', closeDiffModal);
    }
    if (DOM.diffModal) {
      DOM.diffModal.addEventListener('click', e => {
        if (e.target === DOM.diffModal) closeDiffModal();
      });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDiffModal();
    });

    // Modal Copy Button
    if (DOM.modalCopyCleanBtn) {
      DOM.modalCopyCleanBtn.addEventListener('click', copyCleanedTextToClipboard);
    }

    // Modal Diff Mode Button (Highlighted vs Plain)
    if (DOM.modalDiffModeBtn) {
      DOM.modalDiffModeBtn.addEventListener('click', toggleModalDiffMode);
    }
  }

  /**
   * Switch Language Mode (Arabic vs English)
   */
  function switchLanguageMode(lang) {
    if (state.langMode === lang) return;
    state.langMode = lang;

    if (DOM.langTabArabic && DOM.langTabEnglish) {
      DOM.langTabArabic.classList.toggle('active', lang === 'arabic');
      DOM.langTabEnglish.classList.toggle('active', lang === 'english');
    }

    if (DOM.arabicOptionsSection && DOM.englishOptionsSection) {
      DOM.arabicOptionsSection.style.display = lang === 'arabic' ? 'block' : 'none';
      DOM.englishOptionsSection.style.display = lang === 'english' ? 'block' : 'none';
    }

    reprocessAllFiles();
  }

  function updateOptionCardsUI() {
    document.querySelectorAll('.toggle-card').forEach(card => {
      const lang = card.getAttribute('data-lang');
      const optionKey = card.getAttribute('data-option');
      const checkbox = card.querySelector('.toggle-checkbox');
      const config = lang === 'arabic' ? state.arabicConfig : state.englishConfig;

      if (config && optionKey in config) {
        checkbox.checked = !!config[optionKey];
        card.classList.toggle('active', checkbox.checked);
      }
    });
  }

  /**
   * File Drag & Drop Handling
   */
  function handleFileDrop(e) {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFilesSelected(dt.files);
    }
  }

  /**
   * Read multiple files using FileReader
   */
  async function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.txt') || f.type.startsWith('text/'));
    
    if (filesArray.length === 0) {
      alert('يرجى اختيار ملفات نصية بتنسيق .txt');
      return;
    }

    for (const file of filesArray) {
      const existingIdx = state.files.findIndex(item => item.name === file.name);
      try {
        const text = await readFileAsText(file);
        const fileObj = {
          id: 'file_' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          rawText: text,
          cleanedText: '',
          stats: { originalLen: text.length, cleanedLen: 0, reduction: 0 }
        };

        if (existingIdx >= 0) {
          state.files[existingIdx] = fileObj;
        } else {
          state.files.push(fileObj);
        }
      } catch (err) {
        console.error('Error reading file:', file.name, err);
      }
    }

    reprocessAllFiles();
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  /**
   * Batch Reprocess all uploaded files
   */
  function reprocessAllFiles() {
    if (state.files.length === 0) {
      updateUI();
      return;
    }

    const t0 = performance.now();
    let totalOriginalChars = 0;
    let totalCleanedChars = 0;

    const isArabic = state.langMode === 'arabic';
    const config = isArabic ? state.arabicConfig : state.englishConfig;

    state.files.forEach(fileObj => {
      if (isArabic) {
        fileObj.cleanedText = ArabicPreprocessor.process(fileObj.rawText, config);
      } else {
        fileObj.cleanedText = EnglishPreprocessor.process(fileObj.rawText, config);
      }

      fileObj.stats.originalLen = fileObj.rawText.length;
      fileObj.stats.cleanedLen = fileObj.cleanedText.length;
      fileObj.stats.reduction = fileObj.stats.originalLen - fileObj.stats.cleanedLen;

      totalOriginalChars += fileObj.stats.originalLen;
      totalCleanedChars += fileObj.stats.cleanedLen;
    });

    const elapsed = performance.now() - t0;
    updateUI(elapsed, totalOriginalChars, totalCleanedChars);

    // If modal is currently open, refresh diff
    if (state.activePreviewFileId) {
      renderDiffInModal(state.activePreviewFileId);
    }
  }

  /**
   * Update UI, KPIs, and Table
   */
  function updateUI(elapsedMs = 0, totalOriginal = 0, totalCleaned = 0) {
    const hasFiles = state.files.length > 0;

    if (DOM.filesSection) {
      DOM.filesSection.style.display = hasFiles ? 'block' : 'none';
    }
    if (DOM.emptyState) {
      DOM.emptyState.style.display = hasFiles ? 'none' : 'block';
    }
    if (DOM.downloadZipBtn) {
      DOM.downloadZipBtn.disabled = !hasFiles;
    }
    if (DOM.clearAllBtn) {
      DOM.clearAllBtn.disabled = !hasFiles;
    }

    if (!hasFiles) {
      DOM.kpiFilesCount.textContent = '0';
      DOM.kpiCharsBefore.textContent = '0';
      DOM.kpiCharsAfter.textContent = '0';
      DOM.kpiReductionPct.textContent = '0%';
      DOM.kpiProcessTime.textContent = '0 ms';
      return;
    }

    const diffChars = totalOriginal - totalCleaned;
    const reductionPct = totalOriginal > 0 ? ((diffChars / totalOriginal) * 100).toFixed(2) : 0;

    DOM.kpiFilesCount.textContent = state.files.length.toLocaleString();
    DOM.kpiCharsBefore.textContent = totalOriginal.toLocaleString();
    DOM.kpiCharsAfter.textContent = totalCleaned.toLocaleString();
    DOM.kpiReductionPct.textContent = `${reductionPct}%`;
    DOM.kpiProcessTime.textContent = `${Math.round(elapsedMs)} ms`;

    renderFilesTable();
  }

  /**
   * Render Files Table with Small Inline Previews
   */
  function renderFilesTable() {
    if (!DOM.filesTableBody) return;
    DOM.filesTableBody.innerHTML = '';

    const isArabic = state.langMode === 'arabic';
    const textDir = isArabic ? 'rtl' : 'ltr';

    state.files.forEach((fileObj, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-theme hover:bg-theme-tertiary/40 transition';

      const diff = fileObj.stats.reduction;
      const pct = fileObj.stats.originalLen > 0 
        ? ((diff / fileObj.stats.originalLen) * 100).toFixed(1) 
        : 0;

      // Small preview snippet (first 180 chars)
      const isExpanded = state.expandedPreviews.has(fileObj.id);
      const snippetLength = isExpanded ? 500 : 180;
      let snippet = fileObj.cleanedText.slice(0, snippetLength);
      if (fileObj.cleanedText.length > snippetLength) snippet += '...';
      if (!snippet.trim()) snippet = '<span class="italic text-muted-custom">(نص فارغ بعد المعالجة)</span>';

      tr.innerHTML = `
        <td class="p-3 text-sm text-muted-custom font-mono align-top pt-4 text-center">${idx + 1}</td>
        <td class="p-3 text-sm text-main align-top pt-4">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-base">📄</span>
            <span class="font-bold truncate max-w-xs md:max-w-md" title="${fileObj.name}">${escapeHtml(fileObj.name)}</span>
          </div>

          <!-- Small Inline Preview Box -->
          <div class="mt-2 flex flex-col gap-1">
            <div class="flex items-center justify-between text-[11px] text-muted-custom">
              <span class="font-medium flex items-center gap-1">
                <span>👁️</span>
                <span>معاينة سريعة للنص:</span>
              </span>
              <button type="button" class="toggle-snippet-btn hover:text-emerald-500 text-[10px] underline" data-id="${fileObj.id}">
                ${isExpanded ? 'طي المعاينة' : 'عرض المزيد'}
              </button>
            </div>
            <div class="file-preview-box p-2 rounded-lg ${isExpanded ? 'expanded' : ''}" dir="${textDir}">
              ${escapeHtml(snippet)}
            </div>
          </div>
        </td>
        <td class="p-3 text-xs text-muted-custom font-mono align-top pt-4" dir="ltr">${fileObj.stats.originalLen.toLocaleString()} chars</td>
        <td class="p-3 text-xs text-emerald-500 font-mono align-top pt-4" dir="ltr">${fileObj.stats.cleanedLen.toLocaleString()} chars</td>
        <td class="p-3 align-top pt-4">
          <span class="badge ${diff > 0 ? 'badge-diff-change' : 'badge-privacy'}">
            ${diff > 0 ? `-${diff} (${pct}%)` : 'مطابق'}
          </span>
        </td>
        <td class="p-3 text-left align-top pt-4">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            <button class="btn-primary text-xs px-2.5 py-1.5 preview-btn" data-id="${fileObj.id}" title="عرض الفروق الملونة جنباً إلى جنب">
              <span>👁️</span>
              <span>معاينة الفروق</span>
            </button>
            <button class="btn-secondary text-xs px-2.5 py-1.5 download-single-btn" data-id="${fileObj.id}" title="تنزيل الملف المعالج">
              <span>⬇️</span>
            </button>
            <button class="text-muted-custom hover:text-red-500 p-1.5 rounded delete-single-btn" data-id="${fileObj.id}" title="حذف الملف">
              🗑️
            </button>
          </div>
        </td>
      `;

      DOM.filesTableBody.appendChild(tr);
    });

    // Attach row events
    DOM.filesTableBody.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', () => openDiffModal(btn.getAttribute('data-id')));
    });

    DOM.filesTableBody.querySelectorAll('.download-single-btn').forEach(btn => {
      btn.addEventListener('click', () => downloadSingleFile(btn.getAttribute('data-id')));
    });

    DOM.filesTableBody.querySelectorAll('.delete-single-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteSingleFile(btn.getAttribute('data-id')));
    });

    DOM.filesTableBody.querySelectorAll('.toggle-snippet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (state.expandedPreviews.has(id)) {
          state.expandedPreviews.delete(id);
        } else {
          state.expandedPreviews.add(id);
        }
        renderFilesTable();
      });
    });
  }

  /**
   * Delete Single File
   */
  function deleteSingleFile(fileId) {
    state.files = state.files.filter(f => f.id !== fileId);
    state.expandedPreviews.delete(fileId);
    reprocessAllFiles();
  }

  /**
   * Clear All Files
   */
  function clearAllFiles() {
    if (state.files.length === 0) return;
    if (confirm('هل أنت متأكد من مسح جميع الملفات المرفوعة؟')) {
      state.files = [];
      state.expandedPreviews.clear();
      if (DOM.fileInput) DOM.fileInput.value = '';
      if (DOM.folderInput) DOM.folderInput.value = '';
      reprocessAllFiles();
    }
  }

  /**
   * Open Side-by-Side Diff Modal with Visual Highlighting
   */
  function openDiffModal(fileId) {
    state.activePreviewFileId = fileId;
    renderDiffInModal(fileId);
    DOM.diffModal.classList.add('active');
  }

  function renderDiffInModal(fileId) {
    const fileObj = state.files.find(f => f.id === fileId);
    if (!fileObj) return;

    DOM.modalFileName.textContent = fileObj.name;
    const isArabic = state.langMode === 'arabic';
    const textDir = isArabic ? 'rtl' : 'ltr';

    DOM.diffOriginalPane.setAttribute('dir', textDir);
    DOM.diffCleanedPane.setAttribute('dir', textDir);

    const diff = fileObj.stats.reduction;
    const pct = fileObj.stats.originalLen > 0 
      ? ((diff / fileObj.stats.originalLen) * 100).toFixed(1) 
      : 0;

    if (state.diffMode === 'highlighted' && typeof DiffHighlighter !== 'undefined') {
      const diffResult = DiffHighlighter.highlight(fileObj.rawText, fileObj.cleanedText);
      DOM.diffOriginalPane.innerHTML = diffResult.originalHtml;
      DOM.diffCleanedPane.innerHTML = diffResult.cleanedHtml;

      DOM.diffCharStats.innerHTML = `
        <span class="badge bg-red-500/10 text-red-500 border border-red-500/20">-${diffResult.stats.removedTokens} محذوف</span>
        <span class="badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">+${diffResult.stats.addedTokens} معالج</span>
        <span class="text-muted-custom">توفير: ${diff.toLocaleString()} حرف (${pct}%)</span>
      `;
    } else {
      // Plain text mode
      DOM.diffOriginalPane.textContent = fileObj.rawText;
      DOM.diffCleanedPane.textContent = fileObj.cleanedText;

      DOM.diffCharStats.innerHTML = `
        <span class="text-muted-custom">الأصل: ${fileObj.stats.originalLen.toLocaleString()} حرف | المعالج: ${fileObj.stats.cleanedLen.toLocaleString()} حرف (تخفيض ${pct}%)</span>
      `;
    }
  }

  function toggleModalDiffMode() {
    state.diffMode = state.diffMode === 'highlighted' ? 'plain' : 'highlighted';
    if (DOM.diffModeText) {
      DOM.diffModeText.textContent = state.diffMode === 'highlighted' ? 'إبراز الفروق' : 'نص خام';
    }
    if (state.activePreviewFileId) {
      renderDiffInModal(state.activePreviewFileId);
    }
  }

  function closeDiffModal() {
    DOM.diffModal.classList.remove('active');
    state.activePreviewFileId = null;
  }

  function copyCleanedTextToClipboard() {
    if (!state.activePreviewFileId) return;
    const fileObj = state.files.find(f => f.id === state.activePreviewFileId);
    if (!fileObj) return;

    navigator.clipboard.writeText(fileObj.cleanedText).then(() => {
      const origHtml = DOM.modalCopyCleanBtn.innerHTML;
      DOM.modalCopyCleanBtn.innerHTML = '<span>✓</span><span>تم النسخ!</span>';
      setTimeout(() => {
        DOM.modalCopyCleanBtn.innerHTML = origHtml;
      }, 2000);
    }).catch(err => {
      alert('تعذر النسخ إلى الحافظة.');
    });
  }

  /**
   * Download Single Cleaned File
   */
  function downloadSingleFile(fileId) {
    const fileObj = state.files.find(f => f.id === fileId);
    if (!fileObj) return;

    let targetName = fileObj.name;
    if (state.appendCleanedSuffix) {
      const stem = fileObj.name.replace(/\.txt$/i, '');
      targetName = `${stem}_cleaned.txt`;
    }

    const blob = new Blob([fileObj.cleanedText], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, targetName);
  }

  /**
   * Download All as ZIP using local JSZip
   */
  async function downloadCleanedZip() {
    if (state.files.length === 0) return;

    if (typeof JSZip === 'undefined') {
      alert('مكتبة JSZip غير محملة.');
      return;
    }

    const origBtnHtml = DOM.downloadZipBtn.innerHTML;
    DOM.downloadZipBtn.disabled = true;
    DOM.downloadZipBtn.innerHTML = '<span>⏳</span><span>جارِ إنشاء الأرشيف...</span>';

    try {
      const zip = new JSZip();
      
      state.files.forEach(fileObj => {
        let fileName = fileObj.name;
        if (state.appendCleanedSuffix) {
          const stem = fileObj.name.replace(/\.txt$/i, '');
          fileName = `${stem}_cleaned.txt`;
        }
        zip.file(fileName, fileObj.cleanedText);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const zipName = `corpus_cleaned_${state.langMode}_${timestamp}.zip`;
      triggerDownload(zipBlob, zipName);
    } catch (err) {
      console.error('Error generating zip:', err);
      alert('حدث خطأ أثناء إنشاء ملف ZIP.');
    } finally {
      DOM.downloadZipBtn.disabled = false;
      DOM.downloadZipBtn.innerHTML = origBtnHtml;
    }
  }

  /**
   * Export Decisions Log CSV
   */
  function exportDecisionsCsv() {
    const isArabic = state.langMode === 'arabic';
    let headers = [];
    let rows = [];

    if (isArabic) {
      headers = ['العنصر / المشكلة', 'القرار المتخذ', 'الحالة', 'سبب القرار'];
      const c = state.arabicConfig;
      rows = [
        ['التشكيل والحركات', c.removeTashkeel ? 'حُذِفَ' : 'أُبقيَ', c.removeTashkeel ? 'مفعل' : 'معطل', 'لتوسيع دائرة البحث وتوحيد صور المشتقات ومطابقة الشواهد غير المشكولة.'],
        ['أشكال الألف (أ، إ، آ، ٱ)', c.normalizeAlef ? 'وُحِدَت إلى (ا)' : 'أُبقيت', c.normalizeAlef ? 'مفعل' : 'معطل', 'لتفادي أخطاء الرسم الإملائي وضمان استرجاع كافة الشواهد.'],
        ['الكشيدة / التطويل (ـ)', c.removeKashida ? 'حُذِفَت' : 'أُبقيت', c.removeKashida ? 'مفعل' : 'معطل', 'تحسين بصري طباعي يعيق التقطيع الآلي والبحث المعجمي.'],
        ['وسوم HTML والماركداون', (c.removeHtml || c.removeMarkdown) ? 'حُذِفَت' : 'أُبقيت', (c.removeHtml || c.removeMarkdown) ? 'مفعل' : 'معطل', 'لتنقية النص من بقايا كود الصفحات والتنسيقات الرقمية.'],
        ['الروابط والبريد (URLs & Emails)', c.removeLinks ? 'حُذِفَت' : 'أُبقيت', c.removeLinks ? 'مفعل' : 'معطل', 'شوائب تقنية ومصدر ضوضاء لا تنتمي للمتن اللغوي.'],
        ['المحارف الغريبة والإيموجي', c.removeStrangeChars ? 'حُذِفَت' : 'أُبقيت', c.removeStrangeChars ? 'مفعل' : 'معطل', 'حذف المسافات الصلبة الخفية وعلامات الاتجاه ومحارف التحكم.'],
        ['الياء والألف المقصورة (ى)', c.normalizeYaa ? 'وُحِدَت إلى (ي)' : 'أُبقيت', c.normalizeYaa ? 'مفعل' : 'معطل', 'لتوحيد صور الكلمات المتأثرة باختلاف الرسم الإملائي.'],
        ['التاء المربوطة (ة)', c.normalizeTaaHaa ? 'حُوِّلَت إلى (ه)' : 'أُبقِيَت (لم تُطبَّع)', c.normalizeTaaHaa ? 'مفعل' : 'معطل', 'للحفاظ على الفرق الصرفي بين تاء التأنيث وهاء الضمير.'],
        ['الهمزة المتوسطة (ؤ، ئ)', c.normalizeHamza ? 'حُوِّلَت إلى (و، ي)' : 'أُبقِيَت (لم تُطبَّع)', c.normalizeHamza ? 'مفعل' : 'معطل', 'للحفاظ على المعنى المعجمي الدقيق لألفاظ المدونة.'],
        ['علامات الترقيم', c.removePunctuation ? 'حُذِفَت' : 'أُبقيت', c.removePunctuation ? 'مفعل' : 'معطل', 'بحسب رغبة الباحث في دراسة علامات الوقف أو إزالتها.'],
        ['الأرقام (0-9 و ٠-٩)', c.removeNumbers ? 'حُذِفَت' : 'أُبقيت', c.removeNumbers ? 'مفعل' : 'معطل', 'لتنقية المتن اللغوي من الأعداد والإحصائيات.'],
        ['المسافات والأسطر الفارغة', c.removeExtraSpaces ? 'نُظِّفَت واختُزِلَت' : 'أُبقيت', c.removeExtraSpaces ? 'مفعل' : 'معطل', 'لضمان دقة التقطيع الآلي بالمسافات والحفاظ على بنية الفقرات واضحة.']
      ];
    } else {
      headers = ['Feature / Element', 'Decision', 'Status', 'Linguistic / Technical Rationale'];
      const c = state.englishConfig;
      rows = [
        ['Text Lowercasing', c.toLowerCase ? 'Lowercased' : 'Preserved', c.toLowerCase ? 'Active' : 'Disabled', 'Unifies word casing for vocabulary indexing and search.'],
        ['Contraction Expansion', c.expandContractions ? 'Expanded (e.g. don\'t -> do not)' : 'Preserved', c.expandContractions ? 'Active' : 'Disabled', 'Disambiguates syntactic verbs and negation markers.'],
        ['Accent Normalization', c.removeAccents ? 'Stripped (e.g. café -> cafe)' : 'Preserved', c.removeAccents ? 'Active' : 'Disabled', 'Normalizes Latin diacritics to pure ASCII.'],
        ['HTML & Markdown Tags', (c.removeHtml || c.removeMarkdown) ? 'Removed' : 'Preserved', (c.removeHtml || c.removeMarkdown) ? 'Active' : 'Disabled', 'Cleans document formatting and page markup noise.'],
        ['URLs & Email Addresses', (c.removeLinks || c.removeEmails) ? 'Removed' : 'Preserved', (c.removeLinks || c.removeEmails) ? 'Active' : 'Disabled', 'Removes external web references and metadata.'],
        ['Punctuation Marks', c.removePunctuation ? 'Removed' : 'Preserved', c.removePunctuation ? 'Active' : 'Disabled', 'Strips punctuation symbols based on research requirements.'],
        ['Numbers / Digits', c.removeNumbers ? 'Removed' : 'Preserved', c.removeNumbers ? 'Active' : 'Disabled', 'Filters out numerical data from text body.'],
        ['Emojis & Strange Characters', c.removeStrangeChars ? 'Removed' : 'Preserved', c.removeStrangeChars ? 'Active' : 'Disabled', 'Eliminates control characters and pictographic symbols.'],
        ['Spaces & Blank Lines', (c.removeExtraSpaces || c.removeExtraLines) ? 'Normalized' : 'Preserved', (c.removeExtraSpaces || c.removeExtraLines) ? 'Active' : 'Disabled', 'Ensures clean tokenization and compact layout.']
      ];
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel support
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `decisions_log_${state.langMode}_${timestamp}.csv`);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

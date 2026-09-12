/**
 * Arabic Corpus Preprocessor & Cleaner - Web Application Controller
 * =================================================================
 * Manages UI interactions, batch file processing, live diff modal,
 * in-browser JSZip archiving, and CSV decision log export.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    files: [], // Array of { id, name, size, rawText, cleanedText, stats }
    config: {
      removeHtml: true,
      removeMarkdown: true,
      removeLinks: true,
      removeKashida: true,
      removeTashkeel: true,
      normalizeHamza: false,
      normalizeAlef: true,
      normalizeTaaHaa: false,
      normalizeYaa: true,
      removeStrangeChars: true,
      removeExtraSpaces: true,
      removeExtraLines: true,
      removeAllEmptyLines: false,
      appendCleanedSuffix: true
    },
    activePreset: 'linguistics',
    activePreviewFileId: null,
    isProcessing: false
  };

  // Presets Definition
  const PRESETS = {
    comprehensive: {
      name: 'تنظيف شامل (All Options)',
      config: {
        removeHtml: true,
        removeMarkdown: true,
        removeLinks: true,
        removeKashida: true,
        removeTashkeel: true,
        normalizeHamza: true,
        normalizeAlef: true,
        normalizeTaaHaa: true,
        normalizeYaa: true,
        removeStrangeChars: true,
        removeExtraSpaces: true,
        removeExtraLines: true,
        removeAllEmptyLines: false
      }
    },
    ir_search: {
      name: 'استرجاع المعلومات والبحث (IR & Search)',
      config: {
        removeHtml: true,
        removeMarkdown: true,
        removeLinks: true,
        removeKashida: true,
        removeTashkeel: true,
        normalizeHamza: true,
        normalizeAlef: true,
        normalizeTaaHaa: false,
        normalizeYaa: true,
        removeStrangeChars: true,
        removeExtraSpaces: true,
        removeExtraLines: true,
        removeAllEmptyLines: false
      }
    },
    linguistics: {
      name: 'تحليل نحوي ودلالي (حاسوبويه / دراسة السياق)',
      config: {
        removeHtml: true,
        removeMarkdown: true,
        removeLinks: true,
        removeKashida: true,
        removeTashkeel: true,
        normalizeHamza: false,
        normalizeAlef: true,
        normalizeTaaHaa: false, // يحافظ على التاء المربوطة لمنع التباسها بهاء الغائب
        normalizeYaa: true,
        removeStrangeChars: true,
        removeExtraSpaces: true,
        removeExtraLines: true,
        removeAllEmptyLines: false
      }
    },
    light: {
      name: 'تنظيف خفيف (Light Cleanup)',
      config: {
        removeHtml: false,
        removeMarkdown: false,
        removeLinks: false,
        removeKashida: true,
        removeTashkeel: false,
        normalizeHamza: false,
        normalizeAlef: false,
        normalizeTaaHaa: false,
        normalizeYaa: false,
        removeStrangeChars: true,
        removeExtraSpaces: true,
        removeExtraLines: true,
        removeAllEmptyLines: false
      }
    }
  };

  // DOM Elements
  const DOM = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),
    filesSection: document.getElementById('filesSection'),
    filesTableBody: document.getElementById('filesTableBody'),
    emptyState: document.getElementById('emptyState'),
    
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
    appendSuffixCheckbox: document.getElementById('appendSuffixCheckbox'),
    
    // Modal
    diffModal: document.getElementById('diffModal'),
    modalFileName: document.getElementById('modalFileName'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCopyCleanBtn: document.getElementById('modalCopyCleanBtn'),
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
    applyPreset('linguistics');
  }

  /**
   * Setup Theme (Dark/Light)
   */
  function setupTheme() {
    const savedTheme = localStorage.getItem('arabic_cleaner_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('arabic_cleaner_theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    if (!DOM.themeToggleBtn) return;
    DOM.themeToggleBtn.innerHTML = theme === 'dark' 
      ? '☀️ <span class="hidden sm:inline">الوضع الفاتح</span>'
      : '🌙 <span class="hidden sm:inline">الوضع الداكن</span>';
  }

  /**
   * Event Listeners
   */
  function setupEventListeners() {
    // Theme toggle
    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener('click', toggleTheme);
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

    // Suffix Checkbox
    if (DOM.appendSuffixCheckbox) {
      DOM.appendSuffixCheckbox.checked = state.config.appendCleanedSuffix;
      DOM.appendSuffixCheckbox.addEventListener('change', e => {
        state.config.appendCleanedSuffix = e.target.checked;
      });
    }

    // Preset Buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-preset');
        applyPreset(presetKey);
      });
    });

    // Option Toggle Cards
    document.querySelectorAll('.toggle-card').forEach(card => {
      const optionKey = card.getAttribute('data-option');
      const checkbox = card.querySelector('.toggle-checkbox');

      card.addEventListener('click', e => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        state.config[optionKey] = checkbox.checked;
        card.classList.toggle('active', checkbox.checked);
        state.activePreset = 'custom';
        updatePresetButtonsUI('custom');
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
  }

  /**
   * Apply Preset
   */
  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    state.activePreset = presetKey;
    Object.assign(state.config, preset.config);

    // Update UI checkboxes
    document.querySelectorAll('.toggle-card').forEach(card => {
      const optionKey = card.getAttribute('data-option');
      const checkbox = card.querySelector('.toggle-checkbox');
      if (optionKey in state.config) {
        checkbox.checked = state.config[optionKey];
        card.classList.toggle('active', checkbox.checked);
      }
    });

    updatePresetButtonsUI(presetKey);
    reprocessAllFiles();
  }

  function updatePresetButtonsUI(activeKey) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      const key = btn.getAttribute('data-preset');
      btn.classList.toggle('active', key === activeKey);
    });
  }

  /**
   * Handle File Drag & Drop
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

    // Process files asynchronously
    for (const file of filesArray) {
      // Avoid duplicate names if already exists, or update
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

    state.files.forEach(fileObj => {
      fileObj.cleanedText = ArabicPreprocessor.process(fileObj.rawText, state.config);
      fileObj.stats.originalLen = fileObj.rawText.length;
      fileObj.stats.cleanedLen = fileObj.cleanedText.length;
      fileObj.stats.reduction = fileObj.stats.originalLen - fileObj.stats.cleanedLen;

      totalOriginalChars += fileObj.stats.originalLen;
      totalCleanedChars += fileObj.stats.cleanedLen;
    });

    const elapsed = performance.now() - t0;
    updateUI(elapsed, totalOriginalChars, totalCleanedChars);
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

    // Update KPIs
    const diffChars = totalOriginal - totalCleaned;
    const reductionPct = totalOriginal > 0 ? ((diffChars / totalOriginal) * 100).toFixed(2) : 0;

    DOM.kpiFilesCount.textContent = state.files.length.toLocaleString('ar-EG');
    DOM.kpiCharsBefore.textContent = totalOriginal.toLocaleString('en-US');
    DOM.kpiCharsAfter.textContent = totalCleaned.toLocaleString('en-US');
    DOM.kpiReductionPct.textContent = `${reductionPct}%`;
    DOM.kpiProcessTime.textContent = `${Math.round(elapsedMs)} ms`;

    // Render Table Rows
    renderFilesTable();
  }

  function renderFilesTable() {
    if (!DOM.filesTableBody) return;
    DOM.filesTableBody.innerHTML = '';

    state.files.forEach((fileObj, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-800 hover:bg-gray-800/40 transition';

      const diff = fileObj.stats.reduction;
      const pct = fileObj.stats.originalLen > 0 
        ? ((diff / fileObj.stats.originalLen) * 100).toFixed(1) 
        : 0;

      tr.innerHTML = `
        <td class="p-3 text-sm text-gray-400 font-mono">${idx + 1}</td>
        <td class="p-3 text-sm font-medium text-gray-200">
          <div class="flex items-center gap-2">
            <span>📄</span>
            <span class="truncate max-w-xs md:max-w-md" title="${fileObj.name}">${escapeHtml(fileObj.name)}</span>
          </div>
        </td>
        <td class="p-3 text-xs text-gray-400 font-mono" dir="ltr">${fileObj.stats.originalLen.toLocaleString()} chars</td>
        <td class="p-3 text-xs text-emerald-400 font-mono" dir="ltr">${fileObj.stats.cleanedLen.toLocaleString()} chars</td>
        <td class="p-3">
          <span class="badge ${diff > 0 ? 'badge-diff-change' : 'badge-privacy'}">
            ${diff > 0 ? `-${diff} (${pct}%)` : 'مطابق'}
          </span>
        </td>
        <td class="p-3 text-left">
          <div class="flex items-center justify-end gap-2">
            <button class="btn-secondary text-xs px-2.5 py-1.5 preview-btn" data-id="${fileObj.id}">
              👁️ معاينة الفروق
            </button>
            <button class="btn-secondary text-xs px-2.5 py-1.5 download-single-btn" data-id="${fileObj.id}">
              ⬇️ تنزيل
            </button>
            <button class="text-gray-500 hover:text-red-400 p-1 delete-single-btn" data-id="${fileObj.id}" title="حذف الملف">
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
  }

  /**
   * Delete Single File
   */
  function deleteSingleFile(fileId) {
    state.files = state.files.filter(f => f.id !== fileId);
    reprocessAllFiles();
  }

  /**
   * Clear All Files
   */
  function clearAllFiles() {
    if (state.files.length === 0) return;
    if (confirm('هل أنت متأكد من مسح جميع الملفات المرفوعة؟')) {
      state.files = [];
      if (DOM.fileInput) DOM.fileInput.value = '';
      if (DOM.folderInput) DOM.folderInput.value = '';
      reprocessAllFiles();
    }
  }

  /**
   * Open Side-by-Side Diff Modal
   */
  function openDiffModal(fileId) {
    const fileObj = state.files.find(f => f.id === fileId);
    if (!fileObj) return;

    state.activePreviewFileId = fileId;
    DOM.modalFileName.textContent = fileObj.name;
    
    // Display snippets (up to first 10,000 characters for instant rendering)
    DOM.diffOriginalPane.textContent = fileObj.rawText;
    DOM.diffCleanedPane.textContent = fileObj.cleanedText;

    const diff = fileObj.stats.reduction;
    DOM.diffCharStats.textContent = `الأصل: ${fileObj.stats.originalLen.toLocaleString()} حرف | بعد المعالجة: ${fileObj.stats.cleanedLen.toLocaleString()} حرف (وفر ${diff.toLocaleString()} حرف)`;

    DOM.diffModal.classList.add('active');
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
      const origText = DOM.modalCopyCleanBtn.innerHTML;
      DOM.modalCopyCleanBtn.innerHTML = '✓ تم النسخ بنجاح!';
      setTimeout(() => {
        DOM.modalCopyCleanBtn.innerHTML = origText;
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
    if (state.config.appendCleanedSuffix) {
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

    const origBtnText = DOM.downloadZipBtn.innerHTML;
    DOM.downloadZipBtn.disabled = true;
    DOM.downloadZipBtn.innerHTML = '⏳ جارِ إنشاء الملف المضغوط...';

    try {
      const zip = new JSZip();
      
      state.files.forEach(fileObj => {
        let fileName = fileObj.name;
        if (state.config.appendCleanedSuffix) {
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
      const zipName = `arabic_corpus_cleaned_${timestamp}.zip`;
      triggerDownload(zipBlob, zipName);
    } catch (err) {
      console.error('Error generating zip:', err);
      alert('حدث خطأ أثناء إنشاء ملف ZIP.');
    } finally {
      DOM.downloadZipBtn.disabled = false;
      DOM.downloadZipBtn.innerHTML = origBtnText;
    }
  }

  /**
   * Export Decisions Log CSV
   */
  function exportDecisionsCsv() {
    const headers = ['العنصر/المشكلة', 'القرار المتخذ', 'الحالة', 'سبب القرار'];
    const rows = [
      ['التشكيل والحركات', state.config.removeTashkeel ? 'حُذِفَ' : 'أُبقيَ', state.config.removeTashkeel ? 'مفعل' : 'معطل', 'لتوسيع دائرة البحث وتوحيد صور المشتقات ومطابقة الشواهد غير المشكولة.'],
      ['أشكال الألف (أ، إ، آ، ٱ)', state.config.normalizeAlef ? 'وُحِدَت إلى (ا)' : 'أُبقيت', state.config.normalizeAlef ? 'مفعل' : 'معطل', 'لتفادي أخطاء الرسم الإملائي في همزة الوصل والقطع وضمان استرجاع كافة الشواهد.'],
      ['الكشيدة / التطويل (ـ)', state.config.removeKashida ? 'حُذِفَت' : 'أُبقيت', state.config.removeKashida ? 'مفعل' : 'معطل', 'تحسين بصري طباعي يعيق التقطيع الآلي والبحث المعجمي.'],
      ['وسوم HTML والماركداون', (state.config.removeHtml || state.config.removeMarkdown) ? 'حُذِفَت' : 'أُبقيت', (state.config.removeHtml || state.config.removeMarkdown) ? 'مفعل' : 'معطل', 'لتنقية النص من بقايا كود الصفحات والتنسيقات الرقمية.'],
      ['الروابط والمواقع (URLs)', state.config.removeLinks ? 'حُذِفَت' : 'أُبقيت', state.config.removeLinks ? 'مفعل' : 'معطل', 'شوائب تقنية ومصدر ضوضاء لا تنتمي للمتن اللغوي العربي.'],
      ['المحارف الغريبة والإيموجي', state.config.removeStrangeChars ? 'حُذِفَت' : 'أُبقيت', state.config.removeStrangeChars ? 'مفعل' : 'معطل', 'حذف المسافات الصلبة الخفية وعلامات الاتجاه ومحارف التحكم.'],
      ['الياء والألف المقصورة (ى)', state.config.normalizeYaa ? 'وُحِدَت إلى (ي)' : 'أُبقيت', state.config.normalizeYaa ? 'مفعل' : 'معطل', 'لتوحيد صور حروف الجر وأطراف الاستبدال المتأثرة باختلاف الرسم.'],
      ['التاء المربوطة (ة)', state.config.normalizeTaaHaa ? 'حُوِّلَت إلى (ه)' : 'أُبقِيَت (لم تُطبَّع)', state.config.normalizeTaaHaa ? 'مفعل' : 'معطل', 'للحفاظ على الفرق الصرفي بين تاء التأنيث وضمير الغائب المتصل (استبدله).'],
      ['الهمزة المتوسطة (ؤ، ئ)', state.config.normalizeHamza ? 'حُوِّلَت إلى (و، ي)' : 'أُبقِيَت (لم تُطبَّع)', state.config.normalizeHamza ? 'مفعل' : 'معطل', 'للحفاظ على المعنى المعجمي الدقيق لأطراف الاستبدال ومفردات النص.'],
      ['المسافات والأسطر الفارغة', state.config.removeExtraSpaces ? 'نُظِّفَت واختُزِلَت' : 'أُبقيت', state.config.removeExtraSpaces ? 'مفعل' : 'معطل', 'لضمان دقة التقطيع الآلي بالمسافات والحفاظ على بنية الفقرات واضحة.']
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `decisions_log_${timestamp}.csv`);
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

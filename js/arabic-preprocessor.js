/**
 * Arabic Corpus Preprocessor & Cleaner
 * Core NLP Preprocessing Engine (JavaScript / Client-Side)
 * =======================================================
 * Pure client-side regex transformation engine with full Unicode support.
 * 100% offline, privacy-first, zero server communication.
 */

(function (global) {
  'use strict';

  class ArabicPreprocessor {
    // Regular expression patterns
    static RE_URL = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;
    static RE_HTML_COMMENTS = /<!--[\s\S]*?-->/g;
    static RE_HTML_TAGS = /<[^<]+?>/g;
    static RE_HTML_ENTITIES = /&[a-zA-Z0-9#]+;/g;

    static RE_MD_IMAGES = /!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g;
    static RE_MD_LINKS = /\[([^\]]+)\](?:\([^)]*\)|\[[^\]]*\])/g;
    static RE_MD_CODE_BLOCKS = /```[^\n]*\n([\s\S]*?)```/g;
    static RE_MD_INLINE_CODE = /`([^`]+)`/g;
    static RE_MD_HEADERS = /^\s*#{1,6}\s*(.*?)\s*$/gm;
    static RE_MD_BLOCKQUOTES = /^\s*>\s*(.*?)\s*$/gm;
    static RE_MD_HORIZONTAL_RULES = /^\s*(?:[-*_]\s*){3,}\s*$/gm;
    static RE_MD_TABLE_DIVIDER = /^\s*\|?[-:| ]+\|?\s*$/gm;
    static RE_MD_LIST_BULLETS = /^\s*(?:[-*+]|\d+\.)\s+/gm;
    static RE_MD_BOLD_ITALIC = /(\*\*|__|\*|_|~~)(.*?)\1/g;

    static RE_KASHIDA = /[\u0640]/g;
    static RE_TASHKEEL = /[\u0610-\u061A\u064B-\u065E\u0670\u06D6-\u06ED]/g;

    static RE_ALEF_VARIANTS = /[أإآٱ]/g;
    static RE_HAMZA_SEATED_WAW = /ؤ/g;
    static RE_HAMZA_SEATED_YAA = /ئ/g;
    static RE_TAA_MARBUTA = /[ة\u06C0-\u06C3]/g;
    static RE_ALEF_MAQSURA = /[ى\u06CC]/g;

    static RE_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
    static RE_FORMAT_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD\uFFFD]/g;
    static RE_EMOJIS_SYMBOLS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{2500}-\u{25FF}]/gu;

    static RE_HORIZONTAL_SPACES = /[^\S\r\n]+/g;
    static RE_CONSECUTIVE_BLANK_LINES = /\n\s*\n+/g;

    /**
     * Decode HTML entities safely without DOM insertion
     */
    static unescapeHtml(text) {
      const entityMap = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&laquo;': '«',
        '&raquo;': '»',
        '&ndash;': '–',
        '&mdash;': '—',
        '&hellip;': '…'
      };
      return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|laquo|raquo|ndash|mdash|hellip);/g, match => entityMap[match] || ' ')
                 .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
                 .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    static removeHtml(text) {
      text = text.replace(this.RE_HTML_COMMENTS, '');
      text = text.replace(this.RE_HTML_TAGS, '');
      text = this.unescapeHtml(text);
      text = text.replace(this.RE_HTML_ENTITIES, ' ');
      return text;
    }

    static removeMarkdown(text) {
      text = text.replace(this.RE_MD_IMAGES, '');
      text = text.replace(this.RE_MD_LINKS, '$1');
      text = text.replace(this.RE_MD_CODE_BLOCKS, '$1');
      text = text.replace(this.RE_MD_INLINE_CODE, '$1');
      text = text.replace(this.RE_MD_HEADERS, '$1');
      text = text.replace(this.RE_MD_BLOCKQUOTES, '$1');
      text = text.replace(this.RE_MD_HORIZONTAL_RULES, '');
      text = text.replace(this.RE_MD_TABLE_DIVIDER, '');
      text = text.replace(this.RE_MD_LIST_BULLETS, '');

      // Repeatedly strip bold/italic wrappers
      for (let i = 0; i < 3; i++) {
        const next = text.replace(this.RE_MD_BOLD_ITALIC, '$2');
        if (next === text) break;
        text = next;
      }
      return text;
    }

    static removeLinks(text) {
      return text.replace(this.RE_URL, '');
    }

    static removeKashida(text) {
      return text.replace(this.RE_KASHIDA, '');
    }

    static removeTashkeel(text) {
      return text.replace(this.RE_TASHKEEL, '');
    }

    static normalizeHamza(text) {
      return text.replace(this.RE_HAMZA_SEATED_WAW, 'و')
                 .replace(this.RE_HAMZA_SEATED_YAA, 'ي');
    }

    static normalizeAlef(text) {
      return text.replace(this.RE_ALEF_VARIANTS, 'ا');
    }

    static normalizeTaaHaa(text) {
      return text.replace(this.RE_TAA_MARBUTA, 'ه');
    }

    static normalizeYaa(text) {
      return text.replace(this.RE_ALEF_MAQSURA, 'ي');
    }

    static removeStrangeChars(text) {
      text = text.replace(this.RE_CONTROL_CHARS, '');
      text = text.replace(this.RE_FORMAT_MARKS, '');
      text = text.replace(this.RE_EMOJIS_SYMBOLS, '');
      return text;
    }

    static removeExtraSpaces(text) {
      text = text.replace(/\u00A0/g, ' ');
      const lines = text.split(/\r?\n/).map(line => {
        return line.replace(this.RE_HORIZONTAL_SPACES, ' ').trim();
      });
      return lines.join('\n');
    }

    static removeExtraLines(text, removeAll = false) {
      if (removeAll) {
        return text.split(/\r?\n/)
                   .map(l => l.trim())
                   .filter(l => l.length > 0)
                   .join('\n');
      }
      text = text.replace(this.RE_CONSECUTIVE_BLANK_LINES, '\n\n');
      return text.replace(/^\n+|\n+$/g, '');
    }

    /**
     * Executes the complete cleaning pipeline according to configuration
     * @param {string} text - Raw input string
     * @param {Object} config - Configuration options
     * @returns {string} Cleaned output string
     */
    static process(text, config = {}) {
      if (!text || typeof text !== 'string') return '';

      // Normalize Unicode NFC canonical representation
      text = text.normalize('NFC');

      if (config.removeHtml) {
        text = this.removeHtml(text);
      }

      if (config.removeMarkdown) {
        text = this.removeMarkdown(text);
      }

      if (config.removeLinks) {
        text = this.removeLinks(text);
      }

      if (config.removeKashida) {
        text = this.removeKashida(text);
      }

      if (config.removeTashkeel) {
        text = this.removeTashkeel(text);
      }

      if (config.normalizeHamza) {
        text = this.normalizeHamza(text);
      }

      if (config.normalizeAlef) {
        text = this.normalizeAlef(text);
      }

      if (config.normalizeTaaHaa) {
        text = this.normalizeTaaHaa(text);
      }

      if (config.normalizeYaa) {
        text = this.normalizeYaa(text);
      }

      if (config.removeStrangeChars) {
        text = this.removeStrangeChars(text);
      }

      if (config.removeExtraSpaces) {
        text = this.removeExtraSpaces(text);
      }

      if (config.removeExtraLines || config.removeAllEmptyLines) {
        text = this.removeExtraLines(text, !!config.removeAllEmptyLines);
      }

      return text;
    }
  }

  // Export to global scope
  global.ArabicPreprocessor = ArabicPreprocessor;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArabicPreprocessor;
  }
})(typeof window !== 'undefined' ? window : globalThis);

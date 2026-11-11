/**
 * English Corpus Preprocessor & Cleaner
 * Core NLP Preprocessing Engine for English Text (Client-Side)
 * =============================================================
 * Pure client-side regex and string transformation pipeline.
 * 100% offline, privacy-first, zero server communication.
 */

(function (global) {
  'use strict';

  class EnglishPreprocessor {
    static RE_URL = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;
    static RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
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

    static RE_NUMBERS = /\b\d+(?:[.,]\d+)*\b|\d+/g;
    static RE_PUNCTUATION = /[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~–—«»“”‘’]/g;

    static RE_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
    static RE_FORMAT_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD\uFFFD]/g;
    static RE_EMOJIS_SYMBOLS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{2500}-\u{25FF}]/gu;

    static RE_HORIZONTAL_SPACES = /[^\S\r\n]+/g;
    static RE_CONSECUTIVE_BLANK_LINES = /\n\s*\n+/g;

    // English Contractions Map
    static CONTRACTIONS = [
      [/\b(can)['’]t\b/gi, 'cannot'],
      [/\b(won)['’]t\b/gi, 'will not'],
      [/\b(shan)['’]t\b/gi, 'shall not'],
      [/\b(ain)['’]t\b/gi, 'is not'],
      [/\b(let)['’]s\b/gi, 'let us'],
      [/\b([a-z]+)n['’]t\b/gi, '$1 not'],
      [/\b([a-z]+)['’]re\b/gi, '$1 are'],
      [/\b([a-z]+)['’]ve\b/gi, '$1 have'],
      [/\b([a-z]+)['’]ll\b/gi, '$1 will'],
      [/\b([a-z]+)['’]d\b/gi, '$1 would'],
      [/\b(i)['’]m\b/gi, 'I am'],
      [/\b(it)['’]s\b/gi, 'it is'],
      [/\b(that)['’]s\b/gi, 'that is'],
      [/\b(what)['’]s\b/gi, 'what is'],
      [/\b(there)['’]s\b/gi, 'there is'],
      [/\b(here)['’]s\b/gi, 'here is'],
      [/\b(how)['’]s\b/gi, 'how is'],
      [/\b(who)['’]s\b/gi, 'who is'],
      [/\b(where)['’]s\b/gi, 'where is']
    ];

    static unescapeHtml(text) {
      const entityMap = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&ndash;': '–',
        '&mdash;': '—',
        '&hellip;': '…'
      };
      return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|hellip);/g, match => entityMap[match] || ' ')
                 .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
                 .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    static toLowerCase(text) {
      return text.toLowerCase();
    }

    static expandContractions(text) {
      let result = text;
      for (const [regex, replacement] of this.CONTRACTIONS) {
        result = result.replace(regex, replacement);
      }
      return result;
    }

    static removeAccents(text) {
      // Normalizes Unicode combining diacritical marks (e.g., é -> e, ü -> u, ñ -> n)
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

    static removeEmails(text) {
      return text.replace(this.RE_EMAIL, '');
    }

    static removePunctuation(text) {
      return text.replace(this.RE_PUNCTUATION, ' ');
    }

    static removeNumbers(text) {
      return text.replace(this.RE_NUMBERS, '');
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
     * Executes the complete English cleaning pipeline according to configuration
     * @param {string} text - Raw input string
     * @param {Object} config - Configuration options
     * @returns {string} Cleaned output string
     */
    static process(text, config = {}) {
      if (!text || typeof text !== 'string') return '';

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

      if (config.removeEmails) {
        text = this.removeEmails(text);
      }

      if (config.expandContractions) {
        text = this.expandContractions(text);
      }

      if (config.removeAccents) {
        text = this.removeAccents(text);
      }

      if (config.toLowerCase) {
        text = this.toLowerCase(text);
      }

      if (config.removeNumbers) {
        text = this.removeNumbers(text);
      }

      if (config.removePunctuation) {
        text = this.removePunctuation(text);
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
  global.EnglishPreprocessor = EnglishPreprocessor;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnglishPreprocessor;
  }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * DiffHighlighter - Fast Token-based Visual Diff Highlighter
 * ===========================================================
 * Compares original and cleaned corpus texts, highlighting deleted,
 * added, and modified tokens in real time.
 */

(function (global) {
  'use strict';

  class DiffHighlighter {
    static escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m]);
    }

    /**
     * Tokenize text into words, punctuation, URLs, and whitespace
     */
    static tokenize(text) {
      if (!text) return [];
      const tokenRegex = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]+|\s+|[^\s\p{P}]+|[\p{P}]/gu;
      return text.match(tokenRegex) || [];
    }

    /**
     * Compute Longest Common Subsequence indices for token arrays
     */
    static computeLCS(tokens1, tokens2) {
      const n = tokens1.length;
      const m = tokens2.length;

      // 1. Prefix trim
      let start = 0;
      while (start < n && start < m && tokens1[start] === tokens2[start]) {
        start++;
      }

      // 2. Suffix trim
      let end1 = n - 1;
      let end2 = m - 1;
      while (end1 >= start && end2 >= start && tokens1[end1] === tokens2[end2]) {
        end1--;
        end2--;
      }

      const mid1 = tokens1.slice(start, end1 + 1);
      const mid2 = tokens2.slice(start, end2 + 1);

      const commonInMid = [];
      if (mid1.length > 0 && mid2.length > 0) {
        // If mid is too large (> 1,200,000 product), use fast greedy indexing
        if (mid1.length * mid2.length > 1200000) {
          const map2 = new Map();
          for (let j = 0; j < mid2.length; j++) {
            const tok = mid2[j];
            if (!map2.has(tok)) map2.set(tok, []);
            map2.get(tok).push(j);
          }
          let lastJ = -1;
          for (let i = 0; i < mid1.length; i++) {
            const matches = map2.get(mid1[i]);
            if (matches) {
              const nextJ = matches.find(idx => idx > lastJ);
              if (nextJ !== undefined) {
                commonInMid.push({ i: start + i, j: start + nextJ });
                lastJ = nextJ;
              }
            }
          }
        } else {
          // Dynamic programming LCS
          const dp = Array.from({ length: mid1.length + 1 }, () => new Uint16Array(mid2.length + 1));
          for (let i = 1; i <= mid1.length; i++) {
            const t1 = mid1[i - 1];
            for (let j = 1; j <= mid2.length; j++) {
              if (t1 === mid2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
              } else {
                dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
              }
            }
          }

          let i = mid1.length;
          let j = mid2.length;
          while (i > 0 && j > 0) {
            if (mid1[i - 1] === mid2[j - 1]) {
              commonInMid.unshift({ i: start + i - 1, j: start + j - 1 });
              i--;
              j--;
            } else if (dp[i - 1][j] >= dp[i][j - 1]) {
              i--;
            } else {
              j--;
            }
          }
        }
      }

      // Build full match sets
      const matchMap1 = new Set();
      const matchMap2 = new Set();

      for (let k = 0; k < start; k++) {
        matchMap1.add(k);
        matchMap2.add(k);
      }
      for (const pair of commonInMid) {
        matchMap1.add(pair.i);
        matchMap2.add(pair.j);
      }
      const suffixLen = n - 1 - end1;
      for (let k = 0; k < suffixLen; k++) {
        matchMap1.add(end1 + 1 + k);
        matchMap2.add(end2 + 1 + k);
      }

      return { matchMap1, matchMap2 };
    }

    /**
     * Generate highlighted HTML for original and cleaned text side-by-side
     */
    static highlight(originalText, cleanedText) {
      if (!originalText && !cleanedText) {
        return {
          originalHtml: '',
          cleanedHtml: '',
          stats: { removedTokens: 0, addedTokens: 0, unchangedTokens: 0, identical: true }
        };
      }

      if (originalText === cleanedText) {
        const escaped = this.escapeHtml(originalText);
        return {
          originalHtml: escaped,
          cleanedHtml: escaped,
          stats: { removedTokens: 0, addedTokens: 0, unchangedTokens: 1, identical: true }
        };
      }

      const tokens1 = this.tokenize(originalText);
      const tokens2 = this.tokenize(cleanedText);

      const { matchMap1, matchMap2 } = this.computeLCS(tokens1, tokens2);

      let originalHtml = '';
      let cleanedHtml = '';
      let removedTokens = 0;
      let addedTokens = 0;
      let unchangedTokens = 0;

      // Build Original HTML (Removed highlighted in soft red)
      for (let i = 0; i < tokens1.length; i++) {
        const token = tokens1[i];
        const isMatch = matchMap1.has(i);
        const escaped = this.escapeHtml(token);

        if (isMatch) {
          originalHtml += escaped;
          unchangedTokens++;
        } else {
          if (/^\s+$/.test(token)) {
            originalHtml += escaped;
          } else {
            originalHtml += `<mark class="diff-removed" title="حُذِف">${escaped}</mark>`;
            removedTokens++;
          }
        }
      }

      // Build Cleaned HTML (Added/modified highlighted in soft emerald green)
      for (let j = 0; j < tokens2.length; j++) {
        const token = tokens2[j];
        const isMatch = matchMap2.has(j);
        const escaped = this.escapeHtml(token);

        if (isMatch) {
          cleanedHtml += escaped;
        } else {
          if (/^\s+$/.test(token)) {
            cleanedHtml += escaped;
          } else {
            cleanedHtml += `<mark class="diff-added" title="أُضِيف أو عُولِج">${escaped}</mark>`;
            addedTokens++;
          }
        }
      }

      return {
        originalHtml,
        cleanedHtml,
        stats: {
          removedTokens,
          addedTokens,
          unchangedTokens,
          identical: false
        }
      };
    }
  }

  // Export to global scope
  global.DiffHighlighter = DiffHighlighter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiffHighlighter;
  }
})(typeof window !== 'undefined' ? window : globalThis);

// parse.js — a small, dependency-free Markdown to HTML converter.
// Written from scratch; targets the output of marked 18.x with default options
// (gfm: true, breaks: false, pedantic: false, xhtml: false).
//
// Exports: parse(markdown) -> html string

/* ------------------------------------------------------------------ *
 * escaping helpers
 * ------------------------------------------------------------------ */

function escText(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 38 /* & */) {
      const rest = s.slice(i);
      if (/^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{0,31});/.test(rest)) {
        out += '&';
      } else {
        out += '&amp;';
      }
      i++;
    } else if (c === 60) { out += '&lt;'; i++; }
    else if (c === 62) { out += '&gt;'; i++; }
    else if (c === 34) { out += '&quot;'; i++; }
    else if (c === 39) { out += '&#39;'; i++; }
    else { out += s[i]; i++; }
  }
  return out;
}

function escAll(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) out += '&amp;';
    else if (c === 60) out += '&lt;';
    else if (c === 62) out += '&gt;';
    else if (c === 34) out += '&quot;';
    else if (c === 39) out += '&#39;';
    else out += s[i];
  }
  return out;
}

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', laquo: '\u00ab', raquo: '\u00bb',
  ouml: '\u00f6', auml: '\u00e4', uuml: '\u00fc', szlig: '\u00df',
  Auml: '\u00c4', Ouml: '\u00d6', Uuml: '\u00dc', AElig: '\u00c6',
  aelig: '\u00e6', oslash: '\u00f8', aring: '\u00e5', times: '\u00d7',
  divide: '\u00f7', plusmn: '\u00b1', deg: '\u00b0', micro: '\u00b5',
  para: '\u00b6', sect: '\u00a7', middot: '\u00b7', frac12: '\u00bd',
  frac14: '\u00bc', frac34: '\u00be', sup2: '\u00b2', sup3: '\u00b3',
  alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4',
  pi: '\u03c0', sigma: '\u03c3', omega: '\u03c9', Omega: '\u03a9',
  Delta: '\u0394', Sigma: '\u03a3', infin: '\u221e', ne: '\u2260',
  le: '\u2264', ge: '\u2265', larr: '\u2190', rarr: '\u2192',
  uarr: '\u2191', darr: '\u2193', harr: '\u2194', spades: '\u2660',
  clubs: '\u2663', hearts: '\u2665', diams: '\u2666', star: '\u2606',
  check: '\u2713', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  zwnj: '\u200c', zwj: '\u200d', shy: '\u00ad', dagger: '\u2020',
  Dagger: '\u2021', bull: '\u2022', prime: '\u2032', Prime: '\u2033',
  permil: '\u2030', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5',
  cent: '\u00a2', curren: '\u00a4', brvbar: '\u00a6', uml: '\u00a8',
  ordf: '\u00aa', ordm: '\u00ba', not: '\u00ac', macr: '\u00af',
  acute: '\u00b4', cedil: '\u00b8', sup1: '\u00b9', iquest: '\u00bf',
  Agrave: '\u00c0', Aacute: '\u00c1', Acirc: '\u00c2', Atilde: '\u00c3',
  Aring: '\u00c5', Ccedil: '\u00c7', Egrave: '\u00c8', Eacute: '\u00c9',
  Ecirc: '\u00ca', Euml: '\u00cb', Igrave: '\u00cc', Iacute: '\u00cd',
  Icirc: '\u00ce', Iuml: '\u00cf', Ntilde: '\u00d1', Ograve: '\u00d2',
  Oacute: '\u00d3', Ocirc: '\u00d4', Otilde: '\u00d5', Oslash: '\u00d8',
  Ugrave: '\u00d9', Uacute: '\u00da', Ucirc: '\u00db', Yacute: '\u00dd',
  agrave: '\u00e0', aacute: '\u00e1', acirc: '\u00e2', atilde: '\u00e3',
  ccedil: '\u00e7', egrave: '\u00e8', eacute: '\u00e9', ecirc: '\u00ea',
  euml: '\u00eb', igrave: '\u00ec', iacute: '\u00ed', icirc: '\u00ee',
  iuml: '\u00ef', ntilde: '\u00f1', ograve: '\u00f2', oacute: '\u00f3',
  ocirc: '\u00f4', otilde: '\u00f5', ugrave: '\u00f9', uacute: '\u00fa',
  ucirc: '\u00fb', yacute: '\u00fd', yuml: '\u00ff', thetasym: '\u03d1',
  upsih: '\u03d2', piv: '\u03d6', fnof: '\u0192', circ: '\u02c6',
  tilde: '\u02dc', OElig: '\u0152', oelig: '\u0153', Scaron: '\u0160',
  scaron: '\u0161', Yuml: '\u0178', euro2: '\u20ac',
};

function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&#(?:[0-9]{1,7}|[xX][0-9a-fA-F]{1,6});/g, (m) => {
    const body = m.slice(2, -1);
    const cp = body[0] === 'x' || body[0] === 'X'
      ? parseInt(body.slice(1), 16)
      : parseInt(body, 10);
    if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff) return '\ufffd';
    try { return String.fromCodePoint(cp); } catch (e) { return '\ufffd'; }
  });
}

function unescapeMd(s) {
  return s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}

/* ------------------------------------------------------------------ *
 * shared character classes
 * ------------------------------------------------------------------ */

const PUNCT_RE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

function isSpaceCh(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\u000b' || c === '\f' || c === '\r';
}
function isPunctCh(c) {
  return PUNCT_RE.test(c);
}

/* ------------------------------------------------------------------ *
 * block level lexer
 * ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

const RE_HTML_TYPE1 = /^<(?:script|pre|style|textarea)(?=[\s>]|$)/i;
const RE_HTML_TYPE1_END = /<\/(?:script|pre|style|textarea)>/i;
const RE_HTML_TYPE6 = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>]|\/>|$)/;
const RE_HTML_TYPE7 = /^(?:<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:[^"'=<>`\s]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[a-zA-Z][a-zA-Z0-9-]*\s*>)[ \t]*$/;

const RE_ATX = /^(#{1,6})(?:[ \t]+|$)/;
const RE_FENCE = /^(`{3,}|~{3,})(.*)$/;
const RE_SETEXT = /^(=+|-+)[ \t]*$/;
const RE_HR = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const RE_BULLET = /^([*+-])(?=[ \t]|$)/;
const RE_ORDERED = /^(\d{1,9})([.)])(?=[ \t]|$)/;

function lexBlocks(src, refs) {
  const lines = src.split('\n');
  const nLines = lines.length;
  const doc = { type: 'document', children: [], open: true, parent: null, lastLineBlank: false };
  const s = {
    line: '', offset: 0, column: 0, nextNonspace: 0, nextNonspaceColumn: 0,
    indent: 0, indented: false, blank: false, partiallyConsumedTab: false,
    tip: doc, oldtip: doc, lastMatched: doc, allClosed: true, lineNumber: 0,
  };

  function lastOpenChild(b) {
    const c = b.children[b.children.length - 1];
    return c && c.open ? c : null;
  }

  const BLOCKS = new Set(['blockquote', 'list', 'item', 'paragraph', 'heading', 'code', 'html', 'hr', 'table']);

  function canContain(parentType, childType) {
    if (parentType === 'document') return childType !== 'item';
    if (parentType === 'blockquote' || parentType === 'item') return childType !== 'item';
    if (parentType === 'list') return childType === 'item';
    return false;
  }

  function addChild(type, parent, props) {
    let p = parent;
    while (p !== doc && !canContain(p.type, type)) {
      const up = p.parent;
      finalize(p);
      p = up;
    }
    const actual = p;
    const node = {
      type, children: [], open: true, parent: actual, lastLineBlank: false,
      startLine: s.lineNumber,
    };
    if (props) for (const k in props) node[k] = props[k];
    actual.children.push(node);
    s.tip = node;
    return node;
  }

  function findNextNonspace() {
    const line = s.line;
    let i = s.offset, cols = s.column;
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (c === 32) { i++; cols++; }
      else if (c === 9) { i++; cols += 4 - (cols % 4); }
      else break;
    }
    s.nextNonspace = i;
    s.nextNonspaceColumn = cols;
    s.indent = cols - s.column;
    s.indented = s.indent >= 4;
  }

  function advanceOffset(count, columns) {
    const line = s.line;
    while (count > 0 && s.offset < line.length) {
      if (line.charCodeAt(s.offset) === 9) {
        const toTab = 4 - (s.column % 4);
        if (columns) {
          if (toTab > count) {
            s.partiallyConsumedTab = true;
            s.column += count;
            count = 0;
          } else {
            s.partiallyConsumedTab = false;
            s.column += toTab;
            s.offset += 1;
            count -= toTab;
          }
        } else {
          s.partiallyConsumedTab = false;
          s.column += toTab;
          s.offset += 1;
          count -= 1;
        }
      } else {
        s.partiallyConsumedTab = false;
        s.offset += 1;
        s.column += 1;
        count -= 1;
      }
    }
  }

  function advanceNextNonspace() {
    s.offset = s.nextNonspace;
    s.column = s.nextNonspaceColumn;
    s.partiallyConsumedTab = false;
  }

  function addLine() {
    const node = s.tip;
    if (s.partiallyConsumedTab) {
      s.offset += 1;
      const charsToTab = 4 - (s.column % 4);
      node.lines.push(' '.repeat(charsToTab) + s.line.slice(s.offset));
    } else {
      node.lines.push(s.line.slice(s.offset));
    }
    node.lastLineNo = s.lineNumber;
  }

  function endsWithBlankLine(block) {
    for (let b = block; b; ) {
      if (b.lastLineBlank) return true;
      if (b.type === 'list' || b.type === 'item') {
        if (!b.children.length) return false;
        b = b.children[b.children.length - 1];
      } else return false;
    }
    return false;
  }

  function finalize(node) {
    node.open = false;
    if (node.type === 'paragraph') {
      let raw = node.lines.join('\n');
      raw = raw.replace(/[ \t]+$/, '');
      if (raw.length) {
        let guard = 0;
        for (;;) {
          const r = parseRefDef(raw, refs);
          if (!r) break;
          raw = raw.slice(r).replace(/^[ \t]*\n?/, '');
          if (++guard > 500) break;
          if (!raw.length) break;
        }
      }
      node.text = raw;
      node.empty = raw.length === 0;
      if (node.task !== undefined) {
        node.text = node.text.replace(/^\[[ xX]\][ \t]+/, '');
      }
    } else if (node.type === 'code') {
      let text = node.lines.join('\n');
      if (!node.fenced) {
        text = text.replace(/^\n+/, '').replace(/\n+$/, '');
      } else {
        text = text.replace(/\n+$/, '');
      }
      node.text = text;
    } else if (node.type === 'html') {
      const last = node.lines.length ? node.lastLineNo : 0;
      let text = node.lines.join('\n');
      if (last < nLines || lines[nLines - 1] === '') text += '\n';
      node.text = text;
    } else if (node.type === 'list') {
      const items = node.children;
      let tight = true;
      for (let i = 0; i < items.length && tight; i++) {
        const item = items[i];
        const nextItem = i + 1 < items.length;
        if (nextItem && endsWithBlankLine(item)) { tight = false; break; }
        const kids = item.children;
        for (let k = 0; k < kids.length; k++) {
          if ((nextItem || k + 1 < kids.length) && endsWithBlankLine(kids[k])) {
            tight = false; break;
          }
        }
      }
      node.tight = tight;
    } else if (node.type === 'item') {
      // detect task list marker on the first paragraph
      const first = node.children[0];
      if (first && first.type === 'paragraph') {
        const m = /^\[([ xX])\](?:[ \t]+|$)/.exec(first.text);
        if (m) {
          node.task = true;
          node.checked = m[1] !== ' ';
          first.text = first.text.slice(m[0].length);
          if (!first.text.length) first.empty = true;
        }
      }
    }
    if (s.tip === node) s.tip = node.parent;
  }

  function closeUnmatched() {
    if (!s.allClosed) {
      while (s.oldtip !== s.lastMatched) {
        const parent = s.oldtip.parent;
        finalize(s.oldtip);
        s.oldtip = parent;
      }
      s.allClosed = true;
    }
  }

  function continueBlock(node) {
    switch (node.type) {
      case 'document':
        return 0;
      case 'blockquote': {
        if (!s.indented && s.line.charCodeAt(s.nextNonspace) === 62) {
          advanceOffset(s.nextNonspace - s.offset + 1, false);
          const ch = s.line.charCodeAt(s.offset);
          if (ch === 32 || ch === 9) advanceOffset(1, true);
          return 0;
        }
        return 1;
      }
      case 'item': {
        if (s.blank) {
          if (node.children.length === 0) return 1;
          advanceNextNonspace();
          return 0;
        }
        if (s.indent >= node.totalIndent) {
          advanceOffset(node.totalIndent, true);
          return 0;
        }
        return 1;
      }
      case 'list':
        return 0;
      case 'code': {
        if (node.fenced) {
          if (!s.indented) {
            const rest = s.line.slice(s.nextNonspace);
            const m = /^(`{3,}|~{3,})[ \t]*$/.exec(rest);
            if (m && m[1][0] === node.fenceChar && m[1].length >= node.fenceLen) {
              finalize(node);
              return 2;
            }
          }
          let i = 0;
          while (i < node.fenceOffset && s.line.charCodeAt(s.offset + i) === 32) i++;
          advanceOffset(i, false);
          return 0;
        }
        if (s.indent >= 4) { advanceOffset(4, true); return 0; }
        if (s.blank) { advanceNextNonspace(); return 0; }
        return 1;
      }
      case 'html': {
        if (s.blank && (node.htmlType === 6 || node.htmlType === 7)) return 1;
        return 0;
      }
      case 'paragraph':
        return s.blank ? 1 : 0;
      default:
        return 1;
    }
  }

  function htmlStart(rest, inParagraph) {
    if (RE_HTML_TYPE1.test(rest)) return 1;
    if (rest.startsWith('<!--')) return 2;
    if (rest.startsWith('<?')) return 3;
    if (/^<![a-zA-Z]/.test(rest)) return 4;
    if (rest.startsWith('<![CDATA[')) return 5;
    const m6 = RE_HTML_TYPE6.exec(rest);
    if (m6 && BLOCK_TAGS.has(m6[1].toLowerCase())) return 6;
    if (!inParagraph && RE_HTML_TYPE7.test(rest)) return 7;
    return 0;
  }

  function htmlEnds(node, lineText) {
    switch (node.htmlType) {
      case 1: return RE_HTML_TYPE1_END.test(lineText);
      case 2: return lineText.indexOf('-->') >= 0;
      case 3: return lineText.indexOf('?>') >= 0;
      case 4: return lineText.indexOf('>') >= 0;
      case 5: return lineText.indexOf(']]>') >= 0;
      default: return false;
    }
  }

  function tryStart(container) {
    const ln = s.line;
    const nn = s.nextNonspace;
    const c = ln.charCodeAt(nn);
    if (s.indented) return 0;

    // blockquote
    if (c === 62) {
      advanceOffset(nn - s.offset + 1, false);
      const ch = ln.charCodeAt(s.offset);
      if (ch === 32 || ch === 9) advanceOffset(1, true);
      addChild('blockquote', container);
      return 1;
    }

    // ATX heading
    if (c === 35) {
      const m = RE_ATX.exec(ln.slice(nn));
      if (!m) return 0;
      advanceOffset(nn - s.offset + m[1].length, false);
      let text = ln.slice(s.offset).replace(/^[ \t]*/, '');
      if (/^#+[ \t]*$/.test(text)) text = '';
      else text = text.replace(/[ \t]+#+[ \t]*$/, '').replace(/[ \t]+$/, '');
      const node = addChild('heading', container, { level: m[1].length, text });
      node.open = false;
      s.tip = node.parent;
      return 2;
    }

    // fenced code
    if (c === 96 || c === 126) {
      const m = RE_FENCE.exec(ln.slice(nn));
      if (!m) return 0;
      const fence = m[1];
      if (fence.charCodeAt(0) === 96 && m[2].indexOf('`') >= 0) return 0;
      const info = unescapeMd(m[2].trim());
      addChild('code', container, {
        fenced: true, fenceChar: fence[0], fenceLen: fence.length,
        fenceOffset: s.indent, info, lines: [],
      });
      return 2;
    }

    // html block
    if (c === 60) {
      const rest = ln.slice(nn);
      const t = htmlStart(rest, container.type === 'paragraph');
      if (!t) return 0;
      const node = addChild('html', container, { htmlType: t, lines: [] });
      addLine();
      if (t <= 5 && htmlEnds(node, ln.slice(s.offset))) {
        finalize(node);
      }
      return 2;
    }

    // setext heading
    if (container.type === 'paragraph' && (c === 61 || c === 45) && RE_SETEXT.test(ln.slice(nn))) {
      container.type = 'heading';
      container.level = c === 61 ? 1 : 2;
      let raw = container.lines.join('\n');
      raw = raw.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
      container.text = raw;
      container.open = false;
      s.tip = container.parent;
      return 2;
    }

    // thematic break
    if ((c === 42 || c === 45 || c === 95) && RE_HR.test(ln.slice(nn))) {
      const node = addChild('hr', container);
      node.open = false;
      s.tip = node.parent;
      return 2;
    }

    // list item
    if (c === 42 || c === 43 || c === 45 || (c >= 48 && c <= 57)) {
      return tryListItem(container);
    }

    return 0;
  }

  function tryListItem(container) {
    const ln = s.line;
    const nn = s.nextNonspace;
    const rest = ln.slice(nn);
    const saveOffset = s.offset, saveColumn = s.column, savePart = s.partiallyConsumedTab;

    let ordered = false, markerLen = 0, startNum = 1, delim = '', bullet = '';
    let m = RE_BULLET.exec(rest);
    if (m) {
      markerLen = 1;
      bullet = m[1];
    } else {
      m = RE_ORDERED.exec(rest);
      if (!m) return 0;
      ordered = true;
      markerLen = m[1].length + 1;
      startNum = parseInt(m[1], 10);
      delim = m[2];
    }

    const markerOffset = s.indent;
    advanceOffset(nn - s.offset + markerLen, false);

    const spStartCol = s.column, spStartOff = s.offset;
    let spacesAfter = 0;
    while (s.offset < ln.length) {
      const ch = ln.charCodeAt(s.offset);
      if (ch === 32) { advanceOffset(1, false); spacesAfter = s.column - spStartCol; }
      else if (ch === 9) { advanceOffset(1, true); spacesAfter = s.column - spStartCol; }
      else break;
      if (spacesAfter >= 5) break;
    }
    const blankItem = s.offset >= ln.length;

    let padding;
    if (spacesAfter >= 5 || spacesAfter < 1 || blankItem) {
      padding = markerLen + 1;
      s.column = spStartCol;
      s.offset = spStartOff;
      s.partiallyConsumedTab = false;
      const ch = ln.charCodeAt(s.offset);
      if (ch === 32 || ch === 9) advanceOffset(1, true);
    } else {
      padding = markerLen + spacesAfter;
    }

    if (container.type === 'paragraph' && (blankItem || (ordered && startNum !== 1))) {
      s.offset = saveOffset;
      s.column = saveColumn;
      s.partiallyConsumedTab = savePart;
      return 0;
    }

    let list;
    const prev = s.tip;
    if (prev && prev.type === 'list' && prev.open && prev.ordered === ordered &&
        prev.delim === delim && prev.bullet === bullet) {
      list = prev;
    } else {
      list = addChild('list', container, {
        ordered, start: startNum, delim, bullet, tight: true,
      });
    }
    s.tip = list;
    addChild('item', list, {
      markerOffset, padding, totalIndent: markerOffset + padding, lines: [],
    });
    return 1;
  }

  for (let i = 0; i < nLines; i++) {
    s.lineNumber = i + 1;
    s.line = lines[i];
    s.offset = 0;
    s.column = 0;
    s.partiallyConsumedTab = false;
    s.blank = /^[ \t]*$/.test(s.line);
    s.oldtip = s.tip;

    let container = doc;
    let matchedLeaf = false;
    let consumed = false;

    for (;;) {
      const lc = lastOpenChild(container);
      if (!lc) break;
      findNextNonspace();
      const r = continueBlock(lc);
      if (r === 2) { consumed = true; break; }
      if (r === 1) { s.allClosed = false; break; }
      container = lc;
      if (lc.type === 'code' || lc.type === 'html') { matchedLeaf = true; break; }
    }

    if (consumed) continue;

    s.allClosed = container === s.oldtip;
    s.lastMatched = container;

    if (!s.allClosed && !s.blank && s.tip.type === 'paragraph') {
      // lazy paragraph continuation — only if the line doesn't start a new block
      findNextNonspace();
      let lazy = true;
      if (!s.indented) {
        const cc = s.line.charCodeAt(s.nextNonspace);
        if (cc === 62) lazy = false;
        else if (cc === 35 && RE_ATX.test(s.line.slice(s.nextNonspace))) lazy = false;
        else if (cc === 60 && htmlStart(s.line.slice(s.nextNonspace), true)) lazy = false;
        else if ((cc === 96 || cc === 126) && RE_FENCE.test(s.line.slice(s.nextNonspace))) lazy = false;
        else if (cc === 42 || cc === 43 || cc === 45 || (cc >= 48 && cc <= 57)) {
          const rest = s.line.slice(s.nextNonspace);
          if (RE_HR.test(rest) || RE_BULLET.test(rest) || RE_ORDERED.test(rest)) lazy = false;
        }
      }
      if (lazy) {
        addLine();
        continue;
      }
    }

    closeUnmatched();

    if (s.blank && container.children.length) {
      container.children[container.children.length - 1].lastLineBlank = true;
    }

    const isFenced = container.type === 'code' && container.fenced;
    const lastLineBlank = s.blank && !(
      container.type === 'blockquote' || isFenced ||
      (container.type === 'item' && container.children.length === 0 && container.startLine === s.lineNumber)
    );
    for (let p = container; p; p = p.parent) p.lastLineBlank = lastLineBlank;

    if (!matchedLeaf) {
      while (!s.blank) {
        findNextNonspace();
        if (s.indented) {
          if (container.type === 'paragraph') break;
          const code = addChild('code', container, { fenced: false, lines: [] });
          container = code;
          advanceOffset(4, true);
          addLine();
          consumed = true;
          matchedLeaf = true;
          break;
        }
        const res = tryStart(container);
        if (res === 0) break;
        container = s.tip;
        if (res === 2) { consumed = true; break; }
      }
    }

    if (matchedLeaf && !consumed) {
      // open code / html block accumulating a line
      addLine();
      if (container.type === 'html' && container.htmlType <= 5) {
        if (htmlEnds(container, s.line.slice(s.offset))) finalize(container);
      }
      continue;
    }

    if (!consumed && !s.blank) {
      if (container.type === 'paragraph') {
        addLine();
      } else {
        const p = addChild('paragraph', container, { lines: [] });
        p.text = '';
        addLine();
      }
    }

    // mark blank lines between blocks inside list items
    if (s.blank) {
      let p = container;
      while (p) {
        if (p.type === 'item') p.blankBetween = true;
        p = p.parent;
      }
    }
  }

  // close everything still open
  let node = s.tip;
  while (node && node !== doc) {
    const parent = node.parent;
    if (node.open) finalize(node);
    node = parent;
  }
  return doc;
}

/* ------------------------------------------------------------------ *
 * link reference definitions
 * ------------------------------------------------------------------ */

function normalizeLabel(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase();
}

function parseRefDef(src, refs) {
  // [label]: destination "title"
  if (src.charCodeAt(0) !== 91) return 0;
  let i = 1;
  let label = '';
  let len = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && PUNCT_RE.test(src[i + 1])) {
      label += src[i + 1];
      i += 2;
      len += 2;
      continue;
    }
    if (c === '[') return 0;
    if (c === ']') break;
    if (c === '\n') {
      // newline allowed inside labels if not blank line
      if (i + 1 < src.length && src[i + 1] === '\n') return 0;
    }
    label += c;
    i++;
    len++;
    if (len > 999) return 0;
  }
  if (i >= src.length || src[i] !== ']') return 0;
  i++;
  if (src[i] !== ':') return 0;
  i++;
  // optional whitespace including one newline
  let sawNl = false;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') i++;
    else if (c === '\n' && !sawNl) { sawNl = true; i++; }
    else break;
  }
  const destRes = parseLinkDest(src, i);
  if (!destRes) return 0;
  if (destRes.dest === '' && destRes.raw === '') return 0;
  i = destRes.end;

  // title (optional), preceded by whitespace
  let title = null;
  let j = i;
  let sawNl2 = false;
  while (j < src.length) {
    const c = src[j];
    if (c === ' ' || c === '\t') j++;
    else if (c === '\n' && !sawNl2) { sawNl2 = true; j++; }
    else break;
  }
  if (j > i) {
    const t = parseLinkTitle(src, j);
    if (t) {
      // title must be followed by end of line
      let k = t.end;
      while (k < src.length && (src[k] === ' ' || src[k] === '\t')) k++;
      if (k >= src.length || src[k] === '\n') {
        title = t.title;
        i = k;
        if (i < src.length && src[i] === '\n') i++;
      } else {
        // invalid title: definition ends after destination
        i = destRes.end;
        while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
        if (i < src.length && src[i] === '\n') i++;
      }
    } else {
      i = destRes.end;
      while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
      if (i < src.length && src[i] === '\n') i++;
    }
  } else {
    while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
    if (i < src.length && src[i] === '\n') i++;
  }

  const key = normalizeLabel(label);
  if (!key.length) return 0;
  if (!(key in refs)) {
    refs[key] = { dest: destRes.dest, title };
  }
  return i;
}

function parseLinkDest(src, i) {
  // returns {dest, end, raw} or null
  if (src[i] === '<') {
    let j = i + 1;
    let out = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '\\' && j + 1 < src.length && PUNCT_RE.test(src[j + 1])) {
        out += src[j] + src[j + 1];
        j += 2;
        continue;
      }
      if (c === '>') return { dest: unescapeMd(decodeEntities(out)), end: j + 1, raw: out };
      if (c === '<' || c === '\n') return null;
      out += c;
      j++;
    }
    return null;
  }
  let j = i;
  let depth = 0;
  let out = '';
  while (j < src.length) {
    const c = src[j];
    if (c === '\\' && j + 1 < src.length && PUNCT_RE.test(src[j + 1])) {
      out += src[j] + src[j + 1];
      j += 2;
      continue;
    }
    const cc = src.charCodeAt(j);
    if (cc <= 32 || cc === 127) break;
    if (c === '(') { depth++; out += c; j++; continue; }
    if (c === ')') { if (depth === 0) break; depth--; out += c; j++; continue; }
    out += c;
    j++;
  }
  if (j === i) return { dest: '', end: i, raw: '' };
  return { dest: unescapeMd(decodeEntities(out)), end: j, raw: out };
}

function parseLinkTitle(src, i) {
  const open = src[i];
  let close;
  if (open === '"') close = '"';
  else if (open === "'") close = "'";
  else if (open === '(') close = ')';
  else return null;
  let j = i + 1;
  let out = '';
  while (j < src.length) {
    const c = src[j];
    if (c === '\\' && j + 1 < src.length && PUNCT_RE.test(src[j + 1])) {
      out += src[j] + src[j + 1];
      j += 2;
      continue;
    }
    if (c === close) return { title: unescapeMd(decodeEntities(out)), end: j + 1 };
    if (open === '(' && c === '(') return null;
    if (c === '\n' && j + 1 < src.length && src[j + 1] === '\n') return null;
    out += c;
    j++;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * inline parser
 * ------------------------------------------------------------------ */

const RE_AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.\-]{1,31}:[^<>\x00-\x20]*)>/;
const RE_EMAIL_AUTOLINK = /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*)>/;
const RE_INLINE_HTML = /^(?:<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![a-zA-Z][^>]*>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[a-zA-Z][a-zA-Z0-9\-]*(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:\-]*(?:\s*=\s*(?:[^"'=<>`\s]+|'[^']*'|"[^"]*"))?)*\s*\/?>)/;
const RE_GFM_URL = /^(?:(?:https?|ftp):\/\/|www\.)[^\s<]*/;
const RE_GFM_EMAIL = /^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9\-_]+(?:\.[a-zA-Z0-9\-_]*[a-zA-Z0-9])+/;

function isWordBoundary(t, i) {
  if (i === 0) return true;
  const c = t[i - 1];
  return !/[a-zA-Z0-9]/.test(c);
}

function trimUrl(u) {
  // GFM autolink trailing punctuation rules
  for (;;) {
    const last = u[u.length - 1];
    if (last === '?' || last === '!' || last === '.' || last === ',' || last === ':' || last === '*' || last === '_' || last === '~' || last === "'" || last === '"') {
      u = u.slice(0, -1);
      continue;
    }
    if (last === ')') {
      let open = 0, close = 0;
      for (let i = 0; i < u.length; i++) {
        if (u[i] === '(') open++;
        else if (u[i] === ')') close++;
      }
      if (close > open) { u = u.slice(0, -1); continue; }
      break;
    }
    if (last === ';') {
      const m = /&[a-zA-Z0-9]+;$/.exec(u);
      if (m) { u = u.slice(0, m.index); continue; }
      break;
    }
    break;
  }
  return u;
}

function parseInline(text, refs) {
  const nodes = [];
  const delims = [];
  const brackets = [];
  let buf = '';
  let pos = 0;
  const len = text.length;

  function flush() {
    if (buf.length) { nodes.push({ t: 'text', v: buf }); buf = ''; }
  }
  function addNode(n) { flush(); nodes.push(n); }

  while (pos < len) {
    const c = text.charCodeAt(pos);

    // backslash escape
    if (c === 92) {
      if (pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        flush();
        nodes.push({ t: 'hardbreak' });
        pos += 2;
        continue;
      }
      if (pos + 1 < len && PUNCT_RE.test(text[pos + 1])) {
        const ch = text[pos + 1];
        if (ch === '&' || ch === '<' || ch === '>' || ch === '"' || ch === "'") {
          addNode({ t: 'lit', v: ch });
        } else {
          buf += ch;
        }
        pos += 2;
        continue;
      }
      buf += '\\';
      pos++;
      continue;
    }

    // numeric character reference
    if (c === 38 /* & */) {
      const m = /^&#(?:[0-9]{1,7}|[xX][0-9a-fA-F]{1,6});/.exec(text.slice(pos));
      if (m) {
        buf += decodeEntities(m[0]);
        pos += m[0].length;
        continue;
      }
    }

    // code span
    if (c === 96) {
      let n = 0;
      while (pos + n < len && text.charCodeAt(pos + n) === 96) n++;
      let k = pos + n;
      let found = -1;
      while (k < len) {
        const idx = text.indexOf('`', k);
        if (idx < 0) break;
        let m = 0;
        while (idx + m < len && text.charCodeAt(idx + m) === 96) m++;
        if (m === n) { found = idx; break; }
        k = idx + m;
      }
      if (found < 0) {
        buf += text.slice(pos, pos + n);
        pos += n;
        continue;
      }
      let content = text.slice(pos + n, found).replace(/\n/g, ' ');
      if (/[^ ]/.test(content) && content.startsWith(' ') && content.endsWith(' ')) {
        content = content.slice(1, -1);
      }
      addNode({ t: 'code', v: escAll(content) });
      pos = found + n;
      continue;
    }

    // autolink / raw html
    if (c === 60) {
      const rest = text.slice(pos);
      let m = RE_AUTOLINK.exec(rest);
      if (m) {
        addNode({ t: 'link', dest: m[1], title: null, children: [{ t: 'text', v: m[1] }], auto: true });
        pos += m[0].length;
        continue;
      }
      m = RE_EMAIL_AUTOLINK.exec(rest);
      if (m) {
        addNode({ t: 'link', dest: 'mailto:' + m[1], title: null, children: [{ t: 'text', v: m[1] }], auto: true });
        pos += m[0].length;
        continue;
      }
      m = RE_INLINE_HTML.exec(rest);
      if (m) {
        addNode({ t: 'html', v: m[0] });
        pos += m[0].length;
        continue;
      }
      buf += '<';
      pos++;
      continue;
    }

    // image open
    if (c === 33 && pos + 1 < len && text.charCodeAt(pos + 1) === 91) {
      flush();
      const marker = { t: 'text', v: '![' };
      nodes.push(marker);
      brackets.push({ marker, image: true, active: true, delimBottom: delims.length, start: pos + 2 });
      pos += 2;
      continue;
    }

    // link open
    if (c === 91) {
      flush();
      const marker = { t: 'text', v: '[' };
      nodes.push(marker);
      brackets.push({ marker, image: false, active: true, delimBottom: delims.length, start: pos + 1 });
      pos++;
      continue;
    }

    // link close
    if (c === 93) {
      flush();
      const opener = brackets[brackets.length - 1];
      if (!opener) {
        buf += ']';
        pos++;
        continue;
      }
      if (!opener.active) {
        brackets.pop();
        buf += ']';
        pos++;
        continue;
      }
      let dest = null, title = null, endPos = -1;
      const after = pos + 1;
      if (text.charCodeAt(after) === 40) {
        const r = parseInlineLinkTail(text, after);
        if (r) { dest = r.dest; title = r.title; endPos = r.end; }
      }
      if (endPos < 0) {
        // reference forms
        const labelText = text.slice(opener.start, pos);
        let refLabel = null;
        let useEnd = after;
        if (text.charCodeAt(after) === 91) {
          const close = findLabelEnd(text, after);
          if (close >= 0) {
            const raw = text.slice(after + 1, close);
            if (raw.trim() === '') { refLabel = normalizeLabel(labelText); useEnd = close + 1; }
            else { refLabel = normalizeLabel(raw); useEnd = close + 1; }
          }
        }
        if (refLabel === null) refLabel = normalizeLabel(labelText);
        const def = refs[refLabel];
        if (def) { dest = def.dest; title = def.title; endPos = useEnd; }
      }
      if (endPos < 0) {
        brackets.pop();
        buf += ']';
        pos++;
        continue;
      }
      // success
      processEmphasis(nodes, delims, opener.delimBottom);
      const mi = nodes.indexOf(opener.marker);
      const inner = nodes.slice(mi + 1);
      nodes.length = mi;
      delims.length = opener.delimBottom;
      if (opener.image) {
        const alt = inner.map(plainText).join('');
        nodes.push({ t: 'img', dest, title, alt });
      } else {
        nodes.push({ t: 'link', dest, title, children: inner });
        for (const b of brackets) if (!b.image) b.active = false;
      }
      brackets.pop();
      pos = endPos;
      continue;
    }

    // strikethrough
    if (c === 126 && pos + 1 < len && text.charCodeAt(pos + 1) === 126) {
      const start = pos + 2;
      if (start < len && !isSpaceCh(text[start])) {
        let k = start;
        let found = -1;
        while (k < len - 1) {
          if (text.charCodeAt(k) === 126 && text.charCodeAt(k + 1) === 126 && k > start - 1 && !isSpaceCh(text[k - 1])) {
            found = k;
            break;
          }
          k++;
        }
        if (found > start - 1 && found >= start) {
          const content = text.slice(start, found);
          if (content.length) {
            addNode({ t: 'del', children: parseInline(content, refs) });
            pos = found + 2;
            continue;
          }
        }
      }
      buf += '~~';
      pos += 2;
      continue;
    }

    // emphasis delimiters
    if (c === 42 || c === 95) {
      const ch = text[pos];
      let n = 0;
      while (pos + n < len && text.charCodeAt(pos + n) === c) n++;
      const before = pos > 0 ? text[pos - 1] : '\n';
      const after = pos + n < len ? text[pos + n] : '\n';
      const beforeSpace = isSpaceCh(before);
      const afterSpace = isSpaceCh(after);
      const beforePunct = isPunctCh(before);
      const afterPunct = isPunctCh(after);
      const leftFlanking = !afterSpace && (!afterPunct || beforeSpace || beforePunct);
      const rightFlanking = !beforeSpace && (!beforePunct || afterSpace || afterPunct);
      let canOpen, canClose;
      if (c === 95) {
        canOpen = leftFlanking && (!rightFlanking || beforePunct);
        canClose = rightFlanking && (!leftFlanking || afterPunct);
      } else {
        canOpen = leftFlanking;
        canClose = rightFlanking;
      }
      flush();
      const node = { t: 'text', v: text.slice(pos, pos + n) };
      nodes.push(node);
      delims.push({ ch, count: n, orig: n, canOpen, canClose, node });
      pos += n;
      continue;
    }

    // newline
    if (c === 10) {
      // hard break if two+ spaces before
      let sp = 0;
      while (sp < buf.length && buf.charCodeAt(buf.length - 1 - sp) === 32) sp++;
      if (sp >= 2) {
        buf = buf.slice(0, buf.length - sp);
        flush();
        nodes.push({ t: 'hardbreak' });
      } else {
        buf = buf.replace(/[ \t]+$/, '');
        flush();
        nodes.push({ t: 'softbreak' });
      }
      pos++;
      continue;
    }

    // GFM autolinks
    if ((c === 104 || c === 119 || c === 102) && isWordBoundary(text, pos)) {
      const rest = text.slice(pos);
      if (/^(?:https?:\/\/|ftp:\/\/|www\.)/.test(rest)) {
        const m = RE_GFM_URL.exec(rest);
        if (m) {
          let url = trimUrl(m[0]);
          if (url.length > (url.startsWith('www.') ? 4 : 8) || url.startsWith('www.') === false) {
            const href = url.startsWith('www.') ? 'http://' + url : url;
            addNode({ t: 'link', dest: href, title: null, children: [{ t: 'text', v: url }], auto: true });
            pos += url.length;
            continue;
          }
        }
      }
    }
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 46 || c === 95 || c === 43 || c === 45) {
      if (isWordBoundary(text, pos) && text.indexOf('@', pos) > pos && text.indexOf('@', pos) < pos + 64) {
        const m = RE_GFM_EMAIL.exec(text.slice(pos));
        if (m) {
          addNode({ t: 'link', dest: 'mailto:' + m[0], title: null, children: [{ t: 'text', v: m[0] }], auto: true });
          pos += m[0].length;
          continue;
        }
      }
    }

    buf += text[pos];
    pos++;
  }

  flush();
  processEmphasis(nodes, delims, 0);
  return renderInline(nodes);
}

function findLabelEnd(text, start) {
  let i = start + 1;
  let count = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length) { i += 2; count += 2; continue; }
    if (c === '[') return -1;
    if (c === ']') return i;
    if (c === '\n' && i + 1 < text.length && text[i + 1] === '\n') return -1;
    i++;
    count++;
    if (count > 999) return -1;
  }
  return -1;
}

function parseInlineLinkTail(text, start) {
  // text[start] === '('
  let i = start + 1;
  const len = text.length;
  while (i < len) {
    const c = text[i];
    if (c === ' ' || c === '\t') i++;
    else if (c === '\n') i++;
    else break;
  }
  const d = parseLinkDest(text, i);
  if (!d) return null;
  i = d.end;
  let title = null;
  let j = i;
  while (j < len) {
    const c = text[j];
    if (c === ' ' || c === '\t') j++;
    else if (c === '\n') j++;
    else break;
  }
  if (j > i) {
    const t = parseLinkTitle(text, j);
    if (t) { title = t.title; i = t.end; }
  }
  while (i < len) {
    const c = text[i];
    if (c === ' ' || c === '\t') i++;
    else if (c === '\n') i++;
    else break;
  }
  if (text[i] !== ')') return null;
  return { dest: d.dest, title, end: i + 1 };
}

function plainText(n) {
  switch (n.t) {
    case 'text': return n.v;
    case 'code': return decodeEntities(n.v);
    case 'softbreak': return '\n';
    case 'hardbreak': return '\n';
    case 'em':
    case 'strong':
    case 'del':
    case 'link': return n.children.map(plainText).join('');
    case 'img': return n.alt;
    default: return '';
  }
}

function processEmphasis(nodes, delims, bottom) {
  let ci = bottom;
  while (ci < delims.length) {
    const closer = delims[ci];
    if (!closer.canClose) { ci++; continue; }
    let oi = ci - 1, found = -1;
    while (oi >= bottom) {
      const o = delims[oi];
      if (o.ch === closer.ch && o.canOpen) {
        const odd = (o.canClose || closer.canOpen) &&
          ((o.orig + closer.orig) % 3 === 0) &&
          !(o.orig % 3 === 0 && closer.orig % 3 === 0);
        if (!odd) { found = oi; break; }
      }
      oi--;
    }
    if (found < 0) {
      if (!closer.canOpen) delims.splice(ci, 1);
      else ci++;
      continue;
    }
    const opener = delims[found];
    const use = (opener.count >= 2 && closer.count >= 2) ? 2 : 1;
    opener.count -= use;
    closer.count -= use;
    opener.node.v = opener.node.v.slice(0, opener.node.v.length - use);
    closer.node.v = closer.node.v.slice(use);

    delims.splice(found + 1, ci - found - 1);
    ci = found + 1;

    const a = nodes.indexOf(opener.node);
    const b = nodes.indexOf(closer.node);
    if (a >= 0 && b > a) {
      const inner = nodes.slice(a + 1, b);
      nodes.splice(a + 1, b - a - 1, { t: use === 2 ? 'strong' : 'em', children: inner });
    }
    if (opener.count === 0) {
      const idx = nodes.indexOf(opener.node);
      if (idx >= 0) nodes.splice(idx, 1);
      delims.splice(found, 1);
      ci = found;
    }
    if (closer.count === 0) {
      const idx = nodes.indexOf(closer.node);
      if (idx >= 0) nodes.splice(idx, 1);
      delims.splice(ci, 1);
    }
  }
}

function cleanUrl(u) {
  try {
    return encodeURI(u).replace(/%25/g, '%');
  } catch (e) {
    return null;
  }
}

function renderInline(nodes) {
  let out = '';
  for (const n of nodes) out += renderInlineNode(n);
  return out;
}

function renderInlineNode(n) {
  switch (n.t) {
    case 'text': return escText(n.v);
    case 'lit': return escAll(n.v);
    case 'html': return n.v;
    case 'code': return '<code>' + n.v + '</code>';
    case 'softbreak': return '\n';
    case 'hardbreak': return '<br>';
    case 'em': return '<em>' + renderInline(n.children) + '</em>';
    case 'strong': return '<strong>' + renderInline(n.children) + '</strong>';
    case 'del': return '<del>' + renderInline(n.children) + '</del>';
    case 'link': {
      const href = cleanUrl(n.dest);
      if (href === null) return renderInline(n.children);
      let out = '<a href="' + href + '"';
      if (n.title) out += ' title="' + escText(n.title) + '"';
      out += '>' + renderInline(n.children) + '</a>';
      return out;
    }
    case 'img': {
      const src = cleanUrl(n.dest);
      if (src === null) return escText(n.alt);
      let out = '<img src="' + src + '" alt="' + escText(n.alt) + '"';
      if (n.title) out += ' title="' + escText(n.title) + '"';
      out += '>';
      return out;
    }
    default: return '';
  }
}

/* ------------------------------------------------------------------ *
 * GFM tables
 * ------------------------------------------------------------------ */

const RE_TABLE_DELIM = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function countCells(line) {
  return splitRow(line).length;
}

/* ------------------------------------------------------------------ *
 * renderer
 * ------------------------------------------------------------------ */

function renderCode(n) {
  const info = n.info || '';
  const m = /^\S*/.exec(info);
  const lang = m ? m[0] : '';
  let body = n.text.replace(/\n$/, '');
  if (body.length) body += '\n';
  const esc = escAll(body);
  if (!lang) return '<pre><code>' + esc + '</code></pre>\n';
  return '<pre><code class="language-' + escText(lang) + '">' + esc + '</code></pre>\n';
}

function renderTable(n) {
  let header = '';
  for (let i = 0; i < n.header.length; i++) {
    const al = n.align[i];
    header += '<th' + (al ? ' align="' + al + '"' : '') + '>' + parseInline(n.header[i], n.refs) + '</th>\n';
  }
  header = '<tr>\n' + header + '</tr>\n';
  let body = '';
  if (n.rows.length) {
    for (const row of n.rows) {
      let cells = '';
      for (let i = 0; i < row.length; i++) {
        const al = n.align[i];
        cells += '<td' + (al ? ' align="' + al + '"' : '') + '>' + parseInline(row[i], n.refs) + '</td>\n';
      }
      body += '<tr>\n' + cells + '</tr>\n';
    }
    body = '<tbody>\n' + body + '</tbody>\n';
  }
  return '<table>\n<thead>\n' + header + '</thead>\n' + body + '</table>\n';
}

function renderBlocks(children, tight, refs) {
  let out = '';
  for (const n of children) out += renderBlock(n, tight, refs);
  return out;
}

function renderBlock(n, tight, refs) {
  switch (n.type) {
    case 'paragraph': {
      if (n.empty) return '';
      const inner = parseInline(n.text, refs);
      return tight ? inner : '<p>' + inner + '</p>\n';
    }
    case 'heading':
      return '<h' + n.level + '>' + parseInline(n.text, refs) + '</h' + n.level + '>\n';
    case 'hr':
      return '<hr>\n';
    case 'code':
      return renderCode(n);
    case 'html':
      return n.text;
    case 'blockquote':
      return '<blockquote>\n' + renderBlocks(n.children, false, refs) + '</blockquote>\n';
    case 'list':
      return renderList(n, refs);
    case 'table':
      n.refs = refs;
      return renderTable(n);
    default:
      return '';
  }
}

function renderList(list, refs) {
  const tight = list.tight;
  let body = '';
  for (const item of list.children) body += renderItem(item, tight, refs);
  const tag = list.ordered ? 'ol' : 'ul';
  const startAttr = (list.ordered && list.start !== 1) ? ' start="' + list.start + '"' : '';
  return '<' + tag + startAttr + '>\n' + body + '</' + tag + '>\n';
}

function renderItem(item, tight, refs) {
  let body = '';
  const cb = item.task
    ? '<input ' + (item.checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> '
    : '';
  if (item.task && !tight) {
    // inject into first paragraph
    const first = item.children[0];
    if (first && first.type === 'paragraph') {
      body += '<p>' + cb + parseInline(first.text, refs) + '</p>\n';
      body += renderBlocks(item.children.slice(1), tight, refs);
    } else {
      body += cb + renderBlocks(item.children, tight, refs);
    }
  } else {
    body += cb + renderBlocks(item.children, tight, refs);
  }
  return '<li>' + body + '</li>\n';
}

/* ------------------------------------------------------------------ *
 * tables at block level (post-pass over paragraphs)
 * ------------------------------------------------------------------ */

function convertTables(node, refs) {
  const out = [];
  const kids = node.children;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.type === 'paragraph' && k.text) {
      const lines = k.text.split('\n');
      if (lines.length >= 2 && lines[0].indexOf('|') >= 0 && RE_TABLE_DELIM.test(lines[1]) && lines[1].indexOf('-') >= 0) {
        const header = splitRow(lines[0]);
        const delim = splitRow(lines[1]);
        if (header.length === delim.length) {
          const align = [];
          let ok = true;
          for (const d of delim) {
            const t = d.trim();
            if (!/^:?-+:?$/.test(t)) { ok = false; break; }
            if (t.startsWith(':') && t.endsWith(':')) align.push('center');
            else if (t.endsWith(':')) align.push('right');
            else if (t.startsWith(':')) align.push('left');
            else align.push('');
          }
          if (ok) {
            const rows = [];
            for (let j = 2; j < lines.length; j++) {
              const cells = splitRow(lines[j]);
              while (cells.length < header.length) cells.push('');
              rows.push(cells.slice(0, header.length));
            }
            out.push({ type: 'table', header, align, rows, children: [] });
            continue;
          }
        }
      }
    }
    if (k.children && k.children.length) convertTables(k, refs);
    out.push(k);
  }
  node.children = out;
}

/* ------------------------------------------------------------------ *
 * public API
 * ------------------------------------------------------------------ */

export function parse(markdown) {
  const src = String(markdown == null ? '' : markdown).replace(/\r\n|\r/g, '\n');
  const refs = Object.create(null);
  const doc = lexBlocks(src, refs);
  convertTables(doc, refs);
  return renderBlocks(doc.children, false, refs);
}

export default parse;

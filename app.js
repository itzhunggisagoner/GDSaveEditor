(() => {
  const $ = (s) => document.querySelector(s);
  const ROW = 48, BUF = 8, MAX_SHOWN = 240;
  const state = {
    fileName: '', container: 'xml', xml: '', entries: [], byId: new Map(), collapsed: new Set(), view: [],
    undo: [], redo: [], editingId: null, q: '', type: 'all', focusId: null, flat: false, range: [-1, -1], total: 0,
    enter: false, anim: new Set(), flashId: null, flashSet: new Set(), sel: new Set(), lastSel: null, warnHidden: false, moreStats: false, toastTimer: null
  };
  const STATS_PARENT = '/GS_value#0', SUMMARY = [6, 28, 5, 13, 29, 14, 22, 12, 8, 21, 1, 2];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hl = (text, q) => {
    if (!q) return esc(text);
    const low = text.toLowerCase(); let i = low.indexOf(q), p = 0, out = '';
    if (i < 0) return esc(text);
    while (i >= 0) { out += esc(text.slice(p, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>'; p = i + q.length; i = low.indexOf(q, p); }
    return out + esc(text.slice(p));
  };
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

    const tagOf = (n) => n.tagName.toLowerCase();
  const isKey = (n) => ['k', 'key'].includes(tagOf(n));
  const isDict = (n) => ['d', 'dict'].includes(tagOf(n));
  const rootOf = (doc) => doc.querySelector('plist > dict, plist > d');

  function walk(dict, path, depth, cb) {
    const kids = Array.from(dict.children), seen = Object.create(null);
    for (let i = 0; i < kids.length; i++) {
      if (!isKey(kids[i]) || !kids[i + 1]) continue;
      const keyNode = kids[i], valueNode = kids[i + 1], key = keyNode.textContent || '';
      const n = seen[key] = (seen[key] ?? -1) + 1;
      const id = `${path}/${key}#${n}`;
      if (cb({ id, key, keyNode, valueNode, depth, parent: path }) !== false && isDict(valueNode)) walk(valueNode, id, depth + 1, cb);
      i++;
    }
  }
  function classify(tag, value) {
    if (tag === 't' || tag === 'f' || tag === 'true' || tag === 'false') return 'bool';
    if (value === '') return 'empty';
    return value.length < 40 && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value) ? 'number' : 'text';
  }
  function parse(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const root = rootOf(doc);
    if (doc.querySelector('parsererror') || !root) throw new Error('The decoded data is not a valid Geometry Dash plist.');
    const entries = [];
    walk(root, '', 0, ({ id, key, valueNode, depth, parent }) => {
      const alias = GDAliases.of(parent, key, depth), base = { id, key, depth, parent, alias, kl: key.toLowerCase(), al: alias.toLowerCase() };
      const tag = tagOf(valueNode);
      if (isDict(valueNode)) { entries.push({ ...base, group: true, tag, type: 'group', value: '', count: valueNode.children.length / 2 | 0 }); return; }
      const value = tag === 't' || tag === 'true' ? 'true' : tag === 'f' || tag === 'false' ? 'false' : valueNode.textContent ?? '';
      entries.push({ ...base, group: false, tag, value, type: classify(tag, value) });
    });
    return entries;
  }

    function computeView() {
    const q = state.q, type = state.type, out = [];
    state.flat = !!q || type !== 'all' || !!state.focusId;
    if (state.focusId) { const f = state.byId.get(state.focusId); if (f) out.push(f); }
    else if (!state.flat) {
      let skip = -1;
      for (const e of state.entries) {
        if (skip >= 0) { if (e.depth > skip) continue; skip = -1; }
        out.push(e);
        if (e.group && state.collapsed.has(e.id)) skip = e.depth;
      }
    } else {
      for (const e of state.entries) {
        const hitKey = !q || e.kl.includes(q) || e.al.includes(q);
        if (e.group) { if (type === 'all' && hitKey) out.push(e); continue; }
        if (type !== 'all' && e.type !== type) continue;
        if (hitKey || e.value.toLowerCase().includes(q)) out.push(e);
      }
    }
    state.view = out;
  }

  const ICON = {
    add: '<button class="row-btn add" title="Add key here" aria-label="Add key to group"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>',
    edit: '<button class="row-btn edit" title="Edit" aria-label="Edit value"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg></button>',
    del: '<button class="row-btn delete" title="Delete" aria-label="Delete entry"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
  };
  function rowHtml(e, i, start) {
    const q = state.q, n = i - start;
    const cls = [e.group ? 'group' : '', (state.enter && n < 14) || state.anim.has(e.id) ? 'enter' : '', e.id === state.flashId || state.flashSet.has(e.id) ? 'flash' : '', state.sel.has(e.id) ? 'selected' : ''].filter(Boolean).join(' ');
    const indent = state.flat ? 0 : e.depth * 18;
    const open = e.group && !state.collapsed.has(e.id);
    const chev = e.group ? `<button class="chev${open ? ' open' : ''}" aria-label="${open ? 'Collapse' : 'Expand'} group" aria-expanded="${open}"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>` : state.flat ? '' : '<span class="chev"></span>';
    const shown = e.group ? `${e.count} items` : e.value.length > MAX_SHOWN ? e.value.slice(0, MAX_SHOWN) + '…' : e.value;
    const box = e.group ? '' : `<input type="checkbox" class="sel-box" aria-label="Select ${esc(e.key)}"${state.sel.has(e.id) ? ' checked' : ''}>`;
    return `<tr class="${cls}" data-id="${esc(e.id)}" style="--d:${n * 24}ms">
      <td class="sel-col">${box}</td>
      <td><div class="kcell" style="padding-left:${indent}px">${chev}<div class="kt"><div class="key-name">${hl(e.key, q)}</div>${e.alias ? `<div class="key-alias">${hl(e.alias, q)}</div>` : ''}</div></div></td>
      <td class="value-cell"${e.group ? '' : ` title="${esc(e.value.slice(0, 600))}"`}>${e.group ? esc(shown) : hl(shown, q)}</td>
      <td class="type-col"><span class="type-tag ${e.type}">${e.type}</span></td>
      <td><div class="row-actions">${e.group ? ICON.add : ICON.edit}${ICON.del}</div></td></tr>`;
  }

  function render(force) {
    const wrap = $('#tableWrap'), n = state.view.length;
    const start = Math.max(0, Math.floor(wrap.scrollTop / ROW) - BUF);
    const end = Math.min(n, Math.ceil((wrap.scrollTop + wrap.clientHeight) / ROW) + BUF);
    if (!force && start === state.range[0] && end === state.range[1]) return;
    state.range = [start, end];
    const spacer = (px) => px > 0 ? `<tr class="spacer"><td colspan="5" style="height:${px}px"></td></tr>` : '';
    let html = '';
    if (!n) html = `<tr class="spacer"><td colspan="5" class="no-match">${state.entries.length ? 'No entries match your search.' : ''}</td></tr>`;
    else {
      html = spacer(start * ROW);
      for (let i = start; i < end; i++) html += rowHtml(state.view[i], i, start);
      html += spacer((n - end) * ROW);
    }
    $('#dataBody').innerHTML = html;
    state.enter = false; state.anim.clear(); state.flashId = null; state.flashSet.clear();
  }

  function chrome() {
    const leaves = state.view.reduce((a, e) => a + (e.group ? 0 : 1), 0);
    $('#fileName').textContent = state.fileName;
    $('#fileMeta').textContent = `${state.total.toLocaleString()} values${state.undo.length ? ' · edited' : ''}`;
    $('#resultText').textContent = state.flat ? `${leaves.toLocaleString()} of ${state.total.toLocaleString()} values` : `${state.total.toLocaleString()} values`;
    const groups = state.entries.some((e) => e.group), anyOpen = state.entries.some((e) => e.group && !state.collapsed.has(e.id));
    const folding = !groups || state.flat;
    $('#collapseBtn').hidden = $('#openBtn').hidden = folding;
    $('#collapseBtn').disabled = !anyOpen; $('#openBtn').disabled = state.entries.every((e) => !e.group || !state.collapsed.has(e.id));
    const slots = state.entries.filter((e) => e.parent === STATS_PARENT && e.alias && !e.group && /^\d+$/.test(e.key) && Number.isFinite(Number(e.value)));
    const main = SUMMARY.map((k) => slots.find((e) => e.key === String(k))).filter(Boolean);
    const extra = slots.filter((e) => !main.includes(e)).sort((x, y) => x.key - y.key);
    const chip = (e) => `<button class="chip" data-id="${esc(e.id)}" data-q="${esc(e.alias)}" title="Show ${esc(e.alias)} (key ${esc(e.key)})"><span>${esc(e.alias)}</span><b>${esc(Number(e.value).toLocaleString())}</b></button>`;
    const bar = $('#statsBar');
    bar.hidden = !main.length;
    bar.innerHTML = main.map(chip).join('') + (state.moreStats ? extra.map(chip).join('') : '') + (extra.length ? `<button class="chip chip-more" data-more="1">${state.moreStats ? 'Show less' : `+${extra.length} more`}</button>` : '');
    $('#undoBtn').disabled = !state.undo.length; $('#redoBtn').disabled = !state.redo.length;
    selChrome(); warnChrome();
  }
  const MOD_KEYS = ['hasRP', 'hasDRP', 'isMod'];
  const modFlags = () => state.entries.filter((e) => e.depth === 0 && !e.group && MOD_KEYS.includes(e.key) && e.value !== '' && e.value !== '0' && e.value !== 'false');
  function warnChrome() {
    const flags = state.warnHidden ? [] : modFlags();
    $('#warnBar').hidden = !flags.length;
    if (flags.length) $('#warnText').textContent = `This save has moderator flags set (${flags.map((e) => `${e.key} = ${e.value}`).join(', ')}). They give comment-deleting and rating tools in the game. Reset them if you did not expect this.`;
  }
  const shownLeaves = () => state.view.filter((e) => !e.group);
  function selChrome() {
    for (const id of state.sel) if (!state.byId.has(id)) state.sel.delete(id);
    const n = state.sel.size, shown = shownLeaves(), inView = shown.filter((e) => state.sel.has(e.id)).length;
    $('#selBar').hidden = !n;
    $('#selCount').textContent = `${n.toLocaleString()} selected`;
    const all = $('#selAll'); all.checked = !!shown.length && inView === shown.length; all.indeterminate = inView > 0 && inView < shown.length;
    $('#selVisibleBtn').disabled = !shown.length || inView === shown.length;
  }
  function refresh(resetScroll) {
    computeView();
    const wrap = $('#tableWrap');
    if (resetScroll) wrap.scrollTop = 0; else wrap.scrollTop = Math.min(wrap.scrollTop, Math.max(0, state.view.length * ROW - wrap.clientHeight));
    chrome(); render(true);
  }
  function reindex() {
    state.byId = new Map(state.entries.map((e) => [e.id, e]));
    state.total = state.entries.reduce((a, e) => a + (e.group ? 0 : 1), 0);
  }

    const bump = (item, d) => { const g = state.byId.get(item.parent); if (g) g.count += d; };
  const leavesOf = (items) => items.reduce((n, e) => n + (e.group ? 0 : 1), 0);
  function blockOf(item) {
    const index = state.entries.indexOf(item);
    let end = index + 1;
    while (end < state.entries.length && state.entries[end].depth > item.depth) end++;
    return { index, items: state.entries.slice(index, end) };
  }
  function insertBlock(op) {
    state.entries.splice(op.index, 0, ...op.items);
    for (const it of op.items) state.byId.set(it.id, it);
    state.total += leavesOf(op.items); bump(op.items[0], 1);
  }
  function removeBlock(op) {
    const i = state.entries.indexOf(op.items[0]);
    if (i >= 0) state.entries.splice(i, op.items.length);
    for (const it of op.items) state.byId.delete(it.id);
    state.total -= leavesOf(op.items); bump(op.items[0], -1);
  }
  function record(op) { state.undo.push(op); if (state.undo.length > 200) state.undo.shift(); state.redo = []; }
  function apply(op, undo) {
    if (op.t === 'multi') {
      for (const x of op.edits) { const e = state.byId.get(x.id); if (!e) continue; e.value = undo ? x.old : x.new; e.type = classify(e.tag, e.value); state.flashSet.add(e.id); }
    } else if (op.t === 'edit') {
      const e = state.byId.get(op.id); if (!e) return;
      e.value = undo ? op.old : op.new; e.type = classify(e.tag, e.value); state.flashId = e.id;
    } else if ((op.t === 'del') === undo) insertBlock(op);
    else removeBlock(op);
  }
  function step(from, to, undo) {
    const op = from.pop(); if (!op) return;
    apply(op, undo); to.push(op); refresh();
  }

    function toggleGroup(g) {
    const opening = state.collapsed.has(g.id);
    if (opening) state.collapsed.delete(g.id); else state.collapsed.add(g.id);
    computeView();
    if (opening) {
      const i = state.view.indexOf(g);
      for (let j = i + 1; j <= i + 12 && state.view[j] && state.view[j].depth > g.depth; j++) state.anim.add(state.view[j].id);
    }
    chrome(); render(true);
  }
  $('#collapseBtn').addEventListener('click', () => {
    state.collapsed = new Set(state.entries.filter((e) => e.group).map((e) => e.id));
    refresh(true);
  });
  $('#openBtn').addEventListener('click', () => {
    state.collapsed = new Set();
    refresh(true);
  });

  async function openFile(file) {
    if (!file) return;
    try {
      const { xml, container } = await GDCodec.decode(await file.arrayBuffer());
      const entries = parse(xml);
      state.sel = new Set(); state.lastSel = null; state.warnHidden = false;
      Object.assign(state, { fileName: file.name, xml, container, entries, undo: [], redo: [], q: '', type: 'all', focusId: null, enter: true, collapsed: new Set(entries.filter((e) => e.group && e.depth >= 1).map((e) => e.id)) });
      reindex();
      $('#searchInput').value = ''; $('#typeFilter').value = 'all';
      const first = !document.body.classList.contains('has-file');
      if (first) { $('#dropZone').classList.add('out'); setTimeout(() => ($('#dropZone').hidden = true), 380); }
      document.body.classList.add('has-file');
      const panel = $('#dataPanel'); panel.hidden = false; panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
      refresh(true); toast(`Decoded ${state.total.toLocaleString()} values`);
    } catch (err) { toast(err.message || 'Unable to read this file'); }
  }

  function buildXml() {
    const doc = new DOMParser().parseFromString(state.xml, 'application/xml'), root = rootOf(doc), dicts = new Map([['', root]]);
    walk(root, '', 0, ({ id, keyNode, valueNode }) => {
      const e = state.byId.get(id);
      if (!e || e.added) { keyNode.remove(); valueNode.remove(); return false; }
      if (e.group) { dicts.set(id, valueNode); return; }
      const tag = tagOf(valueNode);
      if (['t', 'f', 'true', 'false'].includes(tag)) {
        const want = e.value === 'true' ? 't' : 'f';
        if (tag !== want) valueNode.replaceWith(doc.createElement(want));
      } else if (valueNode.textContent !== e.value) valueNode.textContent = e.value;
      return false;
    });
    for (const e of state.entries) {
      const parent = e.added && dicts.get(e.parent); if (!parent) continue;
      const sample = Array.from(parent.children).find(isKey) || Array.from(root.querySelectorAll('k, key'))[0];
      const keyNode = doc.createElement(sample ? tagOf(sample) : 'k'); keyNode.textContent = e.key;
      const valueNode = doc.createElement(e.group ? tagOf(root) : e.type === 'bool' ? (e.value === 'true' ? 't' : 'f') : e.tag);
      if (!e.group && e.type !== 'bool') valueNode.textContent = e.value;
      parent.append(keyNode, valueNode);
      if (e.group) dicts.set(e.id, valueNode);
    }
    return '<?xml version="1.0"?>' + new XMLSerializer().serializeToString(doc.documentElement);
  }
  function xmlToJson(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const conv = (n) => {
      const tag = tagOf(n);
      if (isDict(n)) {
        const o = {}, kids = Array.from(n.children);
        for (let i = 0; i < kids.length; i++) {
          if (!isKey(kids[i]) || !kids[i + 1]) continue;
          let k = kids[i].textContent || '', c = 2; const base = k;
          while (k in o) k = `${base}#${c++}`;
          o[k] = conv(kids[++i]);
        }
        return o;
      }
      if (tag === 't' || tag === 'true') return true;
      if (tag === 'f' || tag === 'false') return false;
      const v = n.textContent ?? '';
      if (tag === 'i' || tag === 'r') { const x = Number(v); return v.trim() !== '' && Number.isFinite(x) && (tag === 'r' || Number.isSafeInteger(x)) ? x : v; }
      return v;
    };
    return JSON.stringify(conv(rootOf(doc)), null, 2);
  }
  function download(bytes, name, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const baseName = () => state.fileName.replace(/\.[^.]+$/, '') || 'save';

    $('#dataBody').addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-id]'); if (!tr) return;
    const item = state.byId.get(tr.dataset.id); if (!item) return;
    if (ev.target.closest('.sel-box')) return toggleSel(item, ev.target.checked, ev.shiftKey);
    if (ev.target.closest('.add')) return openAdd(item.id);
    if (ev.target.closest('.delete')) {
      tr.classList.add('leaving');
      setTimeout(() => {
        const op = { t: 'del', ...blockOf(item) };
        record(op); apply(op, false); refresh();
        toast(item.group ? `Group deleted (${leavesOf(op.items).toLocaleString()} values)` : 'Entry deleted');
      }, 220);
    } else if (item.group) toggleGroup(item);
    else if (ev.target.closest('.edit')) {
      state.editingId = item.id; $('#editKey').value = item.key; $('#editValue').value = item.value;
      $('#editTitle').textContent = `Edit ${item.key}`; $('#editError').textContent = ''; $('#editDialog').showModal();
    }
  });
  const invalid = (tag, v) => tag === 'i' && !/^-?\d+$/.test(v) ? 'This value must be a whole number.'
    : tag === 'r' && !/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v) ? 'This value must be a number.'
    : tag === 'b' && !['true', 'false'].includes(v) ? 'Use true or false.' : '';

  function openAdd(parentId) {
    const groups = state.entries.filter((e) => e.group && (e.depth === 0 || e.id === parentId));
    const label = (e) => (e.alias ? `${e.key} · ${e.alias}` : e.key);
    $('#addParent').innerHTML = '<option value="">Top level</option>' + groups.map((e) => `<option value="${esc(e.id)}">${esc(e.depth ? e.id.replace(/#\d+/g, '') : label(e))}</option>`).join('');
    $('#addParent').value = parentId || '';
    $('#addKey').value = ''; $('#addValue').value = ''; $('#addBool').value = 'true'; $('#addType').value = 's';
    $('#addError').textContent = ''; syncAddType(); $('#addDialog').showModal(); $('#addKey').focus();
  }
  function syncAddType() {
    const t = $('#addType').value;
    $('#addValueWrap').hidden = t === 'd' || t === 'b'; $('#addBoolWrap').hidden = t !== 'b';
  }
  $('#addType').addEventListener('change', syncAddType);
  $('#addKeyBtn').addEventListener('click', () => openAdd(''));
  $('#addForm').addEventListener('submit', (ev) => {
    if (ev.submitter?.id !== 'saveAddBtn') return;
    ev.preventDefault();
    const parentId = $('#addParent').value, parent = parentId ? state.byId.get(parentId) : null, key = $('#addKey').value.trim(), t = $('#addType').value;
    const v = t === 'b' ? $('#addBool').value : t === 'd' ? '' : $('#addValue').value;
    const bad = !key ? 'Enter a key name.'
      : state.entries.some((e) => e.parent === parentId && e.key === key) ? 'This group already has a key with that name.'
      : invalid(t, v);
    if (bad) { $('#addError').textContent = bad; return; }
    $('#addDialog').close();
    const id = `${parentId}/${key}#0`, alias = GDAliases.of(parentId, key, parent ? parent.depth + 1 : 0);
    const tag = t === 'b' ? (v === 'true' ? 't' : 'f') : t === 'd' ? tagOf(rootOf(new DOMParser().parseFromString(state.xml, 'application/xml'))) : t;
    const base = { id, key, depth: parent ? parent.depth + 1 : 0, parent: parentId, alias, kl: key.toLowerCase(), al: alias.toLowerCase(), tag, added: true };
    const item = t === 'd' ? { ...base, group: true, type: 'group', value: '', count: 0 } : { ...base, group: false, value: v, type: classify(tag, v) };
    let index = state.entries.length;
    if (parent) index = blockOf(parent).index + blockOf(parent).items.length;
    const op = { t: 'add', index, items: [item] };
    record(op); apply(op, false);
    state.collapsed.delete(parentId); state.q = ''; state.type = 'all'; state.focusId = null; state.flashId = id;
    $('#searchInput').value = ''; $('#typeFilter').value = 'all';
    refresh();
    const at = state.view.indexOf(item), wrap = $('#tableWrap');
    if (at >= 0) { wrap.scrollTop = Math.max(0, at * ROW - wrap.clientHeight / 2); state.flashId = id; render(true); }
    toast(`Added ${key}`);
  });

  $('#editForm').addEventListener('submit', (ev) => {
    if (ev.submitter?.id !== 'saveEditBtn') return;
    ev.preventDefault();
    const item = state.byId.get(state.editingId); if (!item) return;
    const v = $('#editValue').value;
    const bad = invalid(item.type === 'bool' ? 'b' : item.tag, v);
    if (bad) { $('#editError').textContent = bad; return; }
    $('#editDialog').close();
    if (v === item.value) return;
    const op = { t: 'edit', id: item.id, old: item.value, new: v };
    record(op); apply(op, false); refresh(); toast('Value updated');
  });
  /* ---- help + moderator flag safety ---- */
  const HELP_URL = 'https://github.com/itzhunggisagoner/GDSaveEditor/blob/main/HELP.md';
  $('#helpBtn').addEventListener('click', () => { $('#helpUrl').textContent = HELP_URL; $('#helpDialog').showModal(); });
  $('#helpDialog form').addEventListener('submit', (ev) => {
    if (ev.submitter?.id === 'helpOpenBtn') window.open(HELP_URL, '_blank', 'noopener');
  });
  $('#warnHideBtn').addEventListener('click', () => { state.warnHidden = true; warnChrome(); });
  $('#warnFixBtn').addEventListener('click', () => {
    const edits = modFlags().map((e) => ({ id: e.id, old: e.value, new: e.type === 'bool' ? 'false' : '0' }));
    if (!edits.length) return;
    const op = { t: 'multi', edits }; record(op); apply(op, false); refresh(); toast('Moderator flags reset');
  });

  /* ---- multi-select + bulk edit ---- */
  function toggleSel(item, on, range) {
    if (range && state.lastSel && state.lastSel !== item.id) {
      const a = state.view.findIndex((e) => e.id === state.lastSel), b = state.view.indexOf(item);
      if (a >= 0 && b >= 0) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) { const e = state.view[i]; if (!e.group) on ? state.sel.add(e.id) : state.sel.delete(e.id); }
        state.lastSel = item.id; selChrome(); return render(true);
      }
    }
    on ? state.sel.add(item.id) : state.sel.delete(item.id);
    state.lastSel = item.id; selChrome();
    const tr = $('#dataBody').querySelector(`tr[data-id="${CSS.escape(item.id)}"]`); if (tr) tr.classList.toggle('selected', on);
  }
  function selectShown(on) {
    for (const e of shownLeaves()) on ? state.sel.add(e.id) : state.sel.delete(e.id);
    selChrome(); render(true);
  }
  $('#selAll').addEventListener('change', (e) => selectShown(e.target.checked));
  $('#selVisibleBtn').addEventListener('click', () => selectShown(true));
  $('#selClearBtn').addEventListener('click', () => { state.sel.clear(); state.lastSel = null; selChrome(); render(true); });

  const selItems = () => state.entries.filter((e) => !e.group && state.sel.has(e.id));
  const isNum = (e) => e.type === 'number' && Number.isFinite(Number(e.value));
  const isInt = (e) => e.tag === 'i' || (e.tag !== 'r' && /^-?\d+$/.test(e.value));
  function bulkPlan() {
    const items = selItems(), mode = $('#bulkMode').value, allBool = items.length && items.every((e) => e.type === 'bool');
    const raw = allBool ? $('#bulkBool').value : $('#bulkValue').value, plan = [], skipped = [];
    const operand = Number(raw);
    for (const e of items) {
      let v;
      if (mode === 'set') v = raw;
      else {
        if (!isNum(e)) { skipped.push(e); continue; }
        const cur = Number(e.value);
        v = String(mode === 'add' ? cur + operand : mode === 'sub' ? cur - operand : cur * operand);
        if (isInt(e)) { const r = Math.round(Number(v)); if (!Number.isSafeInteger(r)) { skipped.push(e); continue; } v = String(r); }
        else if (!Number.isFinite(Number(v))) { skipped.push(e); continue; }
      }
      if (invalid(e.type === 'bool' ? 'b' : e.tag, v)) { skipped.push(e); continue; }
      if (v !== e.value) plan.push({ id: e.id, old: e.value, new: v });
    }
    return { items, plan, skipped, mode, raw };
  }
  function bulkSync() {
    const items = selItems(), nums = items.filter(isNum).length, allBool = items.length && items.every((e) => e.type === 'bool');
    const mode = $('#bulkMode');
    for (const o of mode.options) if (o.value !== 'set') o.disabled = !nums;
    if (!nums && mode.value !== 'set') mode.value = 'set';
    $('#bulkBoolWrap').hidden = !(allBool && mode.value === 'set'); $('#bulkValueWrap').hidden = allBool && mode.value === 'set';
    $('#bulkValue').placeholder = mode.value === 'set' ? '' : 'Number';
    const { plan, skipped, raw, mode: m } = bulkPlan();
    $('#bulkPreview').textContent = m !== 'set' && (raw.trim() === '' || !Number.isFinite(Number(raw))) ? 'Enter a number.'
      : `Will change ${plan.length.toLocaleString()} value${plan.length === 1 ? '' : 's'}${skipped.length ? `, skip ${skipped.length.toLocaleString()} (not valid for that type)` : ''}.`;
    $('#bulkError').textContent = '';
  }
  function openBulk() {
    const items = selItems(); if (!items.length) return;
    const c = { number: 0, text: 0, bool: 0, empty: 0 }; for (const e of items) c[e.type]++;
    $('#bulkTitle').textContent = `Edit ${items.length.toLocaleString()} values`;
    $('#bulkInfo').textContent = [c.number && `${c.number.toLocaleString()} numbers`, c.text && `${c.text.toLocaleString()} text`, c.bool && `${c.bool.toLocaleString()} booleans`, c.empty && `${c.empty.toLocaleString()} empty`].filter(Boolean).join(' · ');
    $('#bulkMode').value = 'set'; $('#bulkValue').value = ''; $('#bulkBool').value = 'true';
    bulkSync(); $('#bulkDialog').showModal();
  }
  $('#bulkEditBtn').addEventListener('click', openBulk);
  for (const id of ['#bulkMode', '#bulkValue', '#bulkBool']) { $(id).addEventListener('input', bulkSync); $(id).addEventListener('change', bulkSync); }
  $('#bulkForm').addEventListener('submit', (ev) => {
    if (ev.submitter?.id !== 'saveBulkBtn') return;
    ev.preventDefault();
    const { plan, skipped, mode, raw } = bulkPlan();
    if (mode !== 'set' && (raw.trim() === '' || !Number.isFinite(Number(raw)))) { $('#bulkError').textContent = 'Enter a number.'; return; }
    if (!plan.length) { $('#bulkError').textContent = skipped.length ? 'The value is not valid for the selected entries.' : 'Nothing would change.'; return; }
    $('#bulkDialog').close();
    const op = { t: 'multi', edits: plan };
    record(op); apply(op, false); refresh();
    toast(`Updated ${plan.length.toLocaleString()} value${plan.length === 1 ? '' : 's'}${skipped.length ? ` · skipped ${skipped.length.toLocaleString()}` : ''}`);
  });

  $('#exportDatBtn').addEventListener('click', async () => {
    try {
      download(await GDCodec.encode(buildXml(), state.container), `${baseName()}.edited.dat`, 'application/octet-stream');
      toast('Exported .dat · rename it to the original file name to use it');
    } catch (e) { toast(e.message || 'Export failed'); }
  });
  $('#exportJsonBtn').addEventListener('click', () => {
    try { download(xmlToJson(buildXml()), `${baseName()}.json`, 'application/json;charset=utf-8'); toast('JSON exported'); }
    catch (e) { toast(e.message || 'Export failed'); }
  });
  $('#exportXmlBtn').addEventListener('click', () => { download(buildXml(), `${baseName()}.xml`, 'application/xml;charset=utf-8'); toast('XML exported'); });
  for (const id of ['#browseBtn', '#dropBrowse']) $(id).addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => { openFile(e.target.files[0]); e.target.value = ''; });

  $('#statsBar').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip'); if (!chip) return;
    if (chip.dataset.more) { state.moreStats = !state.moreStats; return chrome(); }
    $('#searchInput').value = chip.dataset.q; state.q = ''; state.focusId = chip.dataset.id; refresh(true);
  });
  let timer;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.focusId = null; state.q = e.target.value.trim().toLowerCase(); refresh(true); }, 120);
  });
  $('#typeFilter').addEventListener('change', (e) => { state.focusId = null; state.type = e.target.value; refresh(true); });
  $('#undoBtn').addEventListener('click', () => step(state.undo, state.redo, true));
  $('#redoBtn').addEventListener('click', () => step(state.redo, state.undo, false));

  let raf = 0;
  const schedule = (force) => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(force); }); };
  $('#tableWrap').addEventListener('scroll', () => schedule(false), { passive: true });
  new ResizeObserver(() => schedule(true)).observe($('#tableWrap'));

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); openFile(e.dataTransfer.files[0]); });

  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); $('#searchInput').focus(); }
    if (e.key === 'Escape' && !typing && state.sel.size && !document.querySelector('dialog[open]')) { state.sel.clear(); state.lastSel = null; selChrome(); render(true); return; }
    if (!(e.ctrlKey || e.metaKey) || typing) return;
    const k = e.key.toLowerCase();
    if (k === 'a' && state.entries.length) { e.preventDefault(); selectShown(true); return; }
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); step(state.undo, state.redo, true); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); step(state.redo, state.undo, false); }
  });
})();

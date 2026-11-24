/* In-place post editor.
   Adds a "编辑本文" pill to post pages; clicking it opens the article's own
   Markdown in a rich editor right on top of the page, and saves it back to the
   same file in GitHub (same sha, so no duplicate file).
   Requires a GitHub token stored in localStorage under "blog_gh_token". */
(function () {
  'use strict';

  var REPO = '54786569358/54786569358.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + REPO + '/contents/';
  var TOKEN_KEY = 'blog_gh_token';

  var m = /^\/posts\/([^\/]+)\/?$/.exec(location.pathname);
  if (!m) { return; }
  var slug = m[1];

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function b64decode(s) {
    var bin = atob(String(s).replace(/\s/g, ''));
    try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token()
    }, opts.headers || {});
    return fetch(API.replace(/\/contents\/$/, '/') + path, opts);
  }

  /* ---------- the pill ---------- */
  var pill = document.createElement('a');
  pill.href = '#';
  pill.id = 'edit-pill';
  pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
  pill.style.cssText = 'display:inline-block;margin:.85rem 0 0;font-size:.85rem;padding:.35rem .85rem;' +
    'border:1px solid var(--border);border-radius:999px;color:var(--secondary);text-decoration:none;' +
    'cursor:pointer;user-select:none';
  pill.title = token() ? '\u5728\u5f53\u524d\u9875\u9762\u76f4\u63a5\u4fee\u6539' : '\u9700\u8981\u5148\u8f93\u5165 GitHub \u4ee4\u724c';
  pill.addEventListener('click', function (e) { e.preventDefault(); start(); });

  var anchor = document.querySelector('.post-header');
  if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(pill, anchor.nextSibling); }
  else {
    var c = document.querySelector('.post-content');
    if (c) { c.parentNode.insertBefore(pill, c); } else { return; }
  }

  /* ---------- helpers ---------- */
  function loadToast() {
    return new Promise(function (resolve, reject) {
      if (window.toastui && window.toastui.Editor) { resolve(window.toastui); return; }
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://uicdn.toast.com/editor/latest/toastui-editor.min.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = 'https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js';
      js.onload = function () { resolve(window.toastui); };
      js.onerror = function () { reject(new Error('toast ui load failed')); };
      document.head.appendChild(js);
    });
  }

  function note(text, kind) {
    var n = document.getElementById('edit-note');
    if (!n) { return; }
    n.textContent = text;
    n.style.color = kind === 'err' ? '#f2637b' : (kind === 'ok' ? '#3fb950' : 'var(--secondary)');
  }

  function splitFrontMatter(text) {
    var mm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
    if (!mm) { return { front: '', body: text }; }
    return { front: mm[0], body: text.slice(mm[0].length) };
  }

  /* ---------- main ---------- */
  function start() {
    if (!token()) {
      location.href = '/admin/?slug=' + encodeURIComponent(slug);
      return;
    }
    pill.textContent = '\u6b63\u5728\u8bfb\u53d6\u2026';

    api('content/posts?ref=' + BRANCH).then(function (r) { return r.json(); }).then(function (items) {
      if (!Array.isArray(items)) { throw new Error('list failed'); }
      var hit = null;
      items.forEach(function (it) {
        if (!/\.md$/.test(it.name)) { return; }
        var base = it.name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
        if (base === slug) { hit = it; }
      });
      if (!hit) { throw new Error('post not found'); }
      return api(hit.path + '?ref=' + BRANCH).then(function (r) { return r.json(); })
        .then(function (f) { return { path: hit.path, sha: f.sha, text: b64decode(f.content) }; });
    }).then(function (file) {
      openEditor(file);
    }).catch(function (err) {
      pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
      alert('\u6253\u5f00\u5931\u8d25\uff1a' + err.message + '\n\u4ee4\u724c\u53ef\u80fd\u8fc7\u671f\uff0c\u53ef\u4ee5\u5230 /admin \u91cd\u65b0\u8fde\u63a5\u3002');
    });
  }

  function openEditor(file) {
    var parts = splitFrontMatter(file.text);
    var titleFromH1 = (document.querySelector('.post-title') || {}).textContent || '';

    var mask = document.createElement('div');
    mask.id = 'edit-mask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;';

    var panel = document.createElement('div');
    panel.id = 'edit-panel';
    panel.style.cssText = 'position:fixed;inset:2.5vh 1vw;z-index:9999;background:var(--theme);' +
      'border:1px solid var(--border);border-radius:14px;display:flex;flex-direction:column;' +
      'box-shadow:0 18px 60px rgba(0,0,0,.45);overflow:hidden';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;' +
      'border-bottom:1px solid var(--border);flex-wrap:wrap';
    var label = document.createElement('strong');
    label.textContent = '\u7f16\u8f91\uff1a' + (titleFromH1.trim() || file.path);
    label.style.cssText = 'font-size:.95rem;flex:1 1 auto;min-width:0;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap';
    var state = document.createElement('span');
    state.id = 'edit-note';
    state.style.cssText = 'font-size:.82rem;color:var(--secondary)';
    state.textContent = '\u6b63\u5728\u7f16\u8f91 ' + file.path;

    var btnSave = mkBtn('\u4fdd\u5b58', true);
    var btnClose = mkBtn('\u5173\u95ed', false);
    bar.appendChild(label);
    bar.appendChild(state);
    bar.appendChild(btnSave);
    bar.appendChild(btnClose);

    var host = document.createElement('div');
    host.style.cssText = 'flex:1 1 auto;min-height:0;padding:.4rem';

    panel.appendChild(bar);
    panel.appendChild(host);
    document.body.appendChild(mask);
    document.body.appendChild(panel);

    function mkBtn(text, primary) {
      var b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'font-size:.85rem;padding:.42rem 1rem;border-radius:9px;cursor:pointer;' +
        (primary
          ? 'background:var(--accent);color:#fff;border:1px solid var(--accent)'
          : 'background:transparent;color:var(--fg);border:1px solid var(--border)');
      return b;
    }

    function close() {
      mask.remove();
      panel.remove();
      pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
    }

    mask.addEventListener('click', close);
    btnClose.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    note('\u52a0\u8f7d\u7f16\u8f91\u5668\u2026');
    loadToast().then(function (toastui) {
      var editor = new toastui.Editor({
        el: host,
        height: '100%',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        usageStatistics: false,
        language: 'zh-CN',
        initialValue: parts.body.replace(/^\s+/, ''),
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task', 'indent', 'outdent'],
          ['table', 'image', 'link'],
          ['code', 'codeblock']
        ]
      });
      note('\u6b63\u5728\u7f16\u8f91 ' + file.path);

      btnSave.addEventListener('click', function () {
        var body = editor.getMarkdown().replace(/\s+$/, '') + '\n';
        var full = parts.front + body;
        btnSave.disabled = true;
        note('\u4fdd\u5b58\u4e2d\u2026');
        api(file.path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'edit: ' + (titleFromH1.trim() || slug) + ' (in-place editor)',
            content: b64encode(full),
            sha: file.sha,
            branch: BRANCH
          })
        }).then(function (r) {
          if (!r.ok) { return r.json().then(function (j) { throw new Error(j.message || ('HTTP ' + r.status)); }); }
          note('\u5df2\u4fdd\u5b58\uff0c\u7ea6 40 \u79d2\u540e\u7ebf\u4e0a\u751f\u6548\uff08Ctrl+F5 \u5237\u65b0\u770b\uff09', 'ok');
          btnSave.textContent = '\u5df2\u4fdd\u5b58';
        }).catch(function (err) {
          btnSave.disabled = false;
          note('\u4fdd\u5b58\u5931\u8d25\uff1a' + err.message, 'err');
        });
      });
    }).catch(function () {
      note('\u7f16\u8f91\u5668\u52a0\u8f7d\u5931\u8d25\uff0c\u6539\u7528 /admin \u9875\u9762\u7f16\u8f91\u3002', 'err');
    });
  }
})();

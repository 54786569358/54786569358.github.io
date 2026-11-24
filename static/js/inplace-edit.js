/* In-place post editor.
   Adds an "编辑本文" pill under the post title. Clicking it opens the article's
   own Markdown in a rich editor as an overlay on the same page, and saves it
   back to the same file in GitHub (same sha, so no duplicate file).
   Token is stored in localStorage under "blog_gh_token"; if absent the overlay
   asks for it once, right there. */
(function () {
  'use strict';

  var OWNER = '54786569358';
  var REPO_NAME = '54786569358.github.io';
  var BRANCH = 'main';
  var API_ROOT = 'https://api.github.com/repos/' + OWNER + '/' + REPO_NAME + '/contents/';
  var TOKEN_KEY = 'blog_gh_token';

  var m = /^\/posts\/([^\/]+)\/?$/.exec(location.pathname);
  if (!m) { return; }
  var slug = m[1];

  function token() {
    try { return (localStorage.getItem(TOKEN_KEY) || '').trim(); } catch (e) { return ''; }
  }
  function setToken(t) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }

  function b64decode(s) {
    var bin = atob(String(s).replace(/\s/g, ''));
    try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
  }
  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }

  /* path is relative to <repo>/contents/, e.g. "content/posts/foo.md" */
  function api(path, opts, tries) {
    tries = tries == null ? 2 : tries;
    opts = opts || {};
    opts.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token()
    }, opts.headers || {});
    var url = API_ROOT + path;
    return fetch(url, opts).catch(function (err) {
      if (tries <= 0) {
        err.requestUrl = url;
        throw err;
      }
      return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return api(path, opts, tries - 1); });
    });
  }

  function describe(err) {
    if (!err) { return '未知错误'; }
    if (err.status) { return 'HTTP ' + err.status + (err.detail ? '：' + err.detail : ''); }
    return (err.message || String(err)) + (err.requestUrl ? '\n请求地址：' + err.requestUrl : '');
  }

  function jsonOrThrow(r) {
    return r.text().then(function (t) {
      var j = null;
      try { j = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) {
        var e = new Error('HTTP ' + r.status);
        e.status = r.status;
        e.detail = (j && j.message) || t.slice(0, 140);
        throw e;
      }
      return j;
    });
  }

  /* ---------- pill ---------- */
  var pill = document.createElement('a');
  pill.href = '#';
  pill.id = 'edit-pill';
  pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
  pill.style.cssText = 'display:inline-block;margin:.85rem 0 0;font-size:.85rem;padding:.35rem .85rem;' +
    'border:1px solid var(--border);border-radius:999px;color:var(--secondary);text-decoration:none;' +
    'cursor:pointer;user-select:none';
  pill.title = '\u5728\u5f53\u524d\u9875\u9762\u76f4\u63a5\u4fee\u6539\u8fd9\u7bc7\u6587\u7ae0';
  pill.addEventListener('click', function (e) { e.preventDefault(); start(); });

  var anchor = document.querySelector('.post-header');
  if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(pill, anchor.nextSibling); }
  else {
    var c = document.querySelector('.post-content');
    if (c) { c.parentNode.insertBefore(pill, c); } else { return; }
  }

  /* ---------- ui helpers ---------- */
  function mkBtn(text, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText = 'font-size:.85rem;padding:.42rem 1rem;border-radius:9px;cursor:pointer;' +
      (primary ? 'background:var(--accent);color:#fff;border:1px solid var(--accent)'
               : 'background:transparent;color:var(--fg);border:1px solid var(--border)');
    return b;
  }

  function shell(opts) {
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;';

    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;' + (opts.compact ? 'left:50%;top:18vh;transform:translateX(-50%);width:min(560px,94vw)' : 'inset:2.5vh 1vw') +
      ';z-index:9999;background:var(--theme);border:1px solid var(--border);border-radius:14px;' +
      'display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(0,0,0,.45);overflow:hidden';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;' +
      'border-bottom:1px solid var(--border);flex-wrap:wrap';

    var title = document.createElement('strong');
    title.textContent = opts.title || '';
    title.style.cssText = 'font-size:.95rem;flex:1 1 auto;min-width:0;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap';

    var note = document.createElement('span');
    note.style.cssText = 'font-size:.82rem;color:var(--secondary)';

    var body = document.createElement('div');
    body.style.cssText = 'flex:1 1 auto;min-height:0;padding:.9rem;overflow:auto';

    bar.appendChild(title);
    bar.appendChild(note);
    (opts.buttons || []).forEach(function (b) { bar.appendChild(b); });
    panel.appendChild(bar);
    panel.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(panel);

    function close() { mask.remove(); panel.remove(); }
    mask.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    return { mask: mask, panel: panel, bar: bar, body: body, note: note, close: close };
  }

  /* ---------- token gate ---------- */
  function askToken() {
    return new Promise(function (resolve) {
      var btnOk = mkBtn('\u8fde\u63a5', true);
      var btnNo = mkBtn('\u53d6\u6d88', false);
      var ui = shell({ compact: true, title: '\u8fde\u63a5 GitHub\uff08\u53ea\u9700\u4e00\u6b21\uff09', buttons: [btnOk, btnNo] });
      btnNo.addEventListener('click', function () { ui.close(); });
      ui.note.textContent = '';

      var p = document.createElement('p');
      p.style.cssText = 'margin:0 0 .8rem;font-size:.88rem;color:var(--secondary);line-height:1.7';
      p.innerHTML = '\u9700\u8981\u4e00\u679a Fine-grained \u4ee4\u724c\uff0c\u53ea\u7ed9\u8fd9\u4e2a\u4ed3\u5e93\u7684 Contents \u8bfb\u5199\u6743\u3002' +
        '\u6ca1\u6709\u7684\u8bdd <a href="/admin/" style="color:var(--accent)">\u5230\u8fd9\u91cc\u6309 5 \u6b65\u5efa\u4e00\u679a</a>\uff0c\u5efa\u597d\u8d34\u56de\u6765\u5373\u53ef\u3002';

      var input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'github_pat_...';
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:.6rem .75rem;border-radius:9px;' +
        'border:1px solid var(--border);background:var(--entry);color:var(--fg);font-size:.9rem';

      var tip = document.createElement('p');
      tip.style.cssText = 'margin:.6rem 0 0;font-size:.8rem;color:var(--secondary)';
      tip.textContent = '\u4ee4\u724c\u53ea\u5b58\u5728\u8fd9\u4e2a\u6d4f\u89c8\u5668\u7684 localStorage \u91cc\uff0c\u968f\u65f6\u53ef\u4ee5\u5230 GitHub \u64a4\u9500\u3002';

      ui.body.appendChild(p);
      ui.body.appendChild(input);
      ui.body.appendChild(tip);
      setTimeout(function () { input.focus(); }, 50);

      btnOk.addEventListener('click', function () {
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        btnOk.disabled = true;
        ui.note.textContent = '\u9a8c\u8bc1\u4ee4\u724c\u2026';
        fetch('https://api.github.com/user', { headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + v } })
          .then(jsonOrThrow)
          .then(function (u) {
            setToken(v);
            ui.note.textContent = '\u5df2\u8fde\u63a5 ' + (u && u.login);
            setTimeout(function () { ui.close(); resolve(true); }, 350);
          })
          .catch(function (err) {
            btnOk.disabled = false;
            ui.note.textContent = '\u5931\u8d25\uff1a' + describe(err);
          });
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { btnOk.click(); } });
    });
  }

  function ensureToken() {
    if (token()) { return Promise.resolve(true); }
    return askToken();
  }

  /* ---------- toast ui ---------- */
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

  function splitFrontMatter(text) {
    var s = String(text).replace(/^\uFEFF/, '');
    var mm = /^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(s);
    if (!mm) { return { front: '', body: s }; }
    return { front: mm[0], body: s.slice(mm[0].length) };
  }

  /* ---------- flow ---------- */
  function dbg() { /* trace disabled */ }

  function start() {
    pill.textContent = '\u6b63\u5728\u8bfb\u53d6\u2026';
    dbg('start token=' + (token() ? 'yes' : 'no'));
    ensureToken()
      .then(function () { dbg('token ok, listing'); return api('content/posts?ref=' + BRANCH); })
      .then(jsonOrThrow)
      .then(function (items) {
        if (!Array.isArray(items)) { throw new Error('\u6587\u7ae0\u5217\u8868\u683c\u5f0f\u4e0d\u5bf9'); }
        dbg('listed ' + items.length);
        var hit = null;
        items.forEach(function (it) {
          if (!/\.md$/.test(it.name)) { return; }
          var base = it.name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
          if (base === slug) { hit = it; }
        });
        if (!hit) { throw new Error('\u6ca1\u627e\u5230\u5bf9\u5e94\u7684 .md \u6587\u4ef6\uff08' + slug + '\uff09'); }
        return api(hit.path + '?ref=' + BRANCH).then(jsonOrThrow).then(function (f) {
          dbg('file ok ' + hit.path);
          return { path: hit.path, sha: f.sha, text: b64decode(f.content) };
        });
      })
      .then(openEditor)
      .catch(function (err) {
        pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
        dbg('ERR ' + describe(err));
        alert('\u6253\u5f00\u5931\u8d25\uff1a' + describe(err));
      });
  }

  function openEditor(file) {
    var parts = splitFrontMatter(file.text);
    var heading = (document.querySelector('.post-title') || {}).textContent || slug;

    var btnSave = mkBtn('\u4fdd\u5b58', true);
    var btnClose = mkBtn('\u5173\u95ed', false);
    var ui = shell({ title: '\u7f16\u8f91\uff1a' + heading.trim(), buttons: [btnSave, btnClose] });
    btnClose.addEventListener('click', ui.close);
    dbg('editor open ' + file.path);

    ui.note.textContent = '\u52a0\u8f7d\u7f16\u8f91\u5668\u2026';
    loadToast().then(function (toastui) {
      var holder = document.createElement('div');
      holder.style.cssText = 'height:100%';
      ui.body.style.padding = '.4rem';
      ui.body.appendChild(holder);

      var editor = new toastui.Editor({
        el: holder,
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
      ui.note.textContent = file.path;

      btnSave.addEventListener('click', function () {
        var body = editor.getMarkdown().replace(/\s+$/, '') + '\n';
        btnSave.disabled = true;
        ui.note.textContent = '\u4fdd\u5b58\u4e2d\u2026';
        api(file.path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'edit: ' + heading.trim() + ' (in-place editor)',
            content: b64encode(parts.front + body),
            sha: file.sha,
            branch: BRANCH
          })
        }).then(jsonOrThrow).then(function () {
          ui.note.textContent = '\u5df2\u4fdd\u5b58\uff0c\u7ea6 40 \u79d2\u540e\u751f\u6548\uff08Ctrl+F5 \u5237\u65b0\u770b\uff09';
          btnSave.textContent = '\u5df2\u4fdd\u5b58';
        }).catch(function (err) {
          btnSave.disabled = false;
          ui.note.textContent = '\u4fdd\u5b58\u5931\u8d25\uff1a' + describe(err);
        });
      });
    }).catch(function () {
      ui.note.textContent = '\u7f16\u8f91\u5668\u52a0\u8f7d\u5931\u8d25\uff0c\u53ef\u4ee5\u6539\u7528 /admin';
    });

    pill.textContent = '\u270e \u7f16\u8f91\u672c\u6587';
  }

  /* deep link: /posts/<slug>/?edit=1 opens the editor right away */
  if (/[?&]edit=1/.test(location.search)) {
    setTimeout(start, 400);
  }
})();

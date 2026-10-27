'use client';

/**
 * Landing page interactivity, ported from the inline script of
 * client/landing.html: SDK snippet switcher, clipboard copy feedback and
 * the mock REPL. All markup is server-rendered by the landing page; this
 * component only wires behavior onto the stable DOM ids after hydration.
 */

import { useEffect } from 'react';

const ACTIVE_TAB_CLASSES = ['bg-red-600', 'text-white', 'font-semibold', 'active-tab'];
const INACTIVE_TAB_CLASSES = ['text-slate-400'];

export default function LandingScripts() {
  useEffect(() => {
    const unsubscribers = [];
    const timers = [];
    function on(el, type, fn) {
      if (el) el.addEventListener(type, fn);
      if (el) unsubscribers.push(() => el.removeEventListener(type, fn));
    }

    function wire() {
      /* --------------------------- 1. SDK tab switcher --------------------------- */
      const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
      const codeViews = {
        ts: document.getElementById('code-ts'),
        py: document.getElementById('code-py'),
        go: document.getElementById('code-go'),
        curl: document.getElementById('code-curl'),
      };

      tabBtns.forEach((btn) => {
        function onClickTab(event) {
          const tab = event.currentTarget.getAttribute('data-tab');
          tabBtns.forEach((other) => {
            other.classList.remove(...ACTIVE_TAB_CLASSES);
            other.classList.add(...INACTIVE_TAB_CLASSES);
          });
          event.currentTarget.classList.add(...ACTIVE_TAB_CLASSES);
          event.currentTarget.classList.remove(...INACTIVE_TAB_CLASSES);
          Object.keys(codeViews).forEach((key) => {
            if (codeViews[key]) codeViews[key].classList.toggle('hidden', key !== tab);
          });
        }
        on(btn, 'click', onClickTab);
      });

      /* --------------------------- 2. Code copy action --------------------------- */
      const copyCodeBtn = document.getElementById('copy-code-btn');
      if (copyCodeBtn) {
        const iconEl = copyCodeBtn.querySelector('svg');
        const labelEl = copyCodeBtn.querySelector('span');
        const originalLabel = labelEl ? labelEl.textContent : 'Copy';
        function feedback() {
          if (iconEl) iconEl.classList.add('text-emerald-400');
          if (labelEl) labelEl.textContent = 'Copied!';
          timers.push(window.setTimeout(() => {
            if (iconEl) iconEl.classList.remove('text-emerald-400');
            if (labelEl) labelEl.textContent = originalLabel;
          }, 2000));
        }
        function onClickCopyCode() {
          const activeTab = document.querySelector('.active-tab')?.getAttribute('data-tab') || 'ts';
          const activeSnippet = codeViews[activeTab]?.innerText;
          if (activeSnippet) navigator.clipboard.writeText(activeSnippet).then(feedback);
        }
        on(copyCodeBtn, 'click', onClickCopyCode);
      }

      /* ---------------------------- 3. CLI copy action ---------------------------- */
      const copyCliBtn = document.getElementById('copy-cli-btn');
      const cliCopyText = document.getElementById('cli-copy-text');
      if (copyCliBtn && cliCopyText) {
        const command = 'curl -X POST http://localhost:3000/api/data/$DB_ID/command -H "Authorization: Bearer $RK_TOKEN" -d \'{"command":"PING","args":[]}\'';
        function onClickCopyCli() {
          navigator.clipboard.writeText(command).then(() => {
            cliCopyText.textContent = 'Copied!';
            timers.push(window.setTimeout(() => { cliCopyText.textContent = 'Copy'; }, 2000));
          });
        }
        on(copyCliBtn, 'click', onClickCopyCli);
      }

      /* --------------------------- 3b. AI prompt copy ---------------------------- */
      const copyPromptBtn = document.getElementById('copy-prompt-btn');
      const promptCopyText = document.getElementById('prompt-copy-text');
      const prompt = document.getElementById('ai-prompt');
      if (copyPromptBtn && promptCopyText && prompt) {
        function onClickCopyPrompt() {
          if (!prompt.innerText) return;
          navigator.clipboard.writeText(prompt.innerText).then(() => {
            promptCopyText.textContent = 'Copied!';
            timers.push(window.setTimeout(() => { promptCopyText.textContent = 'Copy'; }, 2000));
          });
        }
        on(copyPromptBtn, 'click', onClickCopyPrompt);
      }

      /* ----------------------- 4. Mock REPL execution ----------------------- */
      const replInput = document.getElementById('repl-input');
      const replRunBtn = document.getElementById('repl-run-btn');
      const dynamicRows = document.getElementById('repl-dynamic-rows');
      const quickCmds = Array.from(document.querySelectorAll('.quick-cmd'));

      function executeCommand(cmd) {
        if (!cmd || !cmd.trim()) return;
        const cleanCmd = cmd.trim();
        const parts = cleanCmd.split(' ');
        const action = parts[0].toUpperCase();

        let response = 'OK';
        if (action === 'PING') response = 'PONG';
        else if (action === 'GET') response = `"${parts[1] ? `value_${Math.floor(Math.random() * 1000)}` : 'nil'}"`;
        else if (action === 'INCR') response = `(integer) ${Math.floor(Math.random() * 10000) + 1}`;
        else if (action === 'DBSIZE') response = '(integer) 48,291 keys';
        else if (action === 'SET') response = 'OK';
        else response = `OK [${action} executed]`;
        const latency = (Math.random() * (0.9 - 0.4) + 0.4).toFixed(2);

        const row = document.createElement('div');
        row.className = 'flex items-start justify-between text-slate-300 transition-opacity duration-300 opacity-0';
        const left = document.createElement('div');
        const mark = document.createElement('span');
        mark.className = 'text-red-400 font-bold';
        mark.textContent = '> ';
        const cmdSpan = document.createElement('span');
        cmdSpan.className = 'text-amber-300 font-medium';
        cmdSpan.textContent = cleanCmd;
        left.appendChild(mark);
        left.appendChild(cmdSpan);
        const result = document.createElement('span');
        result.className = 'text-emerald-400 font-code-sm text-code-sm ml-2 font-medium';
        result.textContent = `${response} · ${latency}ms`;
        row.appendChild(left);
        row.appendChild(result);

        if (dynamicRows) {
          dynamicRows.appendChild(row);
          window.requestAnimationFrame(() => row.classList.remove('opacity-0'));
          const terminal = document.getElementById('repl-terminal');
          if (terminal) terminal.scrollTop = terminal.scrollHeight;
        }
        if (replInput) replInput.value = '';
      }

      function onReplRun() { executeCommand(replInput.value); }
      function onReplKey(event) { if (event.key === 'Enter') executeCommand(replInput.value); }
      on(replRunBtn, 'click', onReplRun);
      on(replInput, 'keydown', onReplKey);

      quickCmds.forEach((btn) => {
        function onClickQuick() { executeCommand(btn.textContent); }
        on(btn, 'click', onClickQuick);
      });
    }

    wire();

    return () => {
      unsubscribers.forEach((off) => off());
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}

'use client';

/** Clipboard button with inline success/error state. Used across marketing code. */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../common/Icon.jsx';

export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  className = 'btn btn-secondary btn-sm',
  iconName = 'clipboard',
}) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  async function copy() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setState('copied');
      timerRef.current = window.setTimeout(() => setState('idle'), 1800);
    } catch (_err) {
      setState('error');
      timerRef.current = window.setTimeout(() => setState('idle'), 2200);
    }
  }

  const currentLabel = state === 'copied' ? copiedLabel : state === 'error' ? 'Copy failed' : label;

  return (
    <button type="button" className={className} onClick={() => void copy()} aria-label={`${currentLabel}: ${label.toLowerCase()}`}>
      <Icon name={state === 'copied' ? 'check-lg' : iconName} />
      <span aria-live="polite">{currentLabel}</span>
    </button>
  );
}

'use client';

/**
 * Plaintext-once reveal: the modal shown exactly when an API key is created.
 * Shared by the API keys page and the database detail page so the
 * "shown once, copy it now" behavior stays identical everywhere.
 */

import { Button } from '../../common/atoms.jsx';
import Modal from '../../common/Modal.jsx';
import { Icon } from '../../common/Icon.jsx';
import { showToast, showErrorToast } from '../../common/toasts.js';

export function copyToClipboard(text, successMessage, failureMessage) {
  navigator.clipboard.writeText(text).then(
    () => showToast(successMessage),
    () => showErrorToast(failureMessage),
  );
}

export default function PlaintextReveal({ open, plaintext, onClose }) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      title="API key created"
      onClose={onClose}
      actions={(
        <>
          <Button
            label="Copy to clipboard"
            iconName="clipboard"
            onClick={() => copyToClipboard(plaintext, 'Token copied', 'Copy failed. Select the token and copy manually.')}
          />
          <Button label="Done" variant="primary" onClick={onClose} />
        </>
      )}
    >
      <p style={{ color: 'var(--color-warn)' }}>
        <Icon name="exclamation-triangle" />
        {' Copy this token now. It will not be shown again.'}
      </p>
      <pre className="key-preview" aria-label="API key token">{plaintext}</pre>
    </Modal>
  );
}

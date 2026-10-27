/**
 * Field (label + control + hint/error) and inline validation.
 * Controlled: the page owns value state together with onValueChange, error
 * state lives inside the field. Validation runs on blur when a validate
 * function is given; pages can also force validation or server-side errors
 * through the imperative ref ({ validate, setValidation }).
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

const Field = forwardRef(function Field(
  {
    id,
    label,
    type = 'text',
    value,
    onValueChange,
    hint = null,
    required = false,
    autoComplete = null,
    placeholder = null,
    validate = null,
    textarea = false,
    rows = 6,
    disabled = false,
    onBlur = null,
  },
  ref,
) {
  const [error, setError] = useState('');
  const controlRef = useRef(null);

  function applyMessage(message) {
    setError(message || '');
    return !message;
  }

  useImperativeHandle(ref, () => ({
    /** Runs the static validator now; returns true when the value is valid. */
    validate() {
      return applyMessage(validate ? validate(value) : null);
    },
    /** Displays a server-provided error under the control (keeps user input). */
    setValidation(message) {
      return applyMessage(message);
    },
    /** Moves keyboard focus to the control (after failed submits). */
    focus() {
      if (controlRef.current instanceof HTMLElement) controlRef.current.focus();
    },
  }), [validate, value]);

  function handleBlur(event) {
    if (onBlur) onBlur(event);
    if (validate) applyMessage(validate(event.target.value));
  }

  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  const labelClass = required ? `${label} *` : `${label} (Optional)`;

  return (
    <div className="field">
      <label htmlFor={id}>{labelClass}</label>
      {textarea ? (
        <textarea
          ref={controlRef}
          id={id}
          name={id}
          rows={rows}
          value={value}
          placeholder={placeholder ?? undefined}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <input
          ref={controlRef}
          id={id}
          name={id}
          type={type}
          value={value}
          autoComplete={autoComplete ?? undefined}
          placeholder={placeholder ?? undefined}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={handleBlur}
        />
      )}
      <p className="error-text" id={`${id}-error`} hidden={!error} role="alert">{error}</p>
      {hint ? <p className="hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
});

export default Field;

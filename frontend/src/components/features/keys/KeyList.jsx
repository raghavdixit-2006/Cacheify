'use client';

/**
 * Key list (features/databases): searchable, paginated table of keys in a
 * database. Selection drives the right-hand editor panel (two-panel
 * selector); the detail page owns the selected key.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Spinner } from '../../common/atoms.jsx';
import { listKeys } from '../../../services/databaseService.js';
import { formatBytes, formatTtl } from '../../../utils/format.js';

export default function KeyList({ dbId, selected, onSelect }) {
  const [keys, setKeys] = useState([]);
  const [patternInput, setPatternInput] = useState('');
  const [pattern, setPattern] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); // spinner until the first page paints
  const [loadError, setLoadError] = useState(null);

  const keysRef = useRef([]);
  const cursorRef = useRef(0);
  const patternRef = useRef('');
  const pendingRef = useRef(0);

  async function loadPage({ replace = false } = {}) {
    const sequence = (pendingRef.current += 1);
    setBusy(true);
    try {
      const { data, meta } = await listKeys(dbId, { pattern: patternRef.current, cursor: cursorRef.current, limit: 25 });
      if (sequence !== pendingRef.current) return;
      const now = Date.now();
      const rows = data.keys.map((keyRow) => ({
        ...keyRow,
        ttlMs: keyRow.expiresAt ? Date.parse(keyRow.expiresAt) - now : null,
      }));
      keysRef.current = replace ? rows : keysRef.current.concat(rows);
      cursorRef.current = meta ? meta.cursor : 0;
      setKeys([...keysRef.current]);
      setHasMore(cursorRef.current > 0);
      setLoadError(null);
    } catch (err) {
      if (sequence !== pendingRef.current) return;
      keysRef.current = [];
      setKeys([]);
      setLoadError(err.message || 'Try refreshing.');
    } finally {
      if (sequence === pendingRef.current) setBusy(false);
    }
  }

  async function resetAndLoad() {
    cursorRef.current = 0;
    keysRef.current = [];
    setKeys([]);
    await loadPage({ replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await resetAndLoad();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      /* Invalidate in-flight requests on unmount. */
      pendingRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbId]);

  function commitPattern(next) {
    if ((next.trim() || '') !== patternRef.current) {
      patternRef.current = next.trim();
      setPattern(patternRef.current);
      void resetAndLoad();
    }
  }

  async function selectKey(keyRow) {
    if (onSelect) await onSelect(keyRow);
  }

  const spinner = busy && loading && keys.length === 0 && !loadError;

  return (
    <>
      <div className="page-toolbar">
        <div className="field" style={{ marginBottom: '0', flex: '1' }}>
          <label htmlFor="key-pattern">Filter by pattern</label>
          <input
            type="text"
            id="key-pattern"
            placeholder="user:*, session:*, *"
            value={patternInput}
            onChange={(event) => setPatternInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitPattern(event.target.value);
              }
            }}
            onBlur={(event) => commitPattern(event.target.value)}
          />
        </div>
        <Button
          label="Refresh"
          iconName="arrow-repeat"
          variant="ghost"
          ariaLabel="Refresh key list"
          onClick={() => void resetAndLoad()}
        />
      </div>

      <div aria-busy={busy ? 'true' : 'false'}>
        {spinner ? (
          <Spinner label="Loading keys" />
        ) : loadError ? (
          <EmptyState title="Could not load keys" description={loadError} />
        ) : keys.length === 0 ? (
          <EmptyState
            title={pattern ? 'No keys match the filter' : 'No keys in this database'}
            description={pattern
              ? 'Adjust the pattern (supports * and ?) and refresh.'
              : 'Add keys with the console or from your application.'}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Keys in this database</caption>
                <thead>
                  <tr>
                    {['Key', 'Type', 'Size', 'TTL'].map((cell) => (
                      <th key={cell} scope="col">{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((keyRow) => (
                    <tr
                      key={keyRow.name}
                      tabIndex={0}
                      role="button"
                      aria-label={`Key ${keyRow.name} of type ${keyRow.type}`}
                      className={keyRow.name === selected ? 'is-clickable is-selected' : 'is-clickable'}
                      onClick={() => void selectKey(keyRow)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void selectKey(keyRow);
                        }
                      }}
                    >
                      <td>{keyRow.name}</td>
                      <td>{keyRow.type}</td>
                      <td>{formatBytes(keyRow.bytes)}</td>
                      <td>{formatTtl(keyRow.ttlMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore ? (
              <div className="load-more-row">
                <Button label="Load more" iconName="chevron-down" onClick={() => void loadPage()} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

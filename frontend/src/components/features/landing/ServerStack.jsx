/**
 * Hero illustration: a request travelling through the platform. The panel is
 * deliberately a request trace, not a fake dashboard — every layer names a
 * real stage in the HTTP data plane.
 */

import { Icon } from '../../common/Icon.jsx';

const LAYERS = [
  {
    icon: 'key',
    label: 'Scoped key',
    detail: 'Bearer rk_ · read-write',
  },
  {
    icon: 'shield-lock',
    label: 'Tenant check',
    detail: 'database id + owner',
  },
  {
    icon: 'speed',
    label: 'Quota check',
    detail: 'keys · bytes · commands',
  },
  {
    icon: 'database',
    label: 'Data plane',
    detail: 'embedded engine or your Redis',
  },
];

export default function ServerStack() {
  return (
    <div className="hero-visual">
      <div className="hero-ambient" aria-hidden="true" />

      <div className="request-card">
        <div className="request-card-bar">
          <span className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="request-file">
            <Icon name="braces" />
            request.ts
          </span>
          <span className="request-method">POST</span>
        </div>

        <div className="request-endpoint">
          <span className="request-endpoint-method">POST</span>
          <code>/api/data/rdb_7f2c/command</code>
        </div>

        <pre className="request-code">
          <code>
            <span className="tok-keyword">await</span>
            {' fetch(url, {\n'}
            {'  method: '}
            <span className="tok-string">&quot;POST&quot;</span>
            {',\n'}
            {'  headers: { authorization: '}
            <span className="tok-string">&quot;Bearer rk_...&quot;</span>
            {' },\n'}
            {'  body: JSON.stringify({\n'}
            {'    command: '}
            <span className="tok-string">&quot;SET&quot;</span>
            {',\n'}
            {'    args: ['}
            <span className="tok-string">&quot;session:9942&quot;</span>
            {', '}
            <span className="tok-string">&quot;active&quot;</span>
            {', '}
            <span className="tok-string">&quot;EX&quot;</span>
            {', '}
            <span className="tok-string">&quot;3600&quot;</span>
            {']\n'}
            {'  }),\n'}
            {'});'}
          </code>
        </pre>

        <div className="request-path">
          {LAYERS.map((layer, index) => (
            <div className="request-layer" key={layer.label}>
              <span className="request-layer-rail" aria-hidden="true">
                <span className="request-layer-dot" />
                {index < LAYERS.length - 1 ? <span className="request-layer-line" /> : null}
              </span>
              <span className="request-layer-icon">
                <Icon name={layer.icon} />
              </span>
              <span className="request-layer-copy">
                <strong>{layer.label}</strong>
                <small>{layer.detail}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="request-response">
          <span className="response-status">
            <span className="dot" aria-hidden="true" />
            200 OK
          </span>
          <code>{'{ "success": true, "data": { "result": "OK" } }'}</code>
        </div>
      </div>

      <div className="float-note float-note-ttl">
        <span className="float-note-icon">
          <Icon name="clock" />
        </span>
        <span>
          <strong>Every key expires</strong>
          <small>24h default TTL</small>
        </span>
      </div>

      <div className="float-note float-note-scope">
        <span className="float-note-icon">
          <Icon name="shield-check" />
        </span>
        <span>
          <strong>Isolated by default</strong>
          <small>cross-tenant reads return 404</small>
        </span>
      </div>
    </div>
  );
}

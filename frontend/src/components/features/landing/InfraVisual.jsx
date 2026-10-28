/**
 * Infrastructure diagram. It describes the request path and the two supported
 * data-plane modes only — no region map, latency numbers or availability
 * claims that the platform cannot verify.
 */

import { Icon } from '../../common/Icon.jsx';

const NODES = [
  {
    icon: 'terminal',
    kicker: 'Client',
    title: 'Your service',
    detail: 'Any HTTP client, cron job or agent',
  },
  {
    icon: 'lock',
    kicker: 'Transport',
    title: 'HTTPS + Bearer',
    detail: 'One scoped key per database',
  },
  {
    icon: 'shield-lock',
    kicker: 'Control',
    title: 'Auth + quotas',
    detail: 'Permission and limits before execution',
  },
  {
    icon: 'database',
    kicker: 'Storage',
    title: 'Tenant namespace',
    detail: 'Keys never cross database boundaries',
  },
];

export default function InfraVisual() {
  return (
    <div className="infra-visual">
      <div className="infra-diagram" role="img" aria-label="Request path: your service sends an HTTPS request with a scoped key to the Cacheify API, which enforces permissions and quotas before reaching an isolated tenant namespace and the data plane.">
        {NODES.map((node, index) => (
          <div className="infra-step" key={node.title}>
            <div className="infra-node">
              <span className="infra-node-icon">
                <Icon name={node.icon} />
              </span>
              <span className="infra-node-kicker">{node.kicker}</span>
              <strong>{node.title}</strong>
              <small>{node.detail}</small>
            </div>
            {index < NODES.length - 1 ? (
              <span className="infra-connector" aria-hidden="true">
                <span className="infra-connector-line" />
                <Icon name="arrow_forward" />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="infra-modes">
        <div className="infra-mode">
          <span className="infra-mode-icon">
            <Icon name="cpu" />
          </span>
          <span>
            <strong>Embedded engine</strong>
            <small>The platform runs the Redis-compatible data plane for you.</small>
          </span>
          <span className="badge badge-status-active">Default</span>
        </div>
        <div className="infra-mode">
          <span className="infra-mode-icon">
            <Icon name="hdd-network" />
          </span>
          <span>
            <strong>Your Redis server</strong>
            <small>Point the operator at a real Redis instance; every database becomes a namespaced tenant.</small>
          </span>
          <span className="badge badge-type">Optional</span>
        </div>
      </div>

      <p className="infra-caption">
        <Icon name="info-circle" />
        A request-path diagram, not a region map. The deployment exposes a single API origin,
        whether the data plane runs on the embedded engine or on your own Redis server.
      </p>
    </div>
  );
}

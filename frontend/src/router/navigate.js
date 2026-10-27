/**
 * Navigation actions decoupled from React components (breaks services/pages
 * -> app circular imports). The Next router registers itself here once the
 * RouterBridge client component hydrates.
 */

let routerImpl = null;

export function registerNavigate(impl) {
  routerImpl = impl;
}

export function navigate(path, { replace = false } = {}) {
  if (!routerImpl) {
    window.location.assign(path);
    return;
  }
  if (replace) routerImpl.replace(path);
  else routerImpl.push(path);
}

export function refreshRoute() {
  if (routerImpl) routerImpl.refresh();
}

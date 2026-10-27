/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only: allow the 127.0.0.1 loopback to reach dev assets (/_next/hmr etc.),
  // exactly the host the app is verified against and the API URL host.
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        // API-only backend, separate frontend: the frontend ships its own
        // tight document security headers (the Express API stops serving HTML).
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // An unrelated package-lock.json in C:\Users\abhir makes Next infer the home
  // directory as the workspace root, which would drag the wrong files into the
  // build trace. Pin the root to this project.
  outputFileTracingRoot: import.meta.dirname,

  // face-api ships large model binaries we serve statically from /public/models
  // Camera + geolocation are same-origin APIs; no special headers needed,
  // but we set an explicit Permissions-Policy so intent is documented.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

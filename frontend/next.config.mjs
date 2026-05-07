const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const target = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
    ];
  },
};

export default nextConfig;

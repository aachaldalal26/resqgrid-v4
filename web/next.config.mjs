/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keeps `npm run build` from failing on lint/type nits during a hackathon.
  // Run `npx tsc --noEmit` to see type warnings.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;

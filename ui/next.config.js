/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  serverExternalPackages: ['node-pty'],
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  devIndicators: false,
};

module.exports = nextConfig;

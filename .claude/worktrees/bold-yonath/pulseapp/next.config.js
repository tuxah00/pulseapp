/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twilio webhook'ları için
  async headers() {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

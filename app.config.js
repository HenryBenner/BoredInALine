module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
  },
});

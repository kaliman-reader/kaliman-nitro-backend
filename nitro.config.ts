//https://nitro.unjs.io/config
export default defineNitroConfig({
  runtimeConfig: {
    awsCfKeyPairId: "",
    awsCfPrivateKeyName: "",
    awsCfBaseUrl: "",
  },
  serverAssets: [
    {
      baseName: 'assets',
      dir: './assets',
    },
  ],
  logLevel: +999
});

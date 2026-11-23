export default ({ config }) => {
  return {
    ...config,
    name: "CasualNoMore",
    slug: "CasualNoMore",
    version: "4.5.0",
    orientation: "portrait",
    icon: "./assets/images/app_icon.png",
    scheme: "casualnomore",
    userInterfaceStyle: "dark",
    backgroundColor: "#0A0E15",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.casualnomore.app",
      versionCode: 12,
      // atualizar o app pelo botão do Perfil (abre o instalador do Android)
      permissions: ["android.permission.REQUEST_INSTALL_PACKAGES"],
      adaptiveIcon: {
        foregroundImage: "./assets/images/app_icon.png",
        backgroundColor: "#0A0E15",
      },
      edgeToEdgeEnabled: false,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-web-browser",
      "expo-secure-store",
      // Android: até 20 requisições simultâneas por servidor (OkHttp limita a 5)
      ["./plugins/withOkHttpConcurrency", { maxRequestsPerHost: 20 }],
      // assinatura de release com keystore própria (CNM_UPLOAD_*), ver o plugin
      "./plugins/withReleaseSigning",
      // só celulares ARM 64 bits (build mais rápido, APK menor)
      ["./plugins/withArchitectures", { architectures: ["arm64-v8a"] }],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/app_icon.png",
          imageWidth: 160,
          resizeMode: "contain",
          backgroundColor: "#0A0E15",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "895beb33-b8f7-4b89-87fa-2e967f04b60d",
      },
    },
  };
};

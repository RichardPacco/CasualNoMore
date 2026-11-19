export default ({ config }) => {
  return {
    ...config,
    name: "CasualNoMore",
    slug: "CasualNoMore",
    version: "1.4.0",
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
      versionCode: 1,
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

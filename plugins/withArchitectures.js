/**
 * Expo config plugin: arquiteturas de CPU do build Android.
 *
 * Grava `reactNativeArchitectures` no android/gradle.properties gerado pelo
 * `expo prebuild`. O padrão do React Native compila o código nativo para 4
 * arquiteturas; o app é distribuído só para celulares ARM de 64 bits
 * (`arm64-v8a`, praticamente todo Android atual), o que deixa o build bem
 * mais rápido e o APK menor.
 *
 * Para um build pontual com outra arquitetura (ex.: emulador x86), passe na
 * linha de comando, que tem prioridade:
 *   .\gradlew.bat assembleRelease -PreactNativeArchitectures=x86
 */
const { withGradleProperties } = require("@expo/config-plugins");

const KEY = "reactNativeArchitectures";

function withArchitectures(config, { architectures = ["arm64-v8a"] } = {}) {
    return withGradleProperties(config, (cfg) => {
        const value = architectures.join(",");
        const existing = cfg.modResults.find(item => item.type === "property" && item.key === KEY);
        if (existing) existing.value = value;
        else cfg.modResults.push({ type: "property", key: KEY, value });
        return cfg;
    });
}

module.exports = withArchitectures;

/**
 * Expo config plugin: assinatura de release do APK com uma keystore própria.
 *
 * O Android só instala uma atualização por cima do app se o APK novo for
 * assinado com a MESMA chave do instalado. O build padrão do Expo assina o
 * release com a chave de debug (diferente em cada máquina), então o botão de
 * atualizar não funcionaria. Este plugin cria um signingConfig "release" que
 * lê a keystore de variáveis de ambiente (GitHub Actions) ou de propriedades
 * do Gradle (~/.gradle/gradle.properties, no seu PC):
 *
 *   CNM_UPLOAD_STORE_FILE      caminho do arquivo .jks/.keystore
 *   CNM_UPLOAD_STORE_PASSWORD  senha da keystore
 *   CNM_UPLOAD_KEY_ALIAS       alias da chave
 *   CNM_UPLOAD_KEY_PASSWORD    senha da chave
 *
 * Sem essas variáveis, o release continua assinado com a chave de debug
 * (builds locais de teste seguem funcionando). A keystore e as senhas nunca
 * entram no repositório. Roda no `expo prebuild` / build do EAS.
 */
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "CasualNoMore: assinatura de release";

/** Lê uma variável de ambiente ou propriedade do Gradle (nessa ordem). */
const read = (name) => `(System.getenv("${name}") ?: findProperty("${name}"))`;

/**
 * Transforma o texto do app/build.gradle (exportado para poder testar).
 * Idempotente: se o código já estiver lá, devolve o texto sem mudar.
 */
function addReleaseSigning(src) {
    if (src.includes(MARKER)) return src;

    const releaseConfig = [
        `        // ${MARKER} (keystore fora do repositório)`,
        "        release {",
        `            def cnmStoreFile = ${read("CNM_UPLOAD_STORE_FILE")}`,
        "            if (cnmStoreFile) {",
        "                storeFile file(cnmStoreFile)",
        `                storePassword ${read("CNM_UPLOAD_STORE_PASSWORD")}`,
        `                keyAlias ${read("CNM_UPLOAD_KEY_ALIAS")}`,
        `                keyPassword ${read("CNM_UPLOAD_KEY_PASSWORD")}`,
        "            }",
        "        }",
    ].join("\n");

    // 1) signingConfig "release" logo depois do "debug" dentro de signingConfigs
    const withConfig = src.replace(
        /(signingConfigs\s*\{\s*\n\s*debug\s*\{[^}]*\}\n)/,
        `$1${releaseConfig}\n`
    );
    if (withConfig === src) throw new Error("[withReleaseSigning] signingConfigs { debug { ... } } não encontrado");

    // 2) o buildType release usa a keystore própria quando ela foi informada
    const withBuildType = withConfig.replace(
        /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig (signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug)"
    );
    if (withBuildType === withConfig) throw new Error("[withReleaseSigning] signingConfig do buildType release não encontrado");
    return withBuildType;
}

function withReleaseSigning(config) {
    return withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== "groovy") {
            throw new Error("[withReleaseSigning] só suporta build.gradle em Groovy");
        }
        cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
        return cfg;
    });
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;

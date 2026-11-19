/**
 * Expo config plugin: aumenta o limite de requisições simultâneas por
 * servidor no Android.
 *
 * O React Native faz todo `fetch` no Android pelo OkHttp e não mexe no
 * Dispatcher dele, que por padrão deixa só 5 requisições ao mesmo tempo por
 * servidor. Quase todas as chamadas do app vão para api.steampowered.com, então
 * o resto fica na fila (e o turbo da biblioteca quase não ajudava).
 *
 * O plugin registra, ao iniciar o app, uma fábrica de OkHttpClient igual à do
 * React Native (cache, cookies, sem timeouts), mudando só o Dispatcher.
 * Roda no `expo prebuild` / build do EAS, já que a pasta android/ é gerada.
 */
const { withMainApplication } = require("@expo/config-plugins");

const MARKER = "CasualNoMore: limite de requisições por servidor";

const IMPORTS = [
    "import com.facebook.react.modules.network.OkHttpClientFactory",
    "import com.facebook.react.modules.network.OkHttpClientProvider",
    "import okhttp3.Dispatcher",
];

/**
 * Transforma o texto do MainApplication.kt (exportado para poder testar).
 * Idempotente: se o código já estiver lá, devolve o texto sem mudar.
 */
function addOkHttpConcurrency(src, { maxRequestsPerHost = 20, maxRequests = 64 } = {}) {
    if (src.includes(MARKER)) return src;

    // imports logo depois da linha `package ...`
    const withImports = src.replace(/^(package [^\n]+\n)/m, `$1\n${IMPORTS.join("\n")}\n`);
    if (withImports === src) throw new Error("[withOkHttpConcurrency] linha `package` não encontrada");

    const snippet = [
        `    // ${MARKER} (padrão do OkHttp: 5)`,
        "    val appContext = this",
        "    OkHttpClientProvider.setOkHttpClientFactory(OkHttpClientFactory {",
        "      OkHttpClientProvider.createClientBuilder(appContext)",
        `        .dispatcher(Dispatcher().apply { maxRequests = ${maxRequests}; maxRequestsPerHost = ${maxRequestsPerHost} })`,
        "        .build()",
        "    })",
        "",
    ].join("\n");

    // logo depois de super.onCreate(), antes de o React Native criar o cliente HTTP
    const result = withImports.replace(
        /(override fun onCreate\(\)\s*\{\s*\n\s*super\.onCreate\(\)\s*\n)/,
        `$1${snippet}`
    );
    if (result === withImports) throw new Error("[withOkHttpConcurrency] onCreate()/super.onCreate() não encontrado");
    return result;
}

function withOkHttpConcurrency(config, options) {
    return withMainApplication(config, (cfg) => {
        if (cfg.modResults.language !== "kt") {
            throw new Error("[withOkHttpConcurrency] só suporta MainApplication em Kotlin");
        }
        cfg.modResults.contents = addOkHttpConcurrency(cfg.modResults.contents, options);
        return cfg;
    });
}

module.exports = withOkHttpConcurrency;
module.exports.addOkHttpConcurrency = addOkHttpConcurrency;

let currentLanguage = "en";

/** Define o idioma atual (apenas "en" ou "pt") em memória. */
export function setLanguageStore(lang) {
    if (lang === "en" || lang === "pt") currentLanguage = lang;
}

/** Retorna o idioma atual em memória. */
export function getLanguageStore() {
    return currentLanguage;
}

/** Converte o idioma para o código usado pela API da Steam. */
export function steamLangCode(lang = getLanguageStore()) {
    return lang === "en" ? "english" : "portuguese";
}

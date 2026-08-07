let currentLanguage = "en";

export function setLanguageStore(lang) {
    if (lang === "en" || lang === "pt") currentLanguage = lang;
}

export function getLanguageStore() {
    return currentLanguage;
}

export function steamLangCode(lang = getLanguageStore()) {
    return lang === "en" ? "english" : "portuguese";
}

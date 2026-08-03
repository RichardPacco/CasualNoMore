import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { setLanguageStore } from "./langStore";
import { translations } from "./translations";

export const SUPPORTED_LANGUAGES = ["pt", "en"];

const LanguageContext = createContext({
    language: "en",
    setLanguage: () => {},
    t: (key) => key,
});

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState("en");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await AsyncStorage.getItem("@language");
                if (!mounted) return;
                if (stored === "pt" || stored === "en") {
                    setLanguageState(stored);
                    setLanguageStore(stored);
                }
            } catch (e) {
                console.error("[Language] erro ao ler AsyncStorage:", e);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const setLanguage = async (lang) => {
        if (!SUPPORTED_LANGUAGES.includes(lang)) return;
        setLanguageState(lang);
        setLanguageStore(lang);
        try {
            await AsyncStorage.setItem("@language", lang);
        } catch (e) {
            console.error(e);
        }
    };

    const t = (key, params) => {
        const entry = translations[key];
        let str = entry ? (entry[language] ?? entry.pt) : key;
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                str = str.replace(`{${k}}`, String(v));
            }
        }
        return str;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

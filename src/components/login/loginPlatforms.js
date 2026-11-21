import { getUserProfile, RA_SETTINGS_URL, raMedia } from "@/src/api/retroachievements";
import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import { showToast } from "@/src/utils/toast";

/**
 * Configuração do login de cada plataforma. O formulário (PlatformLoginForm)
 * é o mesmo para todas: passo 1 a key (salva sozinha quando o formato bate
 * com `keyPattern`), passo 2 a conta, e o modo "contas salvas" com login
 * rápido. Aqui fica só o que muda de uma plataforma para outra: textos,
 * formato da key, link para pegar a key e como validar a conta.
 *
 * `signIn(input, { key, t })` valida a conta digitada (ou o id de uma conta
 * salva) e retorna `{ account: { id, name, avatar }, connectData }`, ou null
 * depois de mostrar o próprio aviso. Erros lançados viram o aviso genérico
 * `texts.connectionError`.
 */
export const LOGIN_PLATFORMS = {
    steam: {
        keyPattern: /^[0-9A-Fa-f]{32}$/,
        getKeyUrl: "https://steamcommunity.com/dev/apikey",
        idPlaceholder: "76561198000000000",
        texts: {
            welcomeSubtitle: "loginWelcomeSubtitle",
            stepKeyTitle: "loginStepKeyTitle",
            keyHint: "loginApiKeyHint",
            getKey: "loginGetApiKeySteam",
            keyHelp: null,
            stepAccountTitle: "loginStepProfileTitle",
            stepAccountHint: "loginStepProfileHint",
            idLabel: "loginSteamIdLabel",
            tip: "loginPublicTip",
            keyMissing: "loginApiKeyMissing",
            emptyInput: "loginEmptyInput",
            connectionError: "loginFetchFailed",
        },

        /** SteamID64 ou vanity/URL do perfil -> perfil público da Steam. */
        async signIn(input, { t }) {
            const numeric = input.replace(/\s+/g, "");
            let steamid = numeric;
            if (!/^\d{16,20}$/.test(numeric)) {
                // tenta resolver vanity -> steamid
                const res = await resolveVanityURL(input.trim());
                if (res?.success !== 1 || !res?.steamid) {
                    showToast(t("loginVanityFailed"), "error");
                    return null;
                }
                steamid = res.steamid;
            }

            const summary = await getPlayerSummary(steamid);
            if (!summary) {
                showToast(t("loginInvalidProfile"), "error");
                return null;
            }
            // perfil público = communityvisibilitystate 3
            if (Number(summary.communityvisibilitystate) !== 3) {
                showToast(t("loginPrivateProfile"), "warning");
                return null;
            }
            return {
                account: { id: steamid, name: summary.personaname || steamid, avatar: summary.avatarfull || null },
                connectData: { steamId: steamid },
            };
        },
    },

    ra: {
        // a Web API Key do RA tem 32 letras/números
        keyPattern: /^[A-Za-z0-9]{32}$/,
        getKeyUrl: RA_SETTINGS_URL,
        idPlaceholder: null,
        texts: {
            welcomeSubtitle: "raWelcomeSubtitle",
            stepKeyTitle: "raStepKeyTitle",
            keyHint: "raApiKeyHint",
            getKey: "raOpenSettings",
            keyHelp: "raKeyHelp",
            stepAccountTitle: "raStepUserTitle",
            stepAccountHint: "raStepUserHint",
            idLabel: "raUsername",
            tip: "raKeyOwnerTip",
            keyMissing: "raApiKeyMissing",
            emptyInput: "raEmptyUser",
            connectionError: "raConnectionError",
        },

        /** Nome de usuário (ou ULID de conta salva) -> perfil do RA, conectado pelo ULID. */
        async signIn(input, { key, t }) {
            let profile;
            try {
                profile = await getUserProfile(input.trim(), { key });
            } catch (e) {
                if (e?.status === 401) { showToast(t("raInvalidKey"), "error"); return null; }
                if (e?.status === 404) { showToast(t("raUserNotFound"), "error"); return null; }
                throw e;
            }
            // Usuário fora do ranking: os dados podem vir incompletos, mas entra
            if (Number(profile.Untracked)) showToast(t("raUntracked"), "warning");
            return {
                account: { id: profile.ULID, name: profile.User, avatar: raMedia(profile.UserPic) },
                connectData: { user: profile.User, ulid: profile.ULID, userPic: profile.UserPic ?? null },
            };
        },
    },
};

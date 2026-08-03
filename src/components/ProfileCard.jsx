import { useRouter } from "expo-router";
import { useContext } from "react";
import { Image, Linking, Text, TouchableOpacity, View } from "react-native";
import { AuthContext } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { formatDate } from "@/src/utils/formatDate";
import { useTheme } from "@/src/theme/styles";

function getStatus(statusCode, t) {
    switch (statusCode) {
        case 0: return { text: t("statusOffline"), colorDark: "text-gray-400", colorLight: "text-gray-600" };
        case 1: return { text: t("statusOnline"), colorDark: "text-accent", colorLight: "text-accent-strong" };
        case 2: return { text: t("statusBusy"), colorDark: "text-red-400", colorLight: "text-red-600" };
        case 3: return { text: t("statusAway"), colorDark: "text-yellow-400", colorLight: "text-yellow-600" };
        case 4: return { text: t("statusSleep"), colorDark: "text-purple-400", colorLight: "text-purple-600" };
        case 5: return { text: t("statusLookingTrade"), colorDark: "text-blue-400", colorLight: "text-blue-600" };
        case 6: return { text: t("statusLookingPlay"), colorDark: "text-indigo-400", colorLight: "text-indigo-600" };
        default: return { text: t("statusUnknown"), colorDark: "text-gray-400", colorLight: "text-gray-600" };
    }
}

export default function ProfileCard({ data }) {
    const t = useTheme();
    const { t: tr } = useLanguage();
    const status = getStatus(data.personastate, tr);

    const cardBg = t.cardBg;
    const coverBg = t.coverBg;
    const borderColor = t.avatarBorder;
    const textColor = t.textPrimary;
    const secondaryTextColor = t.textSecondary;

    function LogoutButton() {
        const { clearSteamId } = useContext(AuthContext);
        const router = useRouter();

        const handleLogout = async () => {
            try {
                await clearSteamId?.();
            } catch (e) {
                console.warn("Erro ao limpar steamId:", e);
            } finally {
                router.replace("/(auth)/login");
            }
        };

        return (
            <TouchableOpacity
                onPress={handleLogout}
                className="bg-red-600 p-3 rounded-lg flex-1 mr-2 items-center"
            >
                <Text className="text-white font-semibold">{tr("logout")}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View className={`${cardBg} rounded-xl overflow-hidden mb-4`}>
            {/* Capa */}
            <View className={`${coverBg} h-16 w-full`} />

            {/* Foto e nome */}
            <View className="p-4 -mt-12 flex-row items-center">
                <Image
                    source={{ uri: data.avatarfull }}
                    className={`w-24 h-24 rounded-full border-4 ${borderColor}`}
                />
                <View className="ml-4 flex-1">
                    <Text className={`${textColor} text-2xl font-bold`}>{data.personaname}</Text>
                    <Text className={t.isDark ? status.colorDark : status.colorLight}>{status.text}</Text>
                </View>
            </View>

            {/* Infos adicionais */}
            <View className="px-4 pb-4">
                {data.realname && (
                    <Text className={`${secondaryTextColor} text-sm`}>{tr("profileName", { name: data.realname })}</Text>
                )}
                {data.loccountrycode && (
                    <Text className={`${secondaryTextColor} text-sm`}>{tr("profileCountry", { code: data.loccountrycode })}</Text>
                )}
                <Text className={`${secondaryTextColor} text-xs mt-2`}>
                    {tr("profileLastOnline", { date: formatDate(data.lastlogoff) })}
                </Text>
            </View>

            {/* Botão para abrir na Steam */}
            <View className="flex-row justify-between px-4 mb-4">
                <TouchableOpacity
                    className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 items-center"
                    onPress={() => Linking.openURL(data.profileurl)}
                >
                    <Text className="text-white font-semibold">{tr("viewProfile")}</Text>
                </TouchableOpacity>

                <LogoutButton />
            </View>
        </View>
    );
}

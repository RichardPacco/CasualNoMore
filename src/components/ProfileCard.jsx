import { AuthContext } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { formatDateTime } from "@/src/utils/formatDate";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useContext } from "react";
import { Image, Linking, Text, TouchableOpacity, View } from "react-native";

function getStatus(statusCode, t) {
    switch (statusCode) {
        case 0: return { text: t("statusOffline"), overlayColor: "#9ca3af" };
        case 1: return { text: t("statusOnline"), overlayColor: "#55A8E8" };
        case 2: return { text: t("statusBusy"), overlayColor: "#f87171" };
        case 3: return { text: t("statusAway"), overlayColor: "#facc15" };
        case 4: return { text: t("statusSleep"), overlayColor: "#c084fc" };
        case 5: return { text: t("statusLookingTrade"), overlayColor: "#60a5fa" };
        case 6: return { text: t("statusLookingPlay"), overlayColor: "#818cf8" };
        default: return { text: t("statusUnknown"), overlayColor: "#9ca3af" };
    }
}

export default function ProfileCard({ data }) {
    const t = useTheme();
    const { t: tr } = useLanguage();
    const status = getStatus(data.personastate, tr);

    const cardBg = t.cardBg;
    const borderColor = t.avatarBorder;
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
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 border ${t.elevatedCardBg} ${t.cardBorder}`}
            >
                <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
                <Text className="font-semibold text-danger">{tr("logout")}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View className={`${cardBg} ${t.cardBorder} border rounded-xl overflow-hidden mb-4`}>
            {/* Capa com avatar desfocado */}
            <View className="h-32">
                <Image
                    source={{ uri: data.avatarfull }}
                    className="absolute inset-0 w-full h-full"
                    resizeMode="cover"
                    blurRadius={24}
                />
                <View className="absolute inset-0 bg-black/50" />

                {/* Foto e nome */}
                <View className="absolute bottom-0 left-0 right-0 flex-row items-end p-4">
                    <Image
                        source={{ uri: data.avatarfull }}
                        className={`w-20 h-20 rounded-full border-4 ${borderColor}`}
                    />
                    <View className="ml-3 flex-1 pb-0.5">
                        <Text className="text-white text-xl font-bold" numberOfLines={1}>
                            {data.personaname}
                        </Text>
                        <Text style={{ color: status.overlayColor }}>{status.text}</Text>
                    </View>
                </View>
            </View>

            {/* Infos adicionais */}
            <View className="px-4 pt-3 pb-2 gap-1.5">
                {data.realname && (
                    <View className="flex-row items-center">
                        <Ionicons name="person-outline" size={15} color={t.textInlineSecondary} />
                        <Text className={`${secondaryTextColor} text-sm ml-2`}>
                            {tr("profileName", { name: data.realname })}
                        </Text>
                    </View>
                )}
                {data.loccountrycode && (
                    <View className="flex-row items-center">
                        <Ionicons name="location-outline" size={15} color={t.textInlineSecondary} />
                        <Text className={`${secondaryTextColor} text-sm ml-2`}>
                            {tr("profileCountry", { code: data.loccountrycode })}
                        </Text>
                    </View>
                )}
                <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={15} color={t.textInlineSecondary} />
                    <Text className={`${secondaryTextColor} text-sm ml-2`}>
                        {tr("profileLastOnline", { date: formatDateTime(data.lastlogoff) })}
                    </Text>
                </View>
            </View>

            {/* Botão para abrir na Steam */}
            <View className="flex-row justify-between gap-3 px-4 pt-1 pb-4">
                <TouchableOpacity
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 border ${t.elevatedCardBg} ${t.cardBorder}`}
                    onPress={() => Linking.openURL(data.profileurl)}
                >
                    <Ionicons name="open-outline" size={18} color={COLORS.accent} />
                    <Text className="font-semibold text-accent">{tr("viewProfile")}</Text>
                </TouchableOpacity>

                <LogoutButton />
            </View>
        </View>
    );
}

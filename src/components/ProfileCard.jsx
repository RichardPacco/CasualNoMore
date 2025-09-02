import { useRouter } from "expo-router";
import { useContext } from "react";
import { Image, Linking, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { formatDate } from "../utils/formatDate";

function getStatus(statusCode) {
    switch (statusCode) {
        case 0: return { text: "Offline", colorDark: "text-gray-400", colorLight: "text-gray-600" };
        case 1: return { text: "Online", colorDark: "text-green-400", colorLight: "text-green-600" };
        case 2: return { text: "Ocupado", colorDark: "text-red-400", colorLight: "text-red-600" };
        case 3: return { text: "Ausente", colorDark: "text-yellow-400", colorLight: "text-yellow-600" };
        case 4: return { text: "Soneca", colorDark: "text-purple-400", colorLight: "text-purple-600" };
        case 5: return { text: "Procurando Trocar", colorDark: "text-blue-400", colorLight: "text-blue-600" };
        case 6: return { text: "Procurando Jogar", colorDark: "text-indigo-400", colorLight: "text-indigo-600" };
        default: return { text: "Desconhecido", colorDark: "text-gray-400", colorLight: "text-gray-600" };
    }
}

export default function ProfileCard({ data }) {
    const colorScheme = useColorScheme(); // 'light' or 'dark'
    const status = getStatus(data.personastate);

    const isDark = colorScheme === "dark";

    const cardBg = isDark ? "bg-gray-800" : "bg-[#f3f4f6]";
    const coverBg = isDark ? "bg-gray-700" : "bg-gray-200";
    const borderColor = isDark ? "border-gray-900" : "border-gray-300";
    const textColor = isDark ? "text-white" : "text-black";
    const secondaryTextColor = isDark ? "text-gray-300" : "text-gray-700";

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
                <Text className="text-white font-semibold">Sair</Text>
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
                    <Text className={isDark ? status.colorDark : status.colorLight}>{status.text}</Text>
                </View>
            </View>

            {/* Infos adicionais */}
            <View className="px-4 pb-4">
                {data.realname && (
                    <Text className={`${secondaryTextColor} text-sm`}>Nome: {data.realname}</Text>
                )}
                {data.loccountrycode && (
                    <Text className={`${secondaryTextColor} text-sm`}>País: {data.loccountrycode}</Text>
                )}
                <Text className={`${secondaryTextColor} text-xs mt-2`}>
                    Última vez online: {formatDate(data.lastlogoff)}
                </Text>
            </View>

            {/* Botão para abrir na Steam */}
            <View className="flex-row justify-between px-4 mb-4">
                <TouchableOpacity
                    className="bg-blue-600 p-3 rounded-lg flex-1 mr-2 items-center"
                    onPress={() => Linking.openURL(data.profileurl)}
                >
                    <Text className="text-white font-semibold">Ver Perfil</Text>
                </TouchableOpacity>

                <LogoutButton />
            </View>
        </View>
    );
}

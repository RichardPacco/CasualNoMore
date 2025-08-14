import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { formatDate } from "../utils/formatDate";

function getStatus(statusCode) {
    switch (statusCode) {
        case 0: return { text: "Offline", color: "text-gray-400" };
        case 1: return { text: "Online", color: "text-green-400" };
        case 2: return { text: "Ocupado", color: "text-red-400" };
        case 3: return { text: "Ausente", color: "text-yellow-400" };
        case 4: return { text: "Soneca", color: "text-purple-400" };
        case 5: return { text: "Procurando Trocar", color: "text-blue-400" };
        case 6: return { text: "Procurando Jogar", color: "text-indigo-400" };
        default: return { text: "Desconhecido", color: "text-gray-400" };
    }
}

export default function ProfileCard({ data }) {
    const status = getStatus(data.personastate);

    return (
        <View className="bg-gray-800 rounded-xl overflow-hidden mb-4">
            {/* Capa */}
            <View className="bg-gray-700 h-24 w-full" />

            {/* Foto e nome */}
            <View className="p-4 -mt-12 flex-row items-center">
                <Image
                    source={{ uri: data.avatarfull }}
                    className="w-24 h-24 rounded-full border-4 border-gray-900"
                />
                <View className="ml-4 flex-1">
                    <Text className="text-white text-2xl font-bold">{data.personaname}</Text>
                    <Text className={`${status.color} text-sm`}>{status.text}</Text>
                </View>
            </View>

            {/* Infos adicionais */}
            <View className="px-4 pb-4">
                {data.realname && (
                    <Text className="text-gray-300 text-sm">Nome real: {data.realname}</Text>
                )}
                {data.loccountrycode && (
                    <Text className="text-gray-300 text-sm">País: {data.loccountrycode}</Text>
                )}
                <Text className="text-gray-400 text-xs mt-2">
                    Última vez online: {formatDate(data.lastlogoff)}
                </Text>
            </View>

            {/* Botão para abrir na Steam */}
            <TouchableOpacity
                className="bg-blue-600 p-3 m-4 rounded-lg items-center"
                onPress={() => Linking.openURL(data.profileurl)}
            >
                <Text className="text-white font-semibold">Ver Perfil na Steam</Text>
            </TouchableOpacity>
        </View>
    );
}

import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { Modal, Text, TouchableOpacity, View } from "react-native";

/**
 * Modal de confirmação para limpar o banco de dados local.
 * Props: visible, onClose, onConfirm.
 */
export default function ClearDbModal({ visible, onClose, onConfirm }) {
    const { t } = useLanguage();

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <View className="flex-1 bg-black/70 items-center justify-center p-6">
                <View className="w-full bg-[#1f2937] rounded-2xl p-6 border border-gray-700">
                    <View className="items-center mb-4">
                        <View className="w-14 h-14 rounded-full bg-danger/15 items-center justify-center mb-3">
                            <Ionicons name="trash-outline" size={28} color={COLORS.danger} />
                        </View>
                        <Text className="text-white text-lg font-bold text-center">
                            {t("loginClearDbTitle")}
                        </Text>
                    </View>

                    <Text className="text-gray-400 text-sm text-center mb-6">
                        {t("loginClearDbMessage")}
                    </Text>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 py-3 rounded-lg bg-gray-700 items-center"
                        >
                            <Text className="text-white font-semibold">{t("loginCancel")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-1 py-3 rounded-lg bg-danger items-center"
                        >
                            <Text className="text-white font-semibold">{t("loginClear")}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

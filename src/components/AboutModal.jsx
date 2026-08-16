import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { Modal, Text, TouchableOpacity, View } from "react-native";

const GITHUB_URL = "https://github.com/RichardPacco/CasualNoMore";

/**
 * Modal "Sobre": mostra o autor e um link para o GitHub.
 * Props: visible, onClose.
 */
export default function AboutModal({ visible, onClose }) {
    const { t } = useLanguage();

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <View className="flex-1 bg-black/70 items-center justify-center p-6">
                <View className="w-full bg-[#1f2937] rounded-2xl p-6 border border-gray-700">
                    <View className="items-center mb-4">
                        <View className="w-14 h-14 rounded-full bg-accent/15 items-center justify-center mb-3">
                            <Ionicons name="game-controller-outline" size={28} color={COLORS.accent} />
                        </View>
                        <Text className="text-white text-lg font-bold text-center">
                            Casual No More
                        </Text>
                    </View>

                    <Text className="text-gray-400 text-sm text-center mb-6">
                        {t("aboutMadeBy", { name: "Richard Pacco" })}
                    </Text>

                    <TouchableOpacity
                        onPress={() => WebBrowser.openBrowserAsync(GITHUB_URL)}
                        className="flex-row items-center justify-center gap-2 py-3 rounded-lg bg-accent mb-3"
                    >
                        <Ionicons name="logo-github" size={18} color="#fff" />
                        <Text className="text-white font-semibold">{t("aboutGitHub")}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onClose}
                        className="py-3 rounded-lg bg-gray-700 items-center"
                    >
                        <Text className="text-white font-semibold">{t("loginCancel")}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

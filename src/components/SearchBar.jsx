import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

export default function SearchBar({ value, onChangeText, onClear, placeholder, style, inputProps = {} }) {
    const t = useTheme();
    const { t: tr } = useLanguage();

    return (
        <View className="flex-row items-center mb-3" style={style}>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={t.placeholderText}
                className={`flex-1 rounded-xl px-4 py-2 border ${t.inputBg} ${t.inputBorder} ${t.inputText}`}
                style={{ fontSize: 16 }}
                {...inputProps}
            />
            <TouchableOpacity
                onPress={() => (onClear ? onClear() : onChangeText(""))}
                style={{ marginLeft: 8 }}
            >
                <Text style={{ color: t.isDark ? COLORS.accent : "#111" }}>{tr("clear")}</Text>
            </TouchableOpacity>
        </View>
    );
}

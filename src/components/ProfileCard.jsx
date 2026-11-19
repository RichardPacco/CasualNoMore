import { Ionicons } from "@expo/vector-icons";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { AppText, Button } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { formatDateTime } from "@/src/utils/formatDate";
import { personaStatus } from "@/src/utils/personaStatus";

/**
 * Card do perfil Steam (redesign, prancheta 11): avatar com borda azul e
 * bolinha de status, nome, status, país e último acesso, e botão para abrir
 * o perfil na Steam. O "Sair" fica na lista de ajustes da tela de Perfil.
 * Props: data (resumo do jogador da Steam).
 */
export default function ProfileCard({ data }) {
    const { t: tr } = useLanguage();
    const status = personaStatus(data.personastate, tr);

    const details = [
        data.realname || null,
        data.loccountrycode || null,
        data.lastlogoff ? tr("lastOnlineShort", { date: formatDateTime(data.lastlogoff) }) : null,
    ].filter(Boolean).join(" · ");

    return (
        <View style={styles.card}>
            <View style={styles.top}>
                <View>
                    <Image source={{ uri: data.avatarfull }} style={styles.avatar} accessibilityIgnoresInvertColors />
                    <View
                        style={[styles.statusDot, { backgroundColor: status.color }]}
                        accessibilityLabel={status.text}
                    />
                </View>
                <View style={styles.texts}>
                    <AppText variant="subtitle" style={{ fontSize: 22 }} numberOfLines={1}>{data.personaname}</AppText>
                    <Text style={[styles.status, { color: status.online ? status.color : COLORS.textMuted }]}>
                        {status.text}
                    </Text>
                    {details ? <Text style={styles.details} numberOfLines={2}>{details}</Text> : null}
                </View>
            </View>

            {data.profileurl ? (
                <Button
                    label={tr("viewSteamProfile")}
                    variant="secondary"
                    onPress={() => Linking.openURL(data.profileurl).catch(err => console.error("Failed to open URL:", err))}
                    icon={<Ionicons name="open-outline" size={16} color={COLORS.text} />}
                    accessibilityRole="link"
                    style={{ height: 44, backgroundColor: "transparent" }}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 18,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        gap: 16,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.accent },
    statusDot: {
        position: "absolute",
        right: 2,
        bottom: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: COLORS.surface,
    },
    texts: { flex: 1, minWidth: 0, gap: 3 },
    status: { fontFamily: FONTS.bodySemibold, fontSize: 13 },
    details: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
});

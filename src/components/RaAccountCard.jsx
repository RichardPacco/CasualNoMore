import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { raMedia, raUserPic, raUserUrl } from "@/src/api/retroachievements";
import { AppText, Button } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Card da conta do RetroAchievements no Perfil: avatar, nome e botão para
 * abrir o perfil no site. Versão simples; pontos, rank e medalhas entram na
 * etapa 4 do RETROACHIEVEMENTS_PLAN.md.
 * Props: account ({ user, ulid, userPic }).
 */
export default function RaAccountCard({ account }) {
    const { t: tr } = useLanguage();
    const [avatarFailed, setAvatarFailed] = useState(false);
    const avatar = raMedia(account.userPic) ?? raUserPic(account.user);
    const initials = (account.user || "?").slice(0, 2).toUpperCase();

    return (
        <View style={styles.card}>
            <View style={styles.top}>
                {avatar && !avatarFailed ? (
                    <Image
                        source={{ uri: avatar }}
                        onError={() => setAvatarFailed(true)}
                        style={styles.avatar}
                        accessibilityIgnoresInvertColors
                    />
                ) : (
                    <View style={[styles.avatar, styles.fallback]}>
                        <Text style={styles.initials}>{initials}</Text>
                    </View>
                )}
                <View style={styles.texts}>
                    <AppText variant="subtitle" style={{ fontSize: 22 }} numberOfLines={1}>{account.user}</AppText>
                    <Text style={styles.platform}>{tr("platformRa")}</Text>
                </View>
            </View>
            <Button
                label={tr("viewOnRa")}
                variant="secondary"
                onPress={() => Linking.openURL(raUserUrl(account.user))
                    .catch(err => console.error("Failed to open URL:", err))}
                icon={<Ionicons name="open-outline" size={18} color={COLORS.text} />}
                accessibilityRole="link"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.surface, gap: 14 },
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.gold },
    fallback: { backgroundColor: "#3B3466", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.text },
    texts: { flex: 1, gap: 2 },
    platform: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.gold },
});

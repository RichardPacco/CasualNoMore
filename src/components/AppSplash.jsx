import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { AppText } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";

const appIcon = require("../../assets/images/app_icon.png");

// Barra de carregamento: trilho de 150 px com um trecho de 60 px indo e voltando
const TRACK_WIDTH = 150;
const THUMB_WIDTH = 60;

/**
 * Tela de abertura do app (redesign, prancheta 01): ícone num bloco
 * arredondado, nome, slogan e uma barra de carregamento perto do rodapé.
 */
export default function AppSplash() {
    const { t } = useLanguage();
    const barAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(barAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(barAnim, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [barAnim]);

    const translateX = barAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, TRACK_WIDTH - THUMB_WIDTH],
    });

    return (
        <View style={styles.screen}>
            <View style={styles.logoBox}>
                <Image
                    source={appIcon}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityLabel="CasualNoMore"
                />
            </View>

            <View style={styles.texts}>
                <AppText variant="title" style={styles.title}>CasualNoMore</AppText>
                <AppText variant="body" style={styles.tagline}>{t("splashTagline")}</AppText>
            </View>

            <View
                style={styles.track}
                accessibilityRole="progressbar"
                accessibilityLabel={t("loadingLabel")}
            >
                <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.bg,
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
    },
    logoBox: {
        width: 120,
        height: 120,
        borderRadius: 34,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    logo: { width: 88, height: 88, borderRadius: 20 },
    texts: { alignItems: "center", gap: 8, paddingHorizontal: 40 },
    title: { fontSize: 32 },
    tagline: { textAlign: "center", color: COLORS.textSoft },
    track: {
        position: "absolute",
        bottom: 72,
        width: TRACK_WIDTH,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.surface2,
        overflow: "hidden",
    },
    thumb: { width: THUMB_WIDTH, height: 4, borderRadius: 2, backgroundColor: COLORS.accent },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { useSyncExternalStore } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import '../globals.css';
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { getOverlayOpen, subscribeOverlay } from "@/src/utils/overlayBar";

// Ícones de cada aba: [ativo, inativo]
const TAB_ICONS = {
    GameStack: ["game-controller", "game-controller-outline"],
    FriendsStack: ["people", "people-outline"],
    ProfileStack: ["person-circle", "person-circle-outline"],
};

/**
 * Tab bar flutuante do redesign (prancheta 04): pílula sobre o conteúdo; a aba
 * ativa mostra ícone + nome num fundo azul suave, as outras só o ícone.
 * Some quando um overlay pede (ex.: menu de contexto aberto).
 */
function FloatingTabBar({ state, descriptors, navigation, hidden }) {
    if (hidden) return null;

    return (
        <View style={styles.bar} accessibilityRole="tablist">
            {state.routes.map((route, index) => {
                const focused = state.index === index;
                const { options } = descriptors[route.key];
                const label = options.title ?? route.name;
                const [activeIcon, idleIcon] = TAB_ICONS[route.name] ?? ["ellipse", "ellipse-outline"];

                const onPress = () => {
                    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                };
                const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

                return (
                    <Pressable
                        key={route.key}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: focused }}
                        accessibilityLabel={label}
                        style={({ pressed }) => [
                            styles.tab,
                            focused && styles.tabActive,
                            { opacity: pressed ? 0.75 : 1 },
                        ]}
                    >
                        <Ionicons
                            name={focused ? activeIcon : idleIcon}
                            size={focused ? 20 : 22}
                            color={focused ? COLORS.accent : COLORS.textMuted}
                        />
                        {focused && <Text style={styles.tabLabel}>{label}</Text>}
                    </Pressable>
                );
            })}
        </View>
    );
}

/**
 * Layout de abas: GameStack, FriendsStack e ProfileStack, tema escuro e
 * tab bar flutuante.
 */
export default function TabsLayout() {
    const { t } = useLanguage();
    const overlayOpen = useSyncExternalStore(subscribeOverlay, getOverlayOpen);

    NavigationBar.setButtonStyleAsync("light");

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
            <Tabs
                tabBar={(props) => <FloatingTabBar {...props} hidden={overlayOpen} />}
                screenOptions={{
                    headerShown: false,
                    animation: "shift",
                    sceneStyle: { backgroundColor: COLORS.bg },
                }}
            >
                <Tabs.Screen name="GameStack" options={{ title: t("tabGames") }} />
                <Tabs.Screen name="FriendsStack" options={{ title: t("tabFriends") }} />
                <Tabs.Screen name="ProfileStack" options={{ title: t("tabProfile") }} />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 20,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.tabBar,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: 8,
        elevation: 10,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    tab: {
        minWidth: 44,
        height: 44,
        borderRadius: 22,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
    },
    tabActive: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 16 },
    tabLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.accent },
});

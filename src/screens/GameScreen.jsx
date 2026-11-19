import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Text, TouchableOpacity, View, Linking } from "react-native";
import AchievementsTab from './AchievementsTab';
import GameDetailsTab from './GameDetailsTab';
import { AuthContext } from "@/src/context/AuthContext";
import { getGame } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";

const Tab = createMaterialTopTabNavigator();

/**
 * Tela de detalhes de um jogo com abas (Detalhes e Conquistas)
 * e menu de links da comunidade Steam.
 *
 * Recebe só o `appid` pela rota e lê o jogo do banco ao abrir. Assim a tela
 * sempre parte do estado salvo mais recente, e nenhuma cópia antiga do jogo
 * viaja pela navegação para depois sobrescrever dados mais novos.
 */
export default function GameScreen({ route, navigation }) {
    const { appid } = route.params;
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();

    const [game, setGame] = useState(null);
    const [loadingGame, setLoadingGame] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    const t = useTheme();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingGame(true);
            const row = steamId ? await getGame(steamId, appid) : null;
            if (cancelled) return;
            setGame(row);
            setLoadingGame(false);
        })();
        return () => { cancelled = true; };
    }, [steamId, appid]);

    const guidesUrl = `https://steamcommunity.com/app/${appid}/guides/`;
    const discussionsUrl = `https://steamcommunity.com/app/${appid}/discussions/`;

    /** Abre no navegador o guia do jogo no Steam Community. */
    const openGuides = () => {
        Linking.openURL(guidesUrl).catch(err => console.error("Failed to open guides URL:", err));
    };

    /** Abre no navegador as discussões do jogo no Steam Community. */
    const openDiscussions = () => {
        Linking.openURL(discussionsUrl).catch(err => console.error("Failed to open discussions URL:", err));
    };

    if (loadingGame || !game) {
        return (
            <View className={`flex-1 ${t.pageBg} p-4`}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back-outline" size={25} color={t.textInline} />
                </TouchableOpacity>
                <View className="flex-1 items-center justify-center px-6">
                    {loadingGame ? (
                        <ActivityIndicator size="large" color={COLORS.accent} />
                    ) : (
                        <Text style={{ color: t.textInline, textAlign: "center" }}>
                            {tr("gameNotFound")}
                        </Text>
                    )}
                </View>
            </View>
        );
    }

    return (

        <View className={`flex-1 ${t.pageBg} p-4`}>

            <Modal
                transparent
                animationType="fade"
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-end',
                    }}
                    activeOpacity={1}
                    onPressOut={() => setModalVisible(false)}
                >
                    <View
                        style={{
                            width: 200,
                            backgroundColor: t.surface,
                            marginTop: 60, // adjust to appear below status bar
                            marginRight: 16,
                            borderRadius: 8,
                            paddingVertical: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 5,
                            borderWidth: t.isDark ? 0 : 1,
                            borderColor: t.borderInline,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => { setModalVisible(false); openGuides(); }}
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="book-outline" size={18} color={t.textInline} style={{ marginRight: 8 }} />
                            <Text style={{ color: t.textInline }}>{tr("communityGuides")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setModalVisible(false); openDiscussions(); }}
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="chatbubbles-outline" size={18} color={t.textInline} style={{ marginRight: 8 }} />
                            <Text style={{ color: t.textInline }}>{tr("steamDiscussions")}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>


            {/* Back button + Title */}
            <View className="flex-row items-center justify-between mb-4">
                {/* Back button */}
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back-outline" size={25} color={t.textInline} style={{ marginRight: 8 }} />
                </TouchableOpacity>

                {/* Title */}
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text
                        style={{ color: t.textInline, fontSize: 18, fontWeight: 'bold' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {game.name} - {tr("achievements")}
                    </Text>
                </View>

                {/* Three-dot menu */}
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Ionicons name="ellipsis-vertical" size={25} color={t.textInline} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <Tab.Navigator
                screenOptions={{
                    tabBarStyle: {
                        backgroundColor: t.surface,
                        borderRadius: 10,           // Rounded corners
                        overflow: 'hidden',         // Ensure the rounding applies
                        height: 50,                 // Adjust height if needed
                    },
                    tabBarIndicatorStyle: {
                        backgroundColor: COLORS.accent,
                        borderRadius: 10,           // Rounded indicator
                        height: '100%',             // Makes the indicator fill the tab bar height
                    },
                    tabBarLabelStyle: {
                        color: t.textInline,
                        fontWeight: 'bold',
                    },
                }}
            >

                <Tab.Screen name="Detalhes" options={{ tabBarLabel: tr("details") }}>
                    {() => <GameDetailsTab game={game} navigation={navigation} />}
                </Tab.Screen>
                <Tab.Screen name="Conquistas" options={{ tabBarLabel: tr("achievements") }}>
                    {() => <AchievementsTab game={game} />}
                </Tab.Screen>
            </Tab.Navigator>
        </View>
    );
}

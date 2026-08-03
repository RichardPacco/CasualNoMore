import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useState } from "react";
import { Modal, Text, TouchableOpacity, View, Linking } from "react-native";
import AchievementsTab from './AchievementsTab';
import GameDetailsTab from './GameDetailsTab';
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";

const Tab = createMaterialTopTabNavigator();

export default function GameScreen({ route, navigation }) {
    const { game } = route.params;

    const [modalVisible, setModalVisible] = useState(false);

    const t = useTheme();

    const guidesUrl = `https://steamcommunity.com/app/${game.appid}/guides/`;
    const discussionsUrl = `https://steamcommunity.com/app/${game.appid}/discussions/`;

    const openGuides = () => {
        Linking.openURL(guidesUrl).catch(err => console.error("Failed to open guides URL:", err));
    };

    const openDiscussions = () => {
        Linking.openURL(discussionsUrl).catch(err => console.error("Failed to open discussions URL:", err));
    };

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
                            width: 150,
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
                            <Text style={{ color: t.textInline }}>Guias da Comunidade</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setModalVisible(false); openDiscussions(); }}
                            style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="chatbubbles-outline" size={18} color={t.textInline} style={{ marginRight: 8 }} />
                            <Text style={{ color: t.textInline }}>Discussões na Steam</Text>
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
                        {game.name} - Achievements
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

                <Tab.Screen name="Detalhes">
                    {() => <GameDetailsTab game={game} navigation={navigation} />}
                </Tab.Screen>
                <Tab.Screen name="Conquistas">
                    {() => <AchievementsTab game={game} />}
                </Tab.Screen>
            </Tab.Navigator>
        </View>
    );
}

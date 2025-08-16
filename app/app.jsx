import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Animated, TouchableOpacity, useColorScheme } from "react-native";

import GameStack from "./screens/GameStack";
import HomeScreen from "./screens/HomeScreen";

const Tab = createBottomTabNavigator();
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const FloatingTabButton = ({ children, onPress, focused }) => {
    const scale = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    };

    return (
        <AnimatedTouchable
            activeOpacity={0.7}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{
                transform: [{ scale }],
                marginHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 20,
                padding: 15,
                backgroundColor: focused ? "#7c3aed" : "#1f2937",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: focused ? 0.35 : 0.2,
                shadowRadius: 5,
                elevation: focused ? 8 : 4,
            }}
        >
            {children}
        </AnimatedTouchable>
    );
};

export default function App() {
    const scheme = useColorScheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: "absolute",
                    bottom: 10,
                    left: 20,
                    right: 20,
                    height: 60,
                    borderRadius: 25,
                    backgroundColor: "transparent",
                    elevation: 0,
                    shadowOpacity: 0,
                    borderTopWidth: 0,
                },
                tabBarButton: (props) => (
                    <FloatingTabButton {...props} focused={props.accessibilityState?.selected} />
                ),
                tabBarIcon: ({ focused }) => {
                    let iconName;
                    if (route.name === "Perfil") iconName = focused ? "person" : "person-outline";
                    else if (route.name === "Jogos") iconName = focused ? "game-controller" : "game-controller-outline";

                    return <Ionicons name={iconName} size={26} color="white" />;
                },
            })}
        >
            <Tab.Screen name="Jogos" component={GameStack} />
            <Tab.Screen name="Perfil" component={HomeScreen} />
        </Tab.Navigator>
    );
}

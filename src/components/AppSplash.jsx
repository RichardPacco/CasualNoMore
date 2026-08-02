import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Text, View } from "react-native";

const appIcon = require("../../assets/images/app_icon.png");

export default function AppSplash() {
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
        outputRange: [-130, 230],
    });

    return (
        <View className="flex-1 bg-gray-950 items-center justify-center">
            <Image source={appIcon} className="w-28 h-28 rounded-2xl" resizeMode="contain" />

            <Text className="text-white text-2xl font-bold mt-5 tracking-wide">CasualNoMore</Text>
            <Text className="text-accent text-sm mt-1">Conquistas de verdade</Text>

            <View className="mt-8 w-56 h-2 bg-gray-800 rounded-full overflow-hidden">
                <Animated.View
                    className="h-2 w-28 bg-accent rounded-full"
                    style={{ transform: [{ translateX }] }}
                />
            </View>
        </View>
    );
}

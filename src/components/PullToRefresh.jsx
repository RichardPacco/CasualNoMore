import { cloneElement, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

const MAX_PULL = 100;
const TRIGGER_PULL = 60;
const HOLD_PULL = 54;

// Custom pull-to-refresh: arrasta a lista para baixo revelando uma área
// onde o spinner aparece em frente (por cima) da lista.
export default function PullToRefresh({ refreshing, onRefresh, children, style }) {
    const translateY = useSharedValue(0);
    const pulling = useSharedValue(false);
    const refreshShared = useSharedValue(refreshing);
    const [atTop, setAtTop] = useState(true);

    useEffect(() => {
        refreshShared.value = refreshing;
        if (!refreshing) {
            translateY.value = withSpring(0);
            pulling.value = false;
        }
    }, [refreshing, refreshShared, translateY, pulling]);

    const pan = Gesture.Pan()
        .enabled(atTop && !refreshing)
        .activeOffsetY([-100000, 10])
        .failOffsetX([-10, 10])
        .maxPointers(1)
        .onStart(() => {
            pulling.value = true;
        })
        .onUpdate((e) => {
            if (refreshShared.value) return;
            translateY.value = Math.max(0, Math.min(e.translationY * 0.5, MAX_PULL));
        })
        .onEnd(() => {
            if (translateY.value >= TRIGGER_PULL && !refreshShared.value) {
                refreshShared.value = true;
                translateY.value = HOLD_PULL;
                runOnJS(onRefresh)();
            } else {
                translateY.value = withSpring(0);
                pulling.value = false;
            }
        })
        .onFinalize(() => {
            if (!refreshShared.value) pulling.value = false;
        });

    const listStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const spinnerStyle = useAnimatedStyle(() => ({
        opacity: pulling.value || refreshShared.value ? 1 : 0,
    }));

    return (
        <GestureDetector gesture={pan}>
            <View style={[{ flex: 1 }, style]}>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        spinnerStyle,
                        {
                            position: "absolute",
                            top: 8,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                            zIndex: 10,
                        },
                    ]}
                >
                    <ActivityIndicator size="large" color="#4ade80" />
                </Animated.View>
                <Animated.View style={[{ flex: 1 }, listStyle]}>
                    {cloneElement(children, {
                        scrollEventThrottle: 16,
                        onScroll: (e) => {
                            setAtTop(e.nativeEvent.contentOffset.y <= 0);
                            if (children.props.onScroll) children.props.onScroll(e);
                        },
                    })}
                </Animated.View>
            </View>
        </GestureDetector>
    );
}

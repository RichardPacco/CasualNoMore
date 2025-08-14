import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GameScreen from "./GameScreen";
import AchievementScreen from "./AchievementScreen";

const Stack = createNativeStackNavigator();

export default function GameStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="GameList" component={GameScreen} />
            <Stack.Screen name="Achievements" component={AchievementScreen} />
        </Stack.Navigator>
    );
}

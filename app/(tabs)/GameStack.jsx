import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AchievementScreen from "../screens/AchievementScreen";
import GameList from "../screens/GameList";

const Stack = createNativeStackNavigator();

export default function GameStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="GameList" component={GameList} />
            <Stack.Screen name="Achievements" component={AchievementScreen} />
        </Stack.Navigator>
    );
}

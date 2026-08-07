import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GameList from "@/src/screens/GameList";
import GameScreen from "@/src/screens/GameScreen";

const Stack = createNativeStackNavigator();

export default function GameStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="GameList" component={GameList} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
        </Stack.Navigator>
    );
}

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GameList from "../screens/GameList";
import GameScreen from "../screens/GameScreen";

const Stack = createNativeStackNavigator();

export default function GameStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="GameList" component={GameList} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
        </Stack.Navigator>
    );
}

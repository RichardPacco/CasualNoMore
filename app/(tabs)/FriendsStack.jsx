import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Friends from "@/src/screens/Friends";
import CommonGames from "@/src/screens/CommonGames";

const Stack = createNativeStackNavigator();

/** Stack de amigos: navegação entre Friends e CommonGames sem header. */
export default function FriendsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Friends" component={Friends} />
            <Stack.Screen name="CommonGames" component={CommonGames} />
        </Stack.Navigator>
    );
}

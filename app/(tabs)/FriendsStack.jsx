import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Friends from "@/src/screens/Friends";
import CommonGames from "@/src/screens/CommonGames";
import RaCommonGames from "@/src/screens/RaCommonGames";

const Stack = createNativeStackNavigator();

/** Stack de amigos: Friends e as telas de jogos do amigo (Steam e RA), sem header. */
export default function FriendsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Friends" component={Friends} />
            <Stack.Screen name="CommonGames" component={CommonGames} />
            <Stack.Screen name="RaCommonGames" component={RaCommonGames} />
        </Stack.Navigator>
    );
}

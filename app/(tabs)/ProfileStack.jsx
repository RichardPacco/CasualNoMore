import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Profile from "@/src/screens/Profile";
import CommonGames from "@/src/screens/CommonGames";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="CommonGames" component={CommonGames} />
        </Stack.Navigator>
    );
}

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Profile from "@/src/screens/Profile";

const Stack = createNativeStackNavigator();

/** Stack do perfil: define a tela Profile sem header. */
export default function ProfileStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Profile" component={Profile} />
        </Stack.Navigator>
    );
}

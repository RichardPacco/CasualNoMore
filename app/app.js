import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./screens/HomeScreen";
import GameScreen from "./screens/GameScreen";

const Tab = createBottomTabNavigator();

export default function App() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: "#111" },
                tabBarActiveTintColor: "#fff",
            }}
        >
            <Tab.Screen name="Perfil" component={HomeScreen} />
            <Tab.Screen name="Jogos" component={GameScreen} />
        </Tab.Navigator>
    );
}

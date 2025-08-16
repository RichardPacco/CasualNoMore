import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "./screens/HomeScreen";
import GameStack from "./screens/GameStack";

const Tab = createBottomTabNavigator();

export default function App() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: { backgroundColor: "#111" },
                tabBarActiveTintColor: "#fff",
                tabBarInactiveTintColor: "#888",
                tabBarIcon: ({ color, size }) => {
                    let iconName;
                    if (route.name === "Perfil") iconName = "person-circle";
                    else if (route.name === "Jogos") iconName = "game-controller";
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Perfil" component={HomeScreen} />
            <Tab.Screen name="Jogos" component={GameStack} />
        </Tab.Navigator>
    );
}

import { Stack } from "expo-router";
import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import './globals.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }}
        />
        <Stack.Screen name="game/[id]" options={{ headerShown: false }}
        />
      </Stack>
    </AuthProvider>
  );
}

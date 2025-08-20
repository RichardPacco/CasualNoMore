import { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";

export default function HomeScreen() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPlayerSummary().then(data => {
            setProfile(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <ActivityIndicator size="large" className="mt-10" />;

    return (
        <ScrollView className="flex-1 bg-gray-900 p-4">
            <ProfileCard className="text-white" data={profile} />
        </ScrollView>
    );
}

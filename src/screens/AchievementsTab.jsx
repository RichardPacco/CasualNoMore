import ContextMenu from "@/src/components/ContextMenu";
import RadioSheet from "@/src/components/RadioSheet";
import useAchievements from "@/src/hooks/useAchievements";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { formatDate } from "@/src/utils/formatDate";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, Keyboard, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get("window");

const RAINBOW = ["#ff0000", "#ff8c00", "#ffe600", "#33cc33", "#3399ff", "#9933ff", "#ff0000"];

// Cor da borda por raridade (baseada no % global de desbloqueio)
function rarityColor(percent) {
    if (percent > 50) return COLORS.rarityCommon;      // comum
    if (percent > 25) return COLORS.rarityUncommon;    // incomum
    if (percent > 10) return COLORS.rarityRare;        // rara
    if (percent > 5) return COLORS.rarityEpic;         // épica
    if (percent > 1) return COLORS.rarityLegendary     // lendária
    return COLORS.rarityPearlescent;                     // perolescente
}

const FALLBACK_ICON_CDN = "https://shared.fastly.steamstatic.com/community_assets/images/apps/";

function iconFallbackUri(uri, appid) {
    if (!uri || !appid) return uri;
    const filename = uri.split("/").pop();
    return `${FALLBACK_ICON_CDN}${appid}/${filename}`;
}

function AchievementCardComponent({ item, game, onOpenMenu }) {
    const t = useTheme();
    const { t: tr } = useLanguage();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [iconFailed, setIconFailed] = useState(false);
    const iconUri = iconFailed ? iconFallbackUri(item.icon, game?.appid) : item.icon;

    const isPearlescent = item.globalPercent <= 1;
    const rarity = rarityColor(item.globalPercent);

    const unlockLabel = useMemo(() => {
        if (!item.achieved || !item.unlocktime) return null;
        return tr("unlockedAt", { date: formatDate(item.unlocktime) });
    }, [item.achieved, item.unlocktime, tr]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            speed: 40,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            speed: 40,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    };

    const handleLongPress = (e) => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        onOpenMenu?.(item, e.nativeEvent.pageX, e.nativeEvent.pageY);
    };

    return (
        <AnimatedTouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            style={{ transform: [{ scale: scaleAnim }] }}
            className={`flex-row items-center ${t.cardBg} p-4 rounded mb-3 justify-between`}
        >
            {/* Left: icon + percent */}
            <View className="flex-col items-center mr-4">
                {isPearlescent ? (
                    <LinearGradient
                        colors={RAINBOW}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            padding: 2,
                            borderRadius: 10,
                        }}
                    >
                        <Image
                            source={{ uri: iconUri }}
                            className="w-12 h-12 rounded"
                            resizeMode="contain"
                            onError={() => setIconFailed(true)}
                        />
                    </LinearGradient>
                ) : (
                    <View
                        style={{
                            padding: 2,
                            borderRadius: 10,
                            backgroundColor: rarity + "2E",
                            borderWidth: 1.5,
                            borderColor: rarity,
                        }}
                    >
                        <Image
                            source={{ uri: iconUri }}
                            className="w-12 h-12 rounded"
                            resizeMode="contain"
                            onError={() => setIconFailed(true)}
                        />
                    </View>
                )}
                <Text className="text-sm" style={{ color: rarity }}>
                    {item.globalPercent}%
                </Text>
            </View>

            {/* Middle: name + description */}
            <View className="flex-1">
                <Text className={`${t.textPrimary} font-bold text-base`}>{item.name}</Text>
                <Text className={`${t.textSecondary} text-sm`} numberOfLines={2}>
                    {item.description || tr("hiddenDescription")}
                </Text>
                {unlockLabel && (
                    <Text className={`${t.textSecondary} text-xs mt-1`} style={{ color: COLORS.accent }}>
                        {unlockLabel}
                    </Text>
                )}
            </View>

            {/* Right: lock */}
            <Ionicons
                name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                size={32}
                color={item.achieved ? COLORS.accent : COLORS.danger}
            />
        </AnimatedTouchableOpacity>
    );
}

const AchievementCard = memo(AchievementCardComponent);

export default function AchievementsTab({ game }) {
    const { mergedCheevos, loading } = useAchievements(game);

    const t = useTheme();
    const { t: tr } = useLanguage();

    // ---------- state ----------
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("rarity");
    const [reverse, setReverse] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortVisible, setSortVisible] = useState(false);
    const [showTopButton, setShowTopButton] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [guideMenu, setGuideMenu] = useState(null);
    const listRef = useRef(null);
    const containerRef = useRef(null);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const filterOptions = useMemo(() => [
        { label: tr("filterAll"), value: "all" },
        { label: tr("achFilterUnlocked"), value: "unlocked" },
        { label: tr("achFilterLocked"), value: "locked" },
    ], [tr]);

    const sortOptions = useMemo(() => [
        { label: tr("achSortRarity"), value: "rarity" },
        { label: tr("achSortUnlock"), value: "unlock" },
        { label: tr("sortName"), value: "name" },
        { label: tr("achSortReverse"), value: "reverse" },
    ], [tr]);

    const filterCounts = useMemo(() => {
        const countFor = (value) => {
            switch (value) {
                case "unlocked": return mergedCheevos.filter(a => a.achieved).length;
                case "locked": return mergedCheevos.filter(a => !a.achieved).length;
                default: return mergedCheevos.length;
            }
        };
        return filterOptions.reduce((acc, opt) => {
            acc[opt.value] = countFor(opt.value);
            return acc;
        }, {});
    }, [mergedCheevos, filterOptions]);

    const filteredCheevos = useMemo(() => {
        let result = mergedCheevos;

        switch (filter) {
            case "unlocked": result = result.filter(a => a.achieved); break;
            case "locked": result = result.filter(a => !a.achieved); break;
            default: break;
        }

        if (debouncedQuery && debouncedQuery.trim().length > 0) {
            const q = debouncedQuery.trim().toLowerCase();
            result = result.filter(a =>
                (a.name || "").toLowerCase().includes(q) ||
                (a.description || "").toLowerCase().includes(q)
            );
        }

        switch (sort) {
            case "rarity":
                result = [...result].sort((a, b) => b.globalPercent - a.globalPercent);
                break;
            case "unlock":
                result = [...result].sort((a, b) => (b.unlocktime || 0) - (a.unlocktime || 0));
                break;
            case "name":
                result = [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                break;
            case "reverse":
                result = [...result].reverse();
            default: break;
        }

        return result;
    }, [mergedCheevos, filter, sort, debouncedQuery]);

    // debounce search query
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const openGuideMenu = useCallback((item, pageX, pageY) => {
        // Converte coordenadas da janela (pageX/pageY) para o sistema do
        // container (leva em conta safe area / status bar).
        containerRef.current?.measureInWindow((cx, cy, cw, ch) => {
            setGuideMenu({ item, x: pageX - cx, y: pageY - cy, width: cw, height: ch });
        });
    }, []);

    const renderCard = useCallback(
        ({ item }) => <AchievementCard item={item} game={game} onOpenMenu={openGuideMenu} />,
        [game, openGuideMenu]
    );

    const guideQuery = useCallback((item) => {
        return encodeURIComponent(`${game.name} ${item.name} Guide`);
    }, [game]);

    const searchGoogle = useCallback((item) => {
        WebBrowser.openBrowserAsync(`https://www.google.com/search?q=${guideQuery(item)}`)
            .catch(err => console.error("Failed to open browser:", err));
    }, [guideQuery]);

    const searchChatGPT = useCallback((item) => {
        WebBrowser.openBrowserAsync(`https://chatgpt.com/?q=${guideQuery(item)}`)
            .catch(err => console.error("Failed to open browser:", err));
    }, [guideQuery]);

    const guideMenuOptions = useMemo(() => {
        if (!guideMenu) return [];
        return [
            { label: tr("searchGoogle"), icon: "logo-google", onPress: () => searchGoogle(guideMenu.item) },
            { label: tr("searchChatGPT"), icon: "sparkles", onPress: () => searchChatGPT(guideMenu.item) },
        ];
    }, [guideMenu, tr, searchGoogle, searchChatGPT]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View ref={containerRef} className={`flex-1 ${t.pageBg} py-4`}>
            {mergedCheevos.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className={`${t.textSecondary} text-center text-lg`}>
                        {tr("noAchievements")}
                    </Text>
                </View>
            ) : (
                <>
                    {/* search input */}
                    <View className="flex-row items-center px-0 mb-3">
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={tr("achSearchPlaceholder")}
                            placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                            returnKeyType="search"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            className={`flex-1 rounded-xl px-4 py-2 border ${isDark
                                ? "bg-slate-800 border-accent text-white"
                                : "bg-slate-100 border-gray-300 text-black"
                                }`}
                            style={{ fontSize: 16 }}
                        />
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery("");
                                setDebouncedQuery("");
                            }}
                            style={{ marginLeft: 8 }}
                        >
                            <Text style={{ color: isDark ? COLORS.accent : "#111" }}>{tr("clear")}</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={listRef}
                        data={filteredCheevos}
                        keyExtractor={(item) => item.apiname}
                        contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 70 }}
                        renderItem={renderCard}
                        initialNumToRender={10}
                        windowSize={5}
                        onScroll={(e) => {
                            setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                        }}
                        ListEmptyComponent={
                            <View className="py-10 items-center">
                                <Text className={`${t.textSecondary} text-center text-lg`}>
                                    {tr("noAchievementsMatch")}
                                </Text>
                            </View>
                        }
                    />

                    {/* floating buttons: filter + sort + scroll to top */}
                    <View className="absolute bottom-24 right-6 gap-3">
                        <TouchableOpacity
                            onPress={() => setFilterVisible(true)}
                            activeOpacity={0.8}
                            className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                            style={{
                                elevation: 6,
                                shadowColor: "#000",
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 3 },
                            }}
                        >
                            <Ionicons
                                name={filter === "all" ? "funnel-outline" : "funnel"}
                                size={22}
                                color={COLORS.accent}
                            />
                            {filter !== "all" && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: COLORS.warning,
                                        borderWidth: 1,
                                        borderColor: isDark ? "#111827" : "#ffffff",
                                    }}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setSortVisible(true)}
                            activeOpacity={0.8}
                            className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                            style={{
                                elevation: 6,
                                shadowColor: "#000",
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 3 },
                            }}
                        >
                            <Ionicons
                                name={sort === "rarity" ? "swap-vertical-outline" : "swap-vertical"}
                                size={22}
                                color={COLORS.accent}
                            />
                            {sort !== "rarity" && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: COLORS.warning,
                                        borderWidth: 1,
                                        borderColor: isDark ? "#111827" : "#ffffff",
                                    }}
                                />
                            )}
                        </TouchableOpacity>

                        {showTopButton && (
                            <TouchableOpacity
                                onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                                activeOpacity={0.8}
                                className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                                style={{
                                    elevation: 6,
                                    shadowColor: "#000",
                                    shadowOpacity: 0.25,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 3 },
                                }}
                            >
                                <Ionicons name="chevron-up-outline" size={24} color={COLORS.accent} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <RadioSheet
                        visible={filterVisible}
                        onClose={() => setFilterVisible(false)}
                        title={tr("filterTitle")}
                        options={filterOptions}
                        selected={filter}
                        onSelect={setFilter}
                        counts={filterCounts}
                    />

                    <RadioSheet
                        visible={sortVisible}
                        onClose={() => setSortVisible(false)}
                        title={tr("sortTitle")}
                        options={sortOptions}
                        selected={sort}
                        onSelect={(value) => { setSort(value) }}
                    />
                </>
            )}

            <ContextMenu
                visible={!!guideMenu}
                x={guideMenu?.x ?? 0}
                y={guideMenu?.y ?? 0}
                bounds={{ width: guideMenu?.width ?? WINDOW_W, height: guideMenu?.height ?? WINDOW_H }}
                title={guideMenu?.item?.name}
                options={guideMenuOptions}
                onClose={() => setGuideMenu(null)}
            />
        </View>
    );
}

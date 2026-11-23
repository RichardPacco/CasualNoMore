import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/src/context/AuthContext";
import { useSettings } from "@/src/context/SettingsContext";
import { PLATFORM_ORDER, PLATFORMS } from "@/src/platforms";
import useRaLibrary from "@/src/platforms/ra/useRaLibrary";
import useSteamLibrary from "@/src/platforms/steam/useSteamLibrary";

// Plataforma escolhida no seletor da biblioteca (salva no aparelho)
const ACTIVE_PLATFORM_KEY = "@library_platform";

/**
 * Biblioteca separada por plataforma (decisão D1 do plano): as bibliotecas
 * de todas as plataformas conectadas sincronizam em segundo plano, e a tela
 * mostra uma por vez (`active`, escolhida no seletor e salva no aparelho).
 *
 * Os jogos vêm no formato comum (LibraryGame). No RA, as opções de
 * esconder hacks/subsets vêm das preferências. As ações (atualizar, fixar, reler) vão para a plataforma do
 * próprio jogo.
 */
export default function useLibrary() {
    const { accounts } = useContext(AuthContext);
    const { settings } = useSettings();
    const steam = useSteamLibrary(accounts.steam?.steamId ?? null);
    const ra = useRaLibrary(accounts.ra);

    // ---------- plataforma ativa ----------
    const connected = useMemo(() => PLATFORM_ORDER.filter(p => !!accounts[p]), [accounts]);
    const [preferred, setPreferred] = useState(null);
    useEffect(() => {
        AsyncStorage.getItem(ACTIVE_PLATFORM_KEY)
            .then(saved => { if (saved) setPreferred(saved); })
            .catch(() => { });
    }, []);
    const setActive = useCallback((platform) => {
        setPreferred(platform);
        AsyncStorage.setItem(ACTIVE_PLATFORM_KEY, platform).catch(() => { });
    }, []);
    // a escolhida, se ainda estiver conectada; senão a primeira conectada
    const active = connected.includes(preferred) ? preferred : (connected[0] ?? "steam");

    // ---------- jogos no formato comum ----------
    const steamGames = useMemo(() => steam.rows.map(PLATFORMS.steam.toLibraryGame), [steam.rows]);

    const { hideHacks, hideSubsets } = settings;
    const raGames = useMemo(() => {
        const all = ra.rows.map(PLATFORMS.ra.toLibraryGame);
        return all.filter(g => !(hideHacks && g.flags.hack) && !(hideSubsets && g.flags.subset));
    }, [ra.rows, hideHacks, hideSubsets]);

    // ---------- ações pela plataforma do jogo ----------
    // Os callbacks dependem só das funções (estáveis) de cada plataforma,
    // para o GameCard (memo) não re-renderizar.
    const { refreshGame: steamRefresh, togglePin: steamPin, reloadGame: steamReload } = steam;
    const { refreshGame: raRefresh, togglePin: raPin, reloadGame: raReload } = ra;
    const byPlatform = useMemo(() => ({
        steam: { refreshGame: steamRefresh, togglePin: steamPin, reloadGame: steamReload },
        ra: { refreshGame: raRefresh, togglePin: raPin, reloadGame: raReload },
    }), [steamRefresh, steamPin, steamReload, raRefresh, raPin, raReload]);

    const refreshGame = useCallback((game) => byPlatform[game.platform]?.refreshGame(game.id), [byPlatform]);
    const togglePin = useCallback((game) => byPlatform[game.platform]?.togglePin(game.id), [byPlatform]);
    const reloadGame = useCallback((game) => byPlatform[game.platform]?.reloadGame(game.id), [byPlatform]);

    const isRa = active === "ra";
    return {
        platforms: connected,
        active,
        setActive,
        games: isRa ? raGames : steamGames,
        loading: isRa ? ra.loading : steam.loading,
        syncing: isRa ? ra.syncing : steam.syncing,
        // progresso numérico só na Steam (o RA sincroniza em poucas chamadas)
        progress: isRa ? null : steam.progress,
        refreshingRecent: isRa ? ra.syncing : steam.refreshingRecent,
        error: isRa ? ra.error : false,
        turbo: steam.turbo,
        toggleTurbo: steam.toggleTurbo,
        reload: isRa ? ra.reload : steam.reload,
        refreshRecent: isRa ? ra.refreshRecent : steam.refreshRecent,
        refreshGame,
        togglePin,
        reloadGame,
        // RA: quantos jogos na lista "Quero jogar" (a tela própria lê a lista)
        wantToPlayCount: ra.wantToPlay.length,
    };
}

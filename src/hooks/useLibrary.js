import { AuthContext } from "@/src/context/AuthContext";
import { PLATFORMS } from "@/src/platforms";
import useSteamLibrary from "@/src/platforms/steam/useSteamLibrary";
import { useCallback, useContext, useMemo } from "react";

/**
 * Biblioteca unificada: junta as bibliotecas das plataformas conectadas numa
 * lista só, no formato comum (LibraryGame), e repassa cada ação (atualizar,
 * fixar, reler) para a plataforma do jogo.
 *
 * Por enquanto só a Steam; o RetroAchievements entra na etapa 2 do
 * RETROACHIEVEMENTS_PLAN.md.
 */
export default function useLibrary() {
    const { accounts } = useContext(AuthContext);
    const steam = useSteamLibrary(accounts.steam?.steamId ?? null);

    const games = useMemo(
        () => steam.rows.map(PLATFORMS.steam.toLibraryGame),
        [steam.rows]
    );

    // As ações recebem um LibraryGame. Os callbacks dependem só das funções
    // (estáveis) de cada plataforma, para o GameCard (memo) não re-renderizar.
    const { refreshGame: steamRefresh, togglePin: steamPin, reloadGame: steamReload } = steam;
    const byPlatform = useMemo(() => ({
        steam: { refreshGame: steamRefresh, togglePin: steamPin, reloadGame: steamReload },
    }), [steamRefresh, steamPin, steamReload]);

    const refreshGame = useCallback((game) => byPlatform[game.platform]?.refreshGame(game.id), [byPlatform]);
    const togglePin = useCallback((game) => byPlatform[game.platform]?.togglePin(game.id), [byPlatform]);
    const reloadGame = useCallback((game) => byPlatform[game.platform]?.reloadGame(game.id), [byPlatform]);

    return {
        games,
        loading: steam.loading,
        progress: steam.progress,
        syncing: steam.syncing,
        refreshingRecent: steam.refreshingRecent,
        turbo: steam.turbo,
        toggleTurbo: steam.toggleTurbo,
        reload: steam.reload,
        refreshRecent: steam.refreshRecent,
        refreshGame,
        togglePin,
        reloadGame,
    };
}

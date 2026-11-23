import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Dialog, DialogIcon } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { checkForUpdate, downloadAndInstall, installedVersion, UPDATES_SUPPORTED } from "@/src/utils/appUpdater";
import { showToast } from "@/src/utils/toast";

/**
 * Linha "Verificar atualização" dos ajustes do Perfil (só no Android):
 * consulta a última release do GitHub; se houver versão nova, abre um diálogo
 * com as novidades e "Baixar e instalar" (com o progresso do download), que
 * termina no instalador do Android. Props: style (estilos da linha).
 */
export default function AppUpdateRow({ style, labelStyle }) {
    const { t: tr } = useLanguage();
    const [checking, setChecking] = useState(false);
    const [update, setUpdate] = useState(null);
    const [progress, setProgress] = useState(null); // null = sem download

    if (!UPDATES_SUPPORTED) return null;

    const check = async () => {
        if (checking) return;
        setChecking(true);
        try {
            const result = await checkForUpdate();
            if (result.available) setUpdate(result);
            else showToast(tr("updateLatest", { version: result.current }), "success");
        } catch (err) {
            console.warn("[update] verificação falhou", err?.message);
            showToast(tr("updateCheckFailed"), "error");
        } finally {
            setChecking(false);
        }
    };

    const install = async () => {
        setProgress(0);
        try {
            await downloadAndInstall(update, setProgress);
            setUpdate(null);
        } catch (err) {
            console.warn("[update] instalação falhou", err?.message);
            showToast(tr("updateInstallFailed"), "error");
        } finally {
            setProgress(null);
        }
    };

    const downloading = progress !== null;
    const sizeMb = update?.size ? (update.size / (1024 * 1024)).toFixed(1) : null;

    return (
        <>
            <Pressable
                onPress={check}
                disabled={checking}
                accessibilityRole="button"
                accessibilityState={{ busy: checking }}
                style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}
            >
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={labelStyle}>{tr("updateCheck")}</Text>
                    <Text style={styles.version}>{tr("updateInstalled", { version: installedVersion() })}</Text>
                </View>
                {checking
                    ? <ActivityIndicator size="small" color={COLORS.accent} />
                    : <Ionicons name="cloud-download-outline" size={18} color={COLORS.textMuted} />}
            </Pressable>

            <Dialog
                visible={!!update}
                onClose={() => { if (!downloading) setUpdate(null); }}
                top={<DialogIcon><Ionicons name="rocket-outline" size={26} color={COLORS.accent} /></DialogIcon>}
                title={tr("updateAvailable", { version: update?.version ?? "" })}
            >
                <View style={{ gap: 12 }}>
                    <Text style={styles.meta}>
                        {[tr("updateInstalled", { version: update?.current ?? "" }), sizeMb ? `${sizeMb} MB` : null]
                            .filter(Boolean).join(" · ")}
                    </Text>
                    {update?.notes ? (
                        <ScrollView style={styles.notesBox} contentContainerStyle={{ padding: 12 }}>
                            <Text style={styles.notes}>{update.notes}</Text>
                        </ScrollView>
                    ) : null}
                    <Text style={styles.hint}>{tr("updateHint")}</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Button
                            label={tr("updateLater")}
                            variant="secondary"
                            onPress={() => setUpdate(null)}
                            disabled={downloading}
                            style={{ flex: 1 }}
                        />
                        <Button
                            label={downloading
                                ? tr("updateDownloading", { percent: Math.round(progress * 100) })
                                : tr("updateInstall")}
                            onPress={install}
                            disabled={downloading}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </Dialog>
        </>
    );
}

const styles = StyleSheet.create({
    version: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    meta: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
    notesBox: { maxHeight: 200, borderRadius: 12, backgroundColor: COLORS.bg },
    notes: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: COLORS.textSoft },
    hint: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: COLORS.textMuted, textAlign: "center" },
});

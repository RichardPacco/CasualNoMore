import { Image, StyleSheet, Text, View } from "react-native";
import { Button, Dialog } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Confirmação para remover uma conta salva (redesign, prancheta 12): mostra
 * o avatar da conta e avisa que os jogos continuam no banco.
 * Props: visible, account ({ name, avatar }), onClose, onConfirm.
 */
export default function RemoveAccountModal({ visible, account, onClose, onConfirm }) {
    const { t } = useLanguage();
    const name = account?.name || "";
    const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

    return (
        <Dialog
            visible={visible}
            onClose={onClose}
            role="alertdialog"
            top={account?.avatar ? (
                <Image source={{ uri: account.avatar }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.fallback]}>
                    <Text style={styles.initials}>{initials}</Text>
                </View>
            )}
            title={t("loginRemoveAccountTitle")}
            message={`${t("loginRemoveAccountMessage", { name })} ${t("loginRemoveAccountNote")}`}
        >
            <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label={t("loginCancel")} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <Button label={t("loginRemove")} variant="dangerSolid" onPress={onConfirm} style={{ flex: 1 }} />
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    avatar: { width: 64, height: 64, borderRadius: 32 },
    fallback: { backgroundColor: "#3B3466", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
});

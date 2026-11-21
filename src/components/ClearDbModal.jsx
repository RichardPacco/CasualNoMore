import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Button, Dialog, DialogIcon } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";

/**
 * Confirmação para limpar o banco de dados local (redesign, prancheta 12).
 * Props: visible, onClose, onConfirm.
 */
export default function ClearDbModal({ visible, onClose, onConfirm }) {
    const { t } = useLanguage();

    return (
        <Dialog
            visible={visible}
            onClose={onClose}
            role="alertdialog"
            top={(
                <DialogIcon color={COLORS.danger}>
                    <Ionicons name="server-outline" size={26} color={COLORS.danger} />
                </DialogIcon>
            )}
            title={t("loginClearDbTitle")}
            message={t("loginClearDbMessage")}
        >
            <View style={{ flexDirection: "row", gap: 10 }}>
                <Button label={t("loginCancel")} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <Button label={t("loginClear")} variant="dangerSolid" onPress={onConfirm} style={{ flex: 1 }} />
            </View>
        </Dialog>
    );
}

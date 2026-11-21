import { useState } from "react";
import { Pressable as RNPressable } from "react-native";

/**
 * Substituto do Pressable do React Native com a mesma API.
 *
 * Por que existe: o NativeWind envolve o Pressable (cssInterop) e, com isso,
 * o estilo em forma de função — style={({ pressed }) => [...]} — é ignorado:
 * o componente aparece sem fundo, borda nem layout. Aqui o estado
 * "pressionado" é guardado à parte, a função é chamada com ele e o Pressable
 * real recebe um estilo comum, que o NativeWind trata certo.
 */
export default function Pressable({ style, onPressIn, onPressOut, ...rest }) {
    const [pressed, setPressed] = useState(false);
    const resolvedStyle = typeof style === "function" ? style({ pressed }) : style;

    return (
        <RNPressable
            {...rest}
            onPressIn={(e) => { setPressed(true); onPressIn?.(e); }}
            onPressOut={(e) => { setPressed(false); onPressOut?.(e); }}
            style={resolvedStyle}
        />
    );
}

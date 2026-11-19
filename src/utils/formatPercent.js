/**
 * Percentual global de uma conquista com uma casa decimal e o separador do
 * idioma: "71,4%" em pt, "71.4%" em en. A Steam pode mandar número ou texto
 * (ex.: "71.4000015258789").
 */
export function formatPercent(value, language) {
    const text = (Number(value) || 0).toFixed(1);
    return `${language === "pt" ? text.replace(".", ",") : text}%`;
}

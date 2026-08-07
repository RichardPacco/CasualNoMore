export const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString("pt-Br")
};

export const formatDateTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleDateString("pt-Br")} ${date.toLocaleTimeString("pt-Br", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

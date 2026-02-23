export function getDeviceCategory(width, height) {
  const shortSide = Math.min(width, height);

  if (shortSide < 360) return "compact";
  if (shortSide < 768) return "phone";
  return "tablet";
}

export function getResponsiveMetrics(category) {
  if (category === "compact") {
    return {
      padding: 12,
      radius: 12,
      titleSize: 20,
      bodySize: 14,
      alertHeight: 52,
      mapMinHeight: 320,
    };
  }

  if (category === "tablet") {
    return {
      padding: 22,
      radius: 18,
      titleSize: 30,
      bodySize: 18,
      alertHeight: 64,
      mapMinHeight: 520,
    };
  }

  return {
    padding: 16,
    radius: 14,
    titleSize: 24,
    bodySize: 16,
    alertHeight: 58,
    mapMinHeight: 420,
  };
}

export const colors = {
  bg: "#070f1f",
  panel: "#0f1d36",
  accent: "#23c8d2",
  danger: "#e84855",
  text: "#f2f5ff",
  muted: "#9fb1d0",
  border: "#2b3d5c",
};

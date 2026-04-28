import { StyleSheet } from "react-native";

// White + Blue theme
export const C = {
  bg: "#FFFFFF",
  bg2: "#F8FAFC",
  bg3: "#EFF4F9",
  bgElevated: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  brand: "#2563EB",
  brandActive: "#1D4ED8",
  brandSubtle: "#DBEAFE",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  info: "#0EA5E9",
  purple: "#A855F7",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  pins: {
    not_knocked: "#94A3B8",
    no_answer: "#FACC15",
    not_interested: "#DC2626",
    interested: "#2563EB",
    customer: "#16A34A",
  } as Record<string, string>,
};

export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const R = { sm: 6, md: 12, lg: 16, full: 9999 };

export const statusLabel: Record<string, string> = {
  not_knocked: "Not Knocked", no_answer: "No Answer",
  not_interested: "Not Interested", interested: "Interested", customer: "Customer",
};

export const statusGlyph: Record<string, string> = {
  customer: "✓", not_interested: "✕", interested: "★", no_answer: "?", not_knocked: "○",
};

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg2 },
  screenWhite: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.bg,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  h1: { fontSize: 32, fontWeight: "700", color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: "600", color: C.text },
  h4: { fontSize: 18, fontWeight: "600", color: C.text },
  body: { fontSize: 16, color: C.text },
  bodySmall: { fontSize: 14, color: C.textSecondary },
  caption: { fontSize: 12, color: C.textMuted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  btnPrimary: {
    backgroundColor: C.brand,
    height: 52,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnSecondary: {
    backgroundColor: C.bg3,
    height: 52,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: { color: C.text, fontSize: 16, fontWeight: "600" },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderStrong,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: R.md,
    fontSize: 16,
    color: C.text,
  },
  label: { fontSize: 13, fontWeight: "600", color: C.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
});

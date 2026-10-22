import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
export const colors = {
  bg: "#FAF8F5",
  paper: "#ffffff",
  ink: "#352A43",
  muted: "#827A86",
  line: "#EDE7EE",
  soft: "#EEE8F3",
  rose: "#F5E6E0",
  danger: "#a8453f",
};
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}
export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.ink : "white"} />
      ) : (
        <Text style={[s.buttonText, secondary && { color: colors.ink }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          s.input,
          props.multiline && { height: 100, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Card({
  children,
  tone = "white",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <View style={[s.card, { backgroundColor: tone }]}>{children}</View>;
}
export function Screen({
  children,
  refreshControl,
}: {
  children: React.ReactNode;
  refreshControl?: React.ReactElement;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.screen}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.row}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityLabel={v}
          accessibilityState={{ selected: v === value }}
          onPress={() => onChange(v)}
          style={[s.chip, v === value && { backgroundColor: colors.ink }]}
        >
          <Text style={{ color: v === value ? "white" : colors.ink }}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export const s = StyleSheet.create({
  screen: {
    padding: 22,
    gap: 18,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  heading: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.muted,
    fontWeight: "700",
  },
  body: { fontSize: 14, lineHeight: 23, color: colors.muted },
  fieldLabel: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  input: {
    backgroundColor: "white",
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    minHeight: 50,
  },
  button: {
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontSize: 14, fontWeight: "600" },
  secondary: {
    backgroundColor: "#F2EDF3",
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderColor: colors.line,
    borderWidth: 1,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 30,
    backgroundColor: "#F0EBF0",
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  topbar: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 0,
  },
  brand: { fontSize: 20, color: colors.ink, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.line },
  empty: { paddingVertical: 36, alignItems: "center", gap: 12 },
});

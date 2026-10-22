import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";

// React Native 0.88 provides native backgroundImage gradients.
export function SoftGradient({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ overflow: "hidden", borderRadius: 26 }, style]}>
      <View
        pointerEvents="none"
        accessible={false}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage:
              "linear-gradient(145deg, #DCD5F9 0%, #F1DBEB 50%, #FBE3D1 100%)",
          },
        ]}
      >
        <View
          style={{
            position: "absolute",
            width: 210,
            height: 210,
            borderRadius: 110,
            borderWidth: 1,
            borderColor: "#FFFFFF70",
            right: -90,
            top: -45,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 165,
            height: 165,
            borderRadius: 85,
            borderWidth: 1,
            borderColor: "#FFFFFF70",
            right: -65,
            top: -20,
          }}
        />
      </View>
      {children}
    </View>
  );
}
export function MemoryArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <SoftGradient
      style={{
        height: compact ? 140 : 175,
        width: "100%",
        justifyContent: "center",
        padding: 26,
      }}
    >
      <Text style={{ fontSize: 11, letterSpacing: 3, color: "#71677E" }}>
        OUR LITTLE UNIVERSE
      </Text>
      <Text
        style={{
          fontSize: 32,
          fontWeight: "300",
          color: "#51445F",
          marginTop: 14,
        }}
      >
        每一刻，都有你。
      </Text>
      <Text style={{ fontSize: 12, color: "#8C7788", marginTop: 12 }}>
        把平凡的日子，过成喜欢的样子
      </Text>
      <View
        style={{
          position: "absolute",
          right: 24,
          bottom: 20,
          width: 42,
          height: 42,
          borderRadius: 23,
          borderWidth: 1,
          borderColor: "#FFFFFFAA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, color: "#877399" }}>♡</Text>
      </View>
    </SoftGradient>
  );
}

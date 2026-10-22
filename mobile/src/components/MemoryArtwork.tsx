import React from "react";
import { View, Text } from "react-native";

/** Decorative native illustration. No downloaded photos or fabricated user memories. */
export function MemoryArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        height: compact ? 138 : 190,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 100,
          backgroundColor: "#E9DDF2",
          opacity: 0.6,
          right: 12,
          top: 8,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 116,
          height: 140,
          backgroundColor: "#FFF9F1",
          borderRadius: 8,
          transform: [{ rotate: "-14deg" }],
          left: "18%",
          top: compact ? 14 : 26,
          padding: 8,
          shadowColor: "#281C39",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <View
          style={{
            height: 102,
            backgroundColor: "#BFCFC4",
            overflow: "hidden",
            borderRadius: 3,
          }}
        >
          <View
            style={{
              width: 85,
              height: 85,
              backgroundColor: "#809D8E",
              borderRadius: 22,
              transform: [{ rotate: "40deg" }],
              top: 54,
              left: -18,
            }}
          />
          <View
            style={{
              width: 90,
              height: 90,
              backgroundColor: "#A6B6A4",
              borderRadius: 25,
              transform: [{ rotate: "40deg" }],
              position: "absolute",
              top: 55,
              left: 45,
            }}
          />
        </View>
      </View>
      <View
        style={{
          width: 124,
          height: 148,
          backgroundColor: "#FFFDF9",
          borderRadius: 8,
          transform: [{ rotate: "10deg" }],
          marginLeft: 75,
          padding: 8,
          shadowColor: "#281C39",
          shadowOpacity: 0.14,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
          elevation: 4,
        }}
      >
        <View
          style={{
            height: 107,
            backgroundColor: "#E8C2B1",
            overflow: "hidden",
            borderRadius: 3,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              backgroundColor: "#FFF1CF",
              borderRadius: 20,
              top: 16,
              left: 58,
            }}
          />
          <View
            style={{
              height: 65,
              width: 180,
              backgroundColor: "#C78E83",
              borderRadius: 90,
              position: "absolute",
              top: 70,
              left: -15,
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 9,
            color: "#806E75",
            letterSpacing: 2,
            textAlign: "center",
            marginTop: 7,
          }}
        >
          LITTLE MOMENTS
        </Text>
      </View>
      <Text
        style={{
          position: "absolute",
          right: 25,
          top: 15,
          fontSize: 27,
          color: "#86618C",
        }}
      >
        ✧
      </Text>
    </View>
  );
}

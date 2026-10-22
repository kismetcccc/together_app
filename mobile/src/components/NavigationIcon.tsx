import React from "react";
import { View } from "react-native";

/** Small native geometric icons: no font-dependent glyph rendering. */
export function NavigationIcon({
  index,
  active,
}: {
  index: number;
  active: boolean;
}) {
  const color = active ? "#17457B" : "#626B78";
  const line = { borderWidth: 1.6, borderColor: color };
  return (
    <View
      style={{
        width: 56,
        height: 32,
        borderRadius: 18,
        backgroundColor: active ? "#D3E3FD" : "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {index === 0 && (
        <View
          style={{
            width: 21,
            height: 21,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 3,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ width: 9, height: 9, borderRadius: 2, ...line }}
            />
          ))}
        </View>
      )}
      {index === 1 && (
        <View style={{ width: 20, height: 23, borderRadius: 3, ...line }}>
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 0,
              bottom: 0,
              borderLeftWidth: 1.3,
              borderColor: color,
            }}
          />
        </View>
      )}
      {index === 2 && (
        <View style={{ width: 26, height: 24 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{ position: "absolute", left: i * 12, top: i * 3 }}
            >
              <View style={{ width: 9, height: 9, borderRadius: 5, ...line }} />
              <View
                style={{
                  width: 13,
                  height: 9,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  marginLeft: -2,
                  marginTop: 2,
                  ...line,
                }}
              />
            </View>
          ))}
        </View>
      )}
      {index === 3 && (
        <View style={{ width: 21, height: 21, borderRadius: 4, ...line }}>
          <View
            style={{ height: 6, borderBottomWidth: 1.5, borderColor: color }}
          />
          <View
            style={{
              width: 4,
              height: 4,
              backgroundColor: color,
              margin: 4,
              borderRadius: 1,
            }}
          />
        </View>
      )}
      {index === 4 && (
        <View
          style={{
            width: 23,
            height: 23,
            borderRadius: 12,
            ...line,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              marginTop: 3,
              ...line,
            }}
          />
          <View
            style={{
              width: 15,
              height: 10,
              borderRadius: 8,
              marginTop: 2,
              ...line,
            }}
          />
        </View>
      )}
    </View>
  );
}

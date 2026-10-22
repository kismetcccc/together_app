import React, { useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { api } from "../lib/client";
import { colors, s } from "./UI";
export function PrivateImage({
  path,
  label,
  height = 200,
}: {
  path: string;
  label: string;
  height?: number;
}) {
  const [uri, setUri] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true,
      objectUrl = "";
    setFailed(false);
    setUri("");
    if (!path || !api) return;
    const url = api.photoUrl(path);
    if (Platform.OS === "web") {
      fetch(url, { headers: api.authorization, credentials: "omit" })
        .then(async (r) => {
          if (!r.ok) throw Error();
          return r.blob();
        })
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          if (active) setUri(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    } else setUri(url);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return uri && !failed ? (
    <Image
      accessibilityLabel={label}
      source={{
        uri,
        ...(Platform.OS === "web" ? {} : { headers: api?.authorization }),
      }}
      style={{
        width: "100%",
        height,
        borderRadius: 18,
        backgroundColor: colors.soft,
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <View
      style={{
        height,
        borderRadius: 18,
        backgroundColor: colors.soft,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 36, color: colors.ink }}>♡</Text>
      <Text style={s.small}>
        {failed
          ? "照片暂时无法加载"
          : path
            ? "正在加载照片"
            : "从第一张照片开始"}
      </Text>
    </View>
  );
}

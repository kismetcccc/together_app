import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import type { Album } from "../types";
import { PrivateImage } from "./PrivateImage";
import { categories } from "../lib/links";

export function PhotoWall({
  albums,
  category,
  onCategory,
  onAlbum,
  refreshControl,
}: {
  albums: Album[];
  category: string;
  onCategory: (v: string) => void;
  onAlbum: (id: string) => void;
  refreshControl: React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const tileWidth = ((measuredWidth || Math.min(width, 720) - 24) - 4) / 2;
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const filtered = albums.filter(
    (a) => category === "全部" || a.category === category,
  );
  const photos = filtered
    .flatMap((album) => album.photos.map((photo) => ({ album, photo })))
    .sort(
      (a, b) =>
        b.photo.date.localeCompare(a.photo.date) ||
        a.photo.id.localeCompare(b.photo.id),
    );
  const columns: (typeof photos)[] = [[], []];
  const heights = [0, 0];
  for (const item of photos) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    columns[col].push(item);
    heights[col] += tileWidth / (ratios[item.photo.id] || 1) + 4;
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: 24,
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
      >
        <View
          onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
          style={{ flexDirection: "row", gap: 4 }}
        >
          {columns.map((items, i) => (
            <View key={i} style={{ flex: 1, gap: 4 }}>
              {items.map(({ album, photo }) => (
                <Pressable
                  key={photo.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${photo.caption || "照片"}，打开相册 ${album.title}`}
                  onPress={() => onAlbum(album.id)}
                >
                  <PrivateImage
                    path={photo.url}
                    label={photo.caption || album.title}
                    height={tileWidth / (ratios[photo.id] || 1)}
                    radius={2}
                    onDimensions={(w, h) => {
                      if (w > 0 && h > 0) {
                        const next = w / h;
                        setRatios((old) =>
                          old[photo.id] === next
                            ? old
                            : { ...old, [photo.id]: next },
                        );
                      }
                    }}
                  />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        {!photos.length && (
          <View style={{ paddingVertical: 100, alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 17, color: "#222" }}>还没有照片</Text>
            <Text style={{ fontSize: 13, color: "#888" }}>
              从右上角创建相册，或打开下方相册上传
            </Text>
          </View>
        )}
        {filtered
          .filter((a) => !a.photos.length)
          .map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`打开相册 ${a.title}`}
              onPress={() => onAlbum(a.id)}
              style={{
                minHeight: 52,
                justifyContent: "center",
                borderBottomWidth: 0.5,
                borderColor: "#eee",
              }}
            >
              <Text style={{ color: "#444", fontSize: 14 }}>
                {a.title} <Text style={{ color: "#999" }}>· 暂无照片 ›</Text>
              </Text>
            </Pressable>
          ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          borderTopWidth: 0.5,
          borderColor: "#eee",
          backgroundColor: "#fff",
        }}
      >
        {["全部", ...categories].map((c) => (
          <Pressable
            key={c}
            accessibilityRole="tab"
            accessibilityLabel={c}
            accessibilityState={{ selected: category === c }}
            onPress={() => onCategory(c)}
            style={{
              minHeight: 48,
              paddingHorizontal: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: category === c ? "#111" : "#999",
                fontWeight: category === c ? "600" : "400",
              }}
            >
              {c}
            </Text>
            <View
              style={{
                height: 1,
                width: 12,
                marginTop: 5,
                backgroundColor: category === c ? "#111" : "transparent",
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

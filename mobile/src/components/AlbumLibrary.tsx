import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import type { Album } from "../types";
import { PrivateImage } from "./PrivateImage";
import { categories } from "../lib/links";

const inspiration = [
  {
    image: "photo-1669604120699-eeba651ac235",
    label: "清晨的湖与山",
    author: "ConfinedRiley",
    page: "https://unsplash.com/photos/mIj8Cn3oNDg",
    height: 222,
  },
  {
    image: "photo-1761867704719-72b597a619d7",
    label: "一起走进山野",
    author: "Kayla Takes Photos",
    page: "https://unsplash.com/photos/yqp4GmWR2Nw",
    height: 154,
  },
  {
    image: "photo-1635965072050-9b608060234d",
    label: "山间的一天",
    author: "Harrison Steen",
    page: "https://unsplash.com/photos/d01xcR3puFA",
    height: 190,
  },
];
function InspirationPhoto({ photo }: { photo: (typeof inspiration)[number] }) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <View style={{ gap: 8 }}>
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`重试加载${photo.label}`}
          onPress={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          style={{
            height: photo.height,
            backgroundColor: "#f5f5f5",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#777", fontSize: 12 }}>轻点重新加载</Text>
        </Pressable>
      ) : (
        <Image
          key={attempt}
          source={{
            uri: `https://images.unsplash.com/${photo.image}?auto=format&fit=crop&w=640&q=80`,
          }}
          accessibilityLabel={photo.label}
          style={{
            height: photo.height,
            width: "100%",
            borderRadius: 12,
            backgroundColor: "#f4f4f4",
          }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
      <Text style={{ fontSize: 12, color: "#333" }}>{photo.label}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`在 Unsplash 查看 ${photo.author} 的照片`}
        onPress={() => {
          void Linking.openURL(photo.page).catch(() => {});
        }}
        style={{ minHeight: 30, justifyContent: "center" }}
      >
        <Text numberOfLines={1} style={{ fontSize: 10, color: "#8c8c8c" }}>
          {photo.author} / Unsplash ↗
        </Text>
      </Pressable>
    </View>
  );
}
function updatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} 更新`;
}
export function AlbumLibrary({
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
  const [showExamples, setShowExamples] = useState(true);
  const filtered = albums
    .filter((a) => category === "全部" || a.category === category)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ paddingBottom: 16, paddingTop: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
        >
          {["全部", ...categories].map((c) => (
            <Pressable
              key={c}
              accessibilityRole="tab"
              accessibilityLabel={c}
              accessibilityState={{ selected: category === c }}
              onPress={() => onCategory(c)}
              style={{
                paddingHorizontal: 18,
                height: 44,
                borderRadius: 24,
                backgroundColor: category === c ? "#191919" : "#F5F5F5",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: category === c ? "#fff" : "#777",
                  fontWeight: category === c ? "500" : "400",
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 4,
          paddingBottom: 28,
          width: "100%",
          maxWidth: 600,
          alignSelf: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <Text style={{ fontSize: 13, color: "#777" }}>我的相册</Text>
          <Text style={{ fontSize: 12, color: "#999" }}>
            {filtered.length} 本
          </Text>
        </View>
        {filtered.map((album) => (
          <Pressable
            key={album.id}
            accessibilityRole="button"
            accessibilityLabel={`打开相册 ${album.title}`}
            onPress={() => onAlbum(album.id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: 16,
              alignItems: "center",
              padding: 12,
              borderRadius: 18,
              backgroundColor: pressed ? "#fafafa" : "#fff",
              borderWidth: 0.5,
              borderColor: "#ededed",
              shadowColor: "#000",
              shadowOpacity: 0.035,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 1,
            })}
          >
            <View style={{ width: 82 }}>
              <PrivateImage
                path={album.cover}
                label={album.title}
                height={82}
                radius={12}
              />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 15,
                  lineHeight: 22,
                  fontWeight: "500",
                  color: "#222",
                }}
              >
                {album.title}
              </Text>
              <Text style={{ fontSize: 12, color: "#777" }}>
                {album.photos.length} 张照片 ·{" "}
                {album.members.filter((m) => !m.pending).length} 位成员
              </Text>
              <Text style={{ fontSize: 10, color: "#999" }}>
                {updatedAt(album.updatedAt)}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: "#b5b5b5" }}>›</Text>
          </Pressable>
        ))}
        {!filtered.length && (
          <View style={{ paddingVertical: 30, gap: 9 }}>
            <Text style={{ fontSize: 16, color: "#333" }}>
              还没有{category === "全部" ? "" : category}相册
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>
              轻点右上角 ＋，开始记录。
            </Text>
          </View>
        )}
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "500", color: "#222" }}>
            摄影灵感
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowExamples((v) => !v)}
            style={{ minHeight: 44, justifyContent: "center", paddingLeft: 16 }}
          >
            <Text style={{ color: "#888", fontSize: 12 }}>
              {showExamples ? "收起示例" : "展开示例"}
            </Text>
          </Pressable>
        </View>
        {showExamples && (
          <>
            <Text
              style={{
                fontSize: 11,
                color: "#999",
                lineHeight: 18,
                marginTop: -10,
              }}
            >
              Unsplash 照片示例 · 不属于你的相册
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 16 }}>
                <InspirationPhoto photo={inspiration[0]} />
              </View>
              <View style={{ flex: 1, gap: 16 }}>
                <InspirationPhoto photo={inspiration[1]} />
                <InspirationPhoto photo={inspiration[2]} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

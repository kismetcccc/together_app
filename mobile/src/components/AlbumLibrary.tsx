import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import type { Album, Photo } from "../types";
import { PrivateImage } from "./PrivateImage";
import { libraryAlbums, libraryPhotos } from "../lib/library";
import { categories } from "../lib/links";

export function AlbumLibrary({
  albums,
  category,
  onCategory,
  onAlbum,
  onPhoto,
  mode = "相册",
  refreshControl,
}: {
  albums: Album[];
  category: string;
  onCategory: (v: string) => void;
  onAlbum: (id: string) => void;
  onPhoto: (album: Album, photo: Photo) => void;
  mode?: string;
  refreshControl: React.ReactElement;
}) {
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState(390);
  const shared = mode === "共享";
  const photosView = mode === "照片";
  const filtered = libraryAlbums(albums, mode, category, query);
  const photos = libraryPhotos(albums, query);
  const dates = [...new Set(photos.map((p) => p.photo.date))];
  const tile = (width - 8) / 3;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View
          style={{
            backgroundColor: "#F0F4F9",
            borderRadius: 28,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 23, color: "#485568" }}>⌕</Text>
          <TextInput
            accessibilityLabel="搜索照片或相册"
            placeholder={photosView ? "搜索照片、日期或相册" : "搜索相册"}
            placeholderTextColor="#657080"
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, height: 48, fontSize: 14, color: "#202124" }}
            clearButtonMode="while-editing"
          />
          {!!query && (
            <Pressable
              accessibilityLabel="清除搜索"
              onPress={() => setQuery("")}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>×</Text>
            </Pressable>
          )}
        </View>
      </View>
      {!photosView && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 14,
            gap: 8,
          }}
        >
          {["全部", ...categories].map((c) => (
            <Pressable
              key={c}
              accessibilityRole="tab"
              accessibilityState={{ selected: category === c }}
              onPress={() => onCategory(c)}
              style={{
                paddingHorizontal: 18,
                minHeight: 44,
                borderRadius: 12,
                justifyContent: "center",
                backgroundColor: category === c ? "#D3E3FD" : "#F4F6F8",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: category === c ? "#16427C" : "#525C69",
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View
          style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 20 }}
        >
          <Text style={{ fontSize: 22, fontWeight: "400", color: "#202124" }}>
            {photosView ? "照片" : shared ? "一起留下的回忆" : "你的相册"}
          </Text>
          <Text style={{ fontSize: 12, color: "#697586", marginTop: 8 }}>
            {photosView
              ? `${photos.length} 张照片 · 按拍摄日期排列`
              : shared
                ? "打开相册，与好友一起添加和编辑照片"
                : `${filtered.length} 本相册 · 收藏生活的不同切面`}
          </Text>
        </View>
        {photosView ? (
          dates.map((date) => (
            <View key={date} style={{ marginBottom: 20 }}>
              <View
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "500", color: "#30343B" }}
                >
                  {date || "未注明日期"}
                </Text>
                <Text style={{ fontSize: 12, color: "#79828F" }}>
                  {photos.filter((p) => p.photo.date === date).length} 张
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 2,
                  paddingHorizontal: 2,
                }}
              >
                {photos
                  .filter((p) => p.photo.date === date)
                  .map(({ album, photo }) => (
                    <Pressable
                      key={`${album.id}:${photo.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`查看照片 ${photo.caption || photo.date}`}
                      onPress={() => onPhoto(album, photo)}
                      style={{ width: tile }}
                    >
                      <PrivateImage
                        path={photo.url}
                        label={photo.caption}
                        height={tile}
                        radius={2}
                      />
                      {photo.favorite && (
                        <Text
                          style={{
                            position: "absolute",
                            bottom: 7,
                            right: 8,
                            color: "#fff",
                            fontSize: 17,
                          }}
                        >
                          ♥
                        </Text>
                      )}
                    </Pressable>
                  ))}
              </View>
            </View>
          ))
        ) : (
          <View
            style={{
              paddingHorizontal: 20,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {filtered.map((album) => (
              <Pressable
                key={album.id}
                accessibilityRole="button"
                accessibilityLabel={`打开相册 ${album.title}`}
                onPress={() => onAlbum(album.id)}
                style={{ width: (width - 56) / 2, marginBottom: 10 }}
              >
                <PrivateImage
                  path={album.cover || album.photos[0]?.url || ""}
                  label={album.title}
                  height={(width - 56) / 2}
                  radius={18}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#252930",
                    marginTop: 12,
                  }}
                >
                  {album.title}
                </Text>
                <Text style={{ fontSize: 12, color: "#727C89", marginTop: 5 }}>
                  {album.photos.length} 张照片
                  {album.members.length > 1 ? " · 已共享" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {(photosView ? !photos.length : !filtered.length) && (
          <View style={{ padding: 36, alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: "#E8F0FE",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 32, color: "#41648E" }}>▧</Text>
            </View>
            <Text style={{ fontSize: 17, color: "#30343B" }}>
              {query
                ? "没有找到相关内容"
                : shared
                  ? "回忆，值得一起收藏"
                  : "把第一段回忆放进来"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#748091",
                lineHeight: 22,
                textAlign: "center",
              }}
            >
              {query
                ? "试试其他名称、描述或日期。"
                : shared
                  ? "在相册中邀请好友，或在“我的”中打开邀请链接。"
                  : "点击右上角 ＋ 创建相册，再添加你的照片。"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Clipboard from "expo-clipboard";
import { api } from "./lib/client";
import { ApiError } from "./lib/api";
import {
  categories,
  daysUntil,
  localDate,
  parseMailLink,
  type MailLink,
} from "./lib/links";
import type {
  Album,
  AlbumDraft,
  Category,
  Photo,
  Snapshot,
  InvitationResult,
} from "./types";
import { AuthScreen } from "./components/AuthScreen";
import { PrivateImage } from "./components/PrivateImage";
import {
  Body,
  Button,
  Card,
  Chips,
  Field,
  Heading,
  Label,
  Screen,
  colors,
  s,
} from "./components/UI";

type Sheet =
  | { kind: "album"; album?: Album }
  | { kind: "photo"; album: Album; photo: Photo }
  | { kind: "members"; album: Album }
  | { kind: "link" }
  | { kind: "forgot"; email: string }
  | { kind: "date" }
  | {
      kind: "confirm";
      title: string;
      description: string;
      action: () => Promise<void>;
    };
const empty: Snapshot = { user: null, albums: [], anniversaries: [] };
export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
function Root() {
  const [data, setData] = useState<Snapshot>(empty),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("相册"),
    [selected, setSelected] = useState<string | null>(null),
    [category, setCategory] = useState("全部"),
    [query, setQuery] = useState(""),
    [sheet, setSheet] = useState<Sheet | null>(null),
    [pending, setPending] = useState<MailLink | null>(null);
  const lock = useRef(false),
    generation = useRef(0);
  async function refresh(id?: string) {
    if (!api) return;
    const ticket = ++generation.current;
    if (id) {
      const album = await api!.album(id);
      if (ticket === generation.current)
        setData((old) => ({
          ...old,
          albums: old.albums.map((a) => (a.id === id ? album : a)),
        }));
    } else {
      const result = await api!.snapshot();
      if (ticket === generation.current) setData(result);
    }
  }
  async function initialize() {
    setError("");
    try {
      if (api) {
        await api!.restore();
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "初始化失败");
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void initialize();
    const handle = (url: string) => {
      const link = parseMailLink(url);
      if (link) {
        setPending(link);
        setSheet({ kind: "link" });
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    const sub = Linking.addEventListener("url", (event) => handle(event.url));
    return () => {
      generation.current++;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!data.user || sheet || busy) return;
    const sync = () => {
      if (AppState.currentState === "active") refresh().catch(() => {});
    };
    const interval = setInterval(sync, 60000),
      sub = AppState.addEventListener("change", (state) => {
        if (state === "active") sync();
      });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [data.user?.id, sheet, busy]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      if (tab !== "相册") {
        setTab("相册");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sheet, selected, tab, busy]);
  async function work(fn: () => Promise<void>, message = "", close = true) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (close) setSheet(null);
      if (message) setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
      if (e instanceof ApiError && e.status === 401) {
        setData(empty);
        setSelected(null);
        setSheet(null);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(next: Sheet) {
    setError("");
    setNotice("");
    setSheet(next);
  }
  const selectedAlbum = data.albums.find((a) => a.id === selected);
  const canEdit = (album: Album) =>
    album.role === "owner" || album.role === "editor";
  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setRefreshing(false);
    }
  }
  async function upload(album: Album) {
    await work(
      async () => {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw Error("未获得照片访问权限，请在系统设置中允许选择照片。");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: 4,
          quality: 1,
          exif: false,
        });
        if (result.canceled) return;
        if (result.assets.length > 4) throw Error("每次最多上传 4 张照片");
        let completed = 0;
        try {
          for (const asset of result.assets) {
            const context = ImageManipulator.manipulate(asset.uri);
            if (asset.width > 1600 || asset.height > 1600)
              context.resize(
                asset.width >= asset.height
                  ? { width: 1600 }
                  : { height: 1600 },
              );
            const image = await context.renderAsync();
            const jpeg = await image.saveAsync({
              format: SaveFormat.JPEG,
              compress: 0.78,
              base64: true,
            });
            if (!jpeg.base64 || jpeg.base64.length > 4 * 1024 * 1024)
              throw Error("照片压缩后超过 3 MB，请选择较小图片");
            await api!.upload(album.id, {
              url: "data:image/jpeg;base64," + jpeg.base64,
              caption: (asset.fileName || "我们的瞬间")
                .replace(/\.[^.]+$/, "")
                .slice(0, 200),
              date: localDate(),
            });
            completed++;
          }
        } catch (e) {
          await refresh(album.id).catch(() => {});
          throw Error(
            `已上传 ${completed}/${result.assets.length} 张，请只重试剩余照片。${e instanceof Error ? e.message : ""}`,
          );
        }
        await refresh(album.id);
        setNotice(`已上传 ${completed} 张照片`);
      },
      "",
      false,
    );
  }
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void reload()}
      tintColor={colors.ink}
    />
  );
  if (!api)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Screen>
          <Heading>连接你的同频服务</Heading>
          <Body>
            请复制 mobile/.env.example 为 .env，填写
            EXPO_PUBLIC_API_URL，再重新启动 Expo。必须使用本仓库后端，App
            不会连接演示账号或假数据。
          </Body>
        </Screen>
      </SafeAreaView>
    );
  if (!ready)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Text style={s.brand}>∞ 同频 Together</Text>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <View style={s.topbar}>
        <Text style={s.brand}>
          ∞ 同频{" "}
          <Text style={{ fontSize: 11, letterSpacing: 2 }}>TOGETHER</Text>
        </Text>
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={s.small}>只与在意的人分享</Text>
        )}
      </View>
      {!sheet && !!error && (
        <View style={{ padding: 16, backgroundColor: colors.rose, gap: 8 }}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Button title="重新加载" secondary onPress={() => void reload()} />
        </View>
      )}
      {!sheet && !!notice && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          onPress={() => setNotice("")}
          style={{ padding: 14, backgroundColor: colors.soft }}
        >
          <Text style={{ color: colors.ink }}>{notice}</Text>
        </Pressable>
      )}
      {!data.user ? (
        <AuthScreen
          busy={busy}
          onSubmit={(email, password, name) =>
            void work(async () => {
              const user = await api!.signIn(email, password, name);
              await refresh();
              setNotice(
                user.mailDelivery === "failed"
                  ? "账号已创建，但邮件暂未发出，请重新发送验证邮件。"
                  : user.emailVerified
                    ? "欢迎回到同频"
                    : "请查看邮箱，打开验证链接。",
              );
            })
          }
          onForgot={(email) => open({ kind: "forgot", email })}
          onLink={() => open({ kind: "link" })}
        />
      ) : (
        <>
          {pending && !sheet && (
            <View style={{ padding: 12 }}>
              <Button
                secondary
                title="继续处理收到的链接"
                onPress={() => open({ kind: "link" })}
              />
            </View>
          )}
          {!data.user.emailVerified && (
            <View style={{ padding: 16, gap: 8, backgroundColor: colors.rose }}>
              <Text style={s.title}>先确认你的 QQ 邮箱</Text>
              <Body>验证后才能上传照片、创建相册和接受邀请。</Body>
              <View style={s.row}>
                <Button
                  title="重新发送验证邮件"
                  disabled={busy}
                  onPress={() =>
                    void work(
                      async () => {
                        await api!.resend();
                      },
                      "验证邮件已发送",
                      false,
                    )
                  }
                />
                <Button
                  secondary
                  title="粘贴验证链接"
                  onPress={() => open({ kind: "link" })}
                />
                <Button
                  secondary
                  title="我已验证，刷新"
                  onPress={() => void reload()}
                />
              </View>
            </View>
          )}
          {tab === "相册" && !selectedAlbum && (
            <Screen refreshControl={refreshControl}>
              <Label>OUR LITTLE COLLECTION</Label>
              <Heading>一起收藏的日子</Heading>
              <Body>
                你好，{data.user.name}
                。有些瞬间，一个人记得是回忆，一起记得，就成了故事。
              </Body>
              <Card tone={colors.soft}>
                <Text style={{ fontSize: 40, color: colors.ink }}>♡</Text>
                <Text style={s.title}>为重要的人，留一个位置。</Text>
                <View style={s.row}>
                  <Text style={s.title}>{data.albums.length} 本相册</Text>
                  <Body>
                    · {data.albums.reduce((n, a) => n + a.photos.length, 0)}{" "}
                    个瞬间
                  </Body>
                </View>
                <Button
                  title="＋ 创建我们的相册"
                  disabled={!data.user.emailVerified || busy}
                  onPress={() => open({ kind: "album" })}
                />
              </Card>
              <Chips
                values={["全部", ...categories]}
                value={category}
                onChange={setCategory}
              />
              <Field
                label="搜索相册"
                placeholder="相册名称、故事…"
                value={query}
                onChangeText={setQuery}
              />
              {data.albums
                .filter(
                  (a) =>
                    (category === "全部" || a.category === category) &&
                    (a.title + a.description).includes(query),
                )
                .map((album) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`打开相册 ${album.title}`}
                    key={album.id}
                    onPress={() => setSelected(album.id)}
                  >
                    <Card>
                      <PrivateImage path={album.cover} label={album.title} />
                      <Label>
                        {album.category} ·{" "}
                        {album.role === "owner" ? "我的相册" : "共同收藏"}
                      </Label>
                      <Text style={s.title}>{album.title}</Text>
                      <Body>
                        {album.description ||
                          "从一张照片开始，写下我们的故事。"}
                      </Body>
                      <Text style={s.small}>
                        {album.photos.length} 张照片 ·{" "}
                        {album.members.filter((m) => !m.pending).length} 位成员
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              {data.albums.length === 0 && (
                <View style={s.empty}>
                  <Text style={{ fontSize: 40 }}>✧</Text>
                  <Body>第一本相册，从这里开始。</Body>
                </View>
              )}
            </Screen>
          )}
          {tab === "相册" && selectedAlbum && (
            <Screen refreshControl={refreshControl}>
              <Button
                secondary
                title="‹ 所有相册"
                onPress={() => setSelected(null)}
              />
              <Label>{selectedAlbum.category} · OUR SHARED STORY</Label>
              <Heading>{selectedAlbum.title}</Heading>
              <Body>
                {selectedAlbum.description || "把平凡的日子，过成一起的故事。"}
              </Body>
              <Text style={s.small}>
                {selectedAlbum.members.filter((m) => !m.pending).length} 位成员
                · {selectedAlbum.photos.length} 张照片 ·{" "}
                {selectedAlbum.role === "viewer"
                  ? "只读成员"
                  : selectedAlbum.role === "owner"
                    ? "创建者"
                    : "共同编辑"}
              </Text>
              <View style={s.row}>
                <Button
                  title="＋ 上传照片"
                  disabled={
                    busy || !canEdit(selectedAlbum) || !data.user.emailVerified
                  }
                  onPress={() => void upload(selectedAlbum)}
                />
                <Button
                  secondary
                  title="编辑相册"
                  disabled={busy || !canEdit(selectedAlbum)}
                  onPress={() => open({ kind: "album", album: selectedAlbum })}
                />
                <Button
                  secondary
                  title="成员与邀请"
                  onPress={() =>
                    open({ kind: "members", album: selectedAlbum })
                  }
                />
              </View>
              {!selectedAlbum.photos.length && (
                <Card tone={colors.soft}>
                  <Heading>第一张照片，{"\n"}会是什么呢？</Heading>
                  <Body>从手机相册选一张喜欢的照片，故事就开始了。</Body>
                </Card>
              )}
              {selectedAlbum.photos.map((photo) => (
                <Card key={photo.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`查看照片 ${photo.caption}`}
                    onPress={() =>
                      open({ kind: "photo", album: selectedAlbum, photo })
                    }
                  >
                    <PrivateImage
                      path={photo.url}
                      label={photo.caption}
                      height={260}
                    />
                  </Pressable>
                  <Text style={s.title}>{photo.caption || "无标题瞬间"}</Text>
                  <Text style={s.small}>
                    {photo.date} · {photo.author}
                  </Text>
                  <Button
                    secondary
                    title={photo.favorite ? "♥ 已收藏" : "♡ 收藏这张照片"}
                    disabled={busy}
                    onPress={() =>
                      void work(
                        async () => {
                          await api!.editPhoto(selectedAlbum.id, photo, {
                            favorite: !photo.favorite,
                          });
                          await refresh(selectedAlbum.id);
                        },
                        "收藏已更新",
                        false,
                      )
                    }
                  />
                </Card>
              ))}
            </Screen>
          )}
          {tab === "纪念日" && (
            <Screen refreshControl={refreshControl}>
              <Label>DAYS THAT MATTER</Label>
              <Heading>重要的日子，{"\n"}我们一起记得。</Heading>
              <Body>
                把相识、相爱和相聚，写进时光里。当前提供日期与倒数展示，尚未启用系统通知。
              </Body>
              <Button
                title="＋ 记住一个日子"
                disabled={busy || !data.user.emailVerified}
                onPress={() => open({ kind: "date" })}
              />
              {data.anniversaries.map((item) => (
                <Card key={item.id} tone={colors.soft}>
                  <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                  <Text style={s.title}>{item.title}</Text>
                  <Heading>
                    {daysUntil(item.date) >= 0
                      ? `还有 ${daysUntil(item.date)} 天`
                      : `已经 ${-daysUntil(item.date)} 天`}
                  </Heading>
                  <Body>{item.date}</Body>
                  <Button
                    secondary
                    title="删除纪念日"
                    disabled={busy}
                    onPress={() =>
                      open({
                        kind: "confirm",
                        title: "删除纪念日",
                        description: `确定删除「${item.title}」？删除后无法恢复。`,
                        action: async () => {
                          await api!.deleteDate(item.id);
                          await refresh();
                        },
                      })
                    }
                  />
                </Card>
              ))}
              {!data.anniversaries.length && (
                <Body>还没有纪念日，添加你们的第一个特别日期吧。</Body>
              )}
            </Screen>
          )}
          {tab === "我的" && (
            <Screen>
              <Label>YOUR PRIVATE SPACE</Label>
              <Heading>你好，{data.user.name}</Heading>
              <Card>
                <Text style={s.title}>{data.user.email}</Text>
                <Body>
                  {data.user.emailVerified ? "邮箱已验证" : "邮箱待验证"} ·
                  会话加密保存在设备上
                </Body>
                <Button
                  title="打开邀请 / 验证链接"
                  onPress={() => open({ kind: "link" })}
                />
                <Button
                  secondary
                  title="通过邮箱重置密码"
                  onPress={() =>
                    open({ kind: "forgot", email: data.user!.email })
                  }
                />
                <Button
                  secondary
                  title="刷新我的空间"
                  disabled={busy}
                  onPress={() => void reload()}
                />
              </Card>
              <Card tone={colors.rose}>
                <Text style={s.title}>关于我们的相册</Text>
                <Body>
                  照片仅对相册成员开放。创建者可以邀请和移除成员，编辑者可上传与修改，只读成员可浏览与收藏。
                </Body>
                <Body>
                  下拉可手动刷新；应用在前台且未编辑时，每 60 秒同步一次。
                </Body>
              </Card>
              <Button
                secondary
                title="退出登录"
                disabled={busy}
                onPress={() =>
                  void work(async () => {
                    await api!.signOut();
                    generation.current++;
                    setData(empty);
                    setSelected(null);
                    setTab("相册");
                  }, "已退出登录")
                }
              />
            </Screen>
          )}
          <View
            style={{
              flexDirection: "row",
              padding: 12,
              gap: 10,
              borderTopWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.paper,
            }}
          >
            {["相册", "纪念日", "我的"].map((name, index) => (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityLabel={name}
                accessibilityState={{ selected: tab === name }}
                onPress={() => {
                  setTab(name);
                  setSelected(null);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: tab === name ? colors.soft : colors.paper,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 20, color: colors.ink }}>
                  {["▧", "♡", "○"][index]}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.ink,
                    fontWeight: tab === name ? "700" : "400",
                  }}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <Modal
        visible={!!sheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) setSheet(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.topbar}>
            <Text style={s.brand}>同频 · 一起记录</Text>
            <Button
              secondary
              title="关闭"
              disabled={busy}
              onPress={() => setSheet(null)}
            />
          </View>
          {!!error && (
            <View style={{ padding: 16, backgroundColor: colors.rose }}>
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
              {error.includes("更新") && (
                <Body>请先复制你的输入，再关闭表单、下拉刷新后重新编辑。</Body>
              )}
            </View>
          )}
          {busy && (
            <ActivityIndicator style={{ padding: 10 }} color={colors.ink} />
          )}
          {sheet?.kind === "album" && (
            <AlbumForm
              album={sheet.album}
              busy={busy}
              onSave={(draft) =>
                void work(async () => {
                  if (sheet.album) {
                    await api!.editAlbum(sheet.album, draft);
                    await refresh(sheet.album.id);
                  } else {
                    const album = await api!.createAlbum(draft);
                    await refresh();
                    setSelected(album.id);
                    setTab("相册");
                  }
                }, "相册已保存")
              }
            />
          )}
          {sheet?.kind === "photo" && (
            <PhotoForm
              photo={sheet.photo}
              editable={canEdit(sheet.album)}
              busy={busy}
              onSave={(caption) =>
                void work(async () => {
                  await api!.editPhoto(sheet.album.id, sheet.photo, {
                    caption,
                  });
                  await refresh(sheet.album.id);
                }, "照片说明已保存")
              }
              onDelete={() =>
                open({
                  kind: "confirm",
                  title: "移除照片",
                  description:
                    "照片将从共享相册中永久移除，其他成员也无法再看到。确定继续？",
                  action: async () => {
                    await api!.deletePhoto(sheet.album.id, sheet.photo);
                    await refresh(sheet.album.id);
                  },
                })
              }
            />
          )}
          {sheet?.kind === "members" && (
            <MembersForm
              album={
                data.albums.find((a) => a.id === sheet.album.id) || sheet.album
              }
              busy={busy}
              onInvite={(email, role, onResult) =>
                void work(
                  async () => {
                    const result = await api!.invite(
                      sheet.album.id,
                      email,
                      role,
                    );
                    await refresh(sheet.album.id);
                    onResult(result);
                  },
                  "",
                  false,
                )
              }
              onRemove={(id, name) =>
                open({
                  kind: "confirm",
                  title: "移除成员或撤销邀请",
                  description: `「${name}」将无法继续访问这本相册。`,
                  action: async () => {
                    await api!.removeMember(sheet.album.id, id);
                    await refresh(sheet.album.id);
                  },
                })
              }
            />
          )}
          {sheet?.kind === "forgot" && (
            <ForgotForm
              email={sheet.email}
              busy={busy}
              onSend={(email) =>
                void work(async () => {
                  const result = await api!.forgot(email);
                  setNotice(result.message);
                })
              }
            />
          )}
          {sheet?.kind === "link" && (
            <LinkForm
              pending={pending}
              user={data.user}
              busy={busy}
              onParsed={setPending}
              onApply={(link, password) =>
                void work(async () => {
                  if (link.kind === "verify") {
                    await api!.verify(link.token);
                    await refresh();
                    setNotice("邮箱验证成功");
                  } else if (link.kind === "reset") {
                    await api!.reset(link.token, password!);
                    await api!.clear();
                    generation.current++;
                    setData(empty);
                    setSelected(null);
                    setNotice("密码已重置，请使用新密码登录");
                  } else {
                    const result = await api!.accept(link.token);
                    await refresh();
                    setSelected(result.albumId);
                    setTab("相册");
                    setNotice("已加入共享相册");
                  }
                  setPending(null);
                })
              }
            />
          )}
          {sheet?.kind === "date" && (
            <DateForm
              busy={busy}
              onSave={(value) =>
                void work(async () => {
                  await api!.createDate(value);
                  await refresh();
                }, "纪念日已记录")
              }
            />
          )}
          {sheet?.kind === "confirm" && (
            <Screen>
              <Heading>{sheet.title}</Heading>
              <Body>{sheet.description}</Body>
              <Button
                danger
                title="确认操作"
                loading={busy}
                onPress={() => void work(sheet.action, "操作已完成")}
              />
              <Button
                secondary
                title="取消"
                disabled={busy}
                onPress={() => setSheet(null)}
              />
            </Screen>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function AlbumForm({
  album,
  busy,
  onSave,
}: {
  album?: Album;
  busy: boolean;
  onSave: (d: AlbumDraft) => void;
}) {
  const [title, setTitle] = useState(album?.title || ""),
    [description, setDescription] = useState(album?.description || ""),
    [category, setCategory] = useState<Category>(album?.category || "情侣");
  return (
    <Screen>
      <Label>START A NEW STORY</Label>
      <Heading>{album ? "编辑我们的相册" : "开启一本新的故事"}</Heading>
      <Field
        label="相册名称"
        value={title}
        onChangeText={setTitle}
        maxLength={40}
      />
      <Field
        label="写一句话"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={160}
      />
      <Chips
        values={categories}
        value={category}
        onChange={(v) => setCategory(v as Category)}
      />
      <Button
        title="保存相册"
        disabled={!title.trim()}
        loading={busy}
        onPress={() =>
          onSave({
            title: title.trim(),
            description: description.trim(),
            category,
          })
        }
      />
    </Screen>
  );
}
function PhotoForm({
  photo,
  editable,
  busy,
  onSave,
  onDelete,
}: {
  photo: Photo;
  editable: boolean;
  busy: boolean;
  onSave: (caption: string) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption);
  return (
    <Screen>
      <PrivateImage path={photo.url} label={photo.caption} height={320} />
      <Body>
        {photo.date} · {photo.author}
      </Body>
      {editable ? (
        <>
          <Field
            label="给回忆留句话"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={200}
          />
          <Button
            title="保存描述"
            loading={busy}
            onPress={() => onSave(caption)}
          />
          <Button
            secondary
            title="移除照片"
            disabled={busy}
            onPress={onDelete}
          />
        </>
      ) : (
        <>
          <Heading>{photo.caption}</Heading>
          <Body>你是只读成员，可以浏览与收藏照片。</Body>
        </>
      )}
    </Screen>
  );
}
function MembersForm({
  album,
  busy,
  onInvite,
  onRemove,
}: {
  album: Album;
  busy: boolean;
  onInvite: (
    email: string,
    role: "editor" | "viewer",
    onResult: (result: InvitationResult) => void,
  ) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<"editor" | "viewer">("editor"),
    [invitation, setInvitation] = useState<InvitationResult | null>(null),
    [message, setMessage] = useState("");
  const share = async (copy = false) => {
    try {
      if (!invitation) return;
      if (copy) {
        await Clipboard.setStringAsync(invitation.inviteUrl);
        setMessage("邀请链接已复制");
      } else
        await Share.share({
          message: `一起收藏生活里的小美好。打开同频 App，粘贴这个邀请链接：\n${invitation.inviteUrl}`,
        });
    } catch {
      setMessage("分享失败，可长按下方链接复制。");
    }
  };
  return (
    <Screen>
      <Label>BETTER TOGETHER</Label>
      <Heading>邀请重要的人，{"\n"}一起记录。</Heading>
      <Body>「{album.title}」的同行者</Body>
      {album.role === "owner" && (
        <Card>
          <Field
            label="好友的 QQ 邮箱"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Chips
            values={["可共同编辑", "仅可查看"]}
            value={role === "editor" ? "可共同编辑" : "仅可查看"}
            onChange={(v) => setRole(v === "可共同编辑" ? "editor" : "viewer")}
          />
          <Button
            title="发送邀请邮件"
            loading={busy}
            disabled={!/^[^\s@]+@qq\.com$/i.test(email.trim())}
            onPress={() =>
              onInvite(email, role, (result) => {
                setInvitation(result);
                setEmail("");
              })
            }
          />
          <Body>7 天有效。好友必须使用收件 QQ 邮箱登录并验证。</Body>
        </Card>
      )}
      {invitation && (
        <Card tone={colors.soft}>
          <Text style={s.title}>邀请已创建</Text>
          <Body>
            {invitation.delivery === "file"
              ? "开发模式：邮件已写入本地文件，未实际发信。可复制链接在测试账号中接受邀请。"
              : "邮件服务已接受；请好友查看邮箱，或分享链接。App 内可粘贴链接接受邀请。"}
          </Body>
          <Text selectable style={s.small}>
            {invitation.inviteUrl}
          </Text>
          <Button title="系统分享" onPress={() => void share()} />
          <Button
            secondary
            title="复制邀请链接"
            onPress={() => void share(true)}
          />
          {!!message && <Body>{message}</Body>}
        </Card>
      )}
      {album.members.map((member) => (
        <Card key={member.id}>
          <Text style={s.title}>
            {member.name}
            {member.pending ? " · 待接受" : ""}
          </Text>
          <Body>{member.email}</Body>
          <Text style={s.small}>
            {member.role === "owner"
              ? "创建者"
              : member.role === "editor"
                ? "共同编辑"
                : "仅查看"}
          </Text>
          {album.role === "owner" && member.role !== "owner" && (
            <Button
              secondary
              disabled={busy}
              title={member.pending ? "撤销邀请" : "移除成员"}
              onPress={() => onRemove(member.id, member.name)}
            />
          )}
        </Card>
      ))}
      {album.role !== "owner" && <Body>只有创建者可以邀请与移除成员。</Body>}
    </Screen>
  );
}
function ForgotForm({
  email: initial,
  busy,
  onSend,
}: {
  email: string;
  busy: boolean;
  onSend: (email: string) => void;
}) {
  const [email, setEmail] = useState(initial);
  return (
    <Screen>
      <Heading>找回我们的故事</Heading>
      <Body>
        重置密码会保留原账号和相册，退出所有旧登录。邮件中的链接 30 分钟有效。
      </Body>
      <Field
        label="QQ 邮箱"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Button
        title="发送重置邮件"
        loading={busy}
        disabled={!/^[^\s@]+@qq\.com$/i.test(email.trim())}
        onPress={() => onSend(email)}
      />
      <Body>收到邮件后，回到 App 的「打开邀请 / 验证链接」粘贴完整链接。</Body>
    </Screen>
  );
}
function LinkForm({
  pending,
  user,
  busy,
  onParsed,
  onApply,
}: {
  pending: MailLink | null;
  user: Snapshot["user"];
  busy: boolean;
  onParsed: (link: MailLink | null) => void;
  onApply: (link: MailLink, password?: string) => void;
}) {
  const [input, setInput] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [invalid, setInvalid] = useState(false);
  const label =
    pending?.kind === "invite"
      ? "接受相册邀请"
      : pending?.kind === "verify"
        ? "验证 QQ 邮箱"
        : "重置本站密码";
  return (
    <Screen>
      <Label>A LITTLE INVITATION</Label>
      <Heading>把故事连接起来</Heading>
      <Body>
        粘贴邮件中的完整链接。支持网站链接、together:// 深链和开发客户端链接。
      </Body>
      <Field
        label="邀请 / 验证 / 重置链接"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Button
        secondary
        title="识别链接"
        disabled={busy}
        onPress={() => {
          const link = parseMailLink(input);
          setInvalid(!link);
          onParsed(link);
        }}
      />
      {invalid && (
        <Text style={s.error}>链接格式不正确，请完整复制邮件中的地址。</Text>
      )}
      {pending && (
        <Card>
          <Text style={s.title}>{label}</Text>
          {pending.kind === "invite" && (
            <Body>
              {user
                ? `当前账号：${user.email}。请确认与收件邮箱一致。`
                : "请先关闭此页面并登录收到邀请的账号，链接会保留。"}
            </Body>
          )}
          {pending.kind === "reset" && (
            <>
              <Field
                label="新本站密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <Field
                label="确认新密码"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
              />
              {password !== confirm && !!confirm && (
                <Text style={s.error}>两次密码不一致</Text>
              )}
            </>
          )}
          <Button
            title={label}
            loading={busy}
            disabled={
              pending.kind === "invite"
                ? !user?.emailVerified
                : pending.kind === "reset"
                  ? password.length < 8 ||
                    password.length > 128 ||
                    password !== confirm
                  : false
            }
            onPress={() => onApply(pending, password)}
          />
          {pending.kind === "invite" && user && !user.emailVerified && (
            <Body>请先验证当前 QQ 邮箱，然后重新打开邀请链接。</Body>
          )}
        </Card>
      )}
    </Screen>
  );
}
function DateForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (value: { title: string; date: string; emoji: string }) => void;
}) {
  const [title, setTitle] = useState(""),
    [date, setDate] = useState(localDate()),
    [emoji, setEmoji] = useState("♡");
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(new Date(date + "T12:00:00").getTime()) &&
    localDate(new Date(date + "T12:00:00")) === date;
  return (
    <Screen>
      <Heading>记住一个特别的日子</Heading>
      <Field
        label="纪念日名称"
        value={title}
        onChangeText={setTitle}
        maxLength={40}
      />
      <Field
        label="日期 YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        keyboardType="numbers-and-punctuation"
      />
      <Chips values={["♡", "✦", "↗"]} value={emoji} onChange={setEmoji} />
      <Button
        title="保存纪念日"
        loading={busy}
        disabled={!title.trim() || !valid}
        onPress={() => onSave({ title: title.trim(), date, emoji })}
      />
    </Screen>
  );
}

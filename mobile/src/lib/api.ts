import type {
  Album,
  AlbumDraft,
  Snapshot,
  User,
  InvitationResult,
  Photo,
  Anniversary,
} from "../types";
export interface TokenStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK",
  ) {
    super(message);
  }
}
export class TogetherApi {
  private token: string | null = null;
  constructor(
    public readonly base: string,
    private storage: TokenStore,
    private fetcher: typeof fetch = (...args) => fetch(...args),
  ) {
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error("API 地址格式不正确");
  }
  async restore() {
    this.token = await this.storage.get();
  }
  get authorization(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
  async clear() {
    this.token = null;
    await this.storage.remove();
  }
  async request<T>(path: string, method = "GET", data?: unknown): Promise<T> {
    const session = this.token,
      controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await this.fetcher(this.base.replace(/\/$/, "") + path, {
        method,
        credentials: "omit",
        signal: controller.signal,
        headers: {
          "X-Together-Client": "native",
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
          ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      const result =
        response.status === 204
          ? undefined
          : await response.json().catch(() => null);
      if (session !== this.token)
        throw new ApiError(
          "登录状态已改变，请重新操作",
          409,
          "SESSION_CHANGED",
        );
      if (!response.ok) {
        if (response.status === 401) await this.clear();
        throw new ApiError(
          result?.message || `服务暂时不可用 (${response.status})`,
          response.status,
          result?.code,
        );
      }
      return result as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("连接失败或超时，请检查网络后重试。");
    } finally {
      clearTimeout(timer);
    }
  }
  async signIn(email: string, password: string, name?: string) {
    const user = await this.request<User & { accessToken?: string }>(
      "/auth/" + (name ? "register" : "login"),
      "POST",
      {
        email: email.trim().toLowerCase(),
        password,
        ...(name ? { name: name.trim() } : {}),
      },
    );
    if (!user.accessToken)
      throw new ApiError(
        "后端尚未启用 App 登录协议，请部署本仓库的后端。",
        503,
        "NATIVE_API_REQUIRED",
      );
    await this.storage.set(user.accessToken);
    this.token = user.accessToken;
    return user;
  }
  async signOut() {
    await this.request("/auth/logout", "POST");
    await this.clear();
  }
  async snapshot() {
    const result = await this.request<Snapshot>("/workspace");
    if (!result.user) await this.clear();
    return result;
  }
  album(id: string) {
    return this.request<Album>(`/albums/${id}`);
  }
  createAlbum(draft: AlbumDraft) {
    return this.request<Album>("/albums", "POST", draft);
  }
  editAlbum(album: Album, draft: AlbumDraft) {
    return this.request<void>(`/albums/${album.id}`, "PATCH", {
      ...draft,
      version: album.version,
    });
  }
  upload(id: string, photo: { url: string; caption: string; date: string }) {
    return this.request(`/albums/${id}/photos`, "POST", { photos: [photo] });
  }
  editPhoto(
    album: string,
    photo: Photo,
    patch: { caption?: string; favorite?: boolean },
  ) {
    return this.request(`/albums/${album}/photos/${photo.id}`, "PATCH", {
      ...patch,
      ...(patch.caption === undefined ? {} : { version: photo.version }),
    });
  }
  deletePhoto(album: string, photo: Photo) {
    return this.request(`/albums/${album}/photos/${photo.id}`, "DELETE", {
      version: photo.version,
    });
  }
  invite(id: string, email: string, role: "editor" | "viewer") {
    return this.request<InvitationResult>(`/albums/${id}/invitations`, "POST", {
      email: email.trim().toLowerCase(),
      role,
    });
  }
  removeMember(id: string, mid: string) {
    return this.request(`/albums/${id}/members/${mid}`, "DELETE");
  }
  verify(token: string) {
    return this.request("/auth/verify-email", "POST", { token });
  }
  resend() {
    return this.request("/auth/resend-verification", "POST");
  }
  accept(token: string) {
    return this.request<{ albumId: string }>("/invitations/accept", "POST", {
      token,
    });
  }
  forgot(email: string) {
    return this.request<{ message: string }>("/auth/forgot-password", "POST", {
      email: email.trim().toLowerCase(),
    });
  }
  reset(token: string, password: string) {
    return this.request("/auth/reset-password", "POST", { token, password });
  }
  createDate(item: Omit<Anniversary, "id">) {
    return this.request("/anniversaries", "POST", item);
  }
  deleteDate(id: string) {
    return this.request(`/anniversaries/${id}`, "DELETE");
  }
  photoUrl(path: string) {
    const base = new URL(this.base),
      url = new URL(path, base);
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith("/api/v1/albums/")
    )
      throw Error("无效照片地址");
    return url.toString();
  }
}

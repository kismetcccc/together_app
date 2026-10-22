export type Category = "情侣" | "好友" | "旅行" | "日常";
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  mailDelivery?: string;
}
export interface Photo {
  id: string;
  url: string;
  caption: string;
  date: string;
  favorite: boolean;
  author: string;
  version?: number;
}
export interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  pending?: boolean;
}
export interface Album {
  id: string;
  title: string;
  description: string;
  category: Category;
  cover: string;
  photos: Photo[];
  members: Member[];
  updatedAt: string;
  role?: "owner" | "editor" | "viewer";
  version?: number;
}
export interface Anniversary {
  id: string;
  title: string;
  date: string;
  emoji: string;
}
export interface Snapshot {
  albums: Album[];
  anniversaries: Anniversary[];
  user: User | null;
  mailDelivery?: "file" | "smtp";
}
export interface InvitationResult {
  id: string;
  inviteUrl: string;
  delivery: "file" | "smtp";
  expiresAt: string;
}
export interface AlbumDraft {
  title: string;
  description: string;
  category: Category;
}
export interface Api {
  getSnapshot(): Promise<Snapshot>;
  getAlbum(id: string): Promise<Album>;
  signIn(email: string, password: string, name?: string): Promise<User>;
  signOut(): Promise<void>;
  createAlbum(draft: AlbumDraft): Promise<Album>;
  updateAlbum(id: string, draft: AlbumDraft, version?: number): Promise<void>;
  addPhotos(id: string, photos: Photo[]): Promise<void>;
  updatePhoto(
    albumId: string,
    photoId: string,
    patch: Partial<Pick<Photo, "caption" | "favorite" | "version">>,
  ): Promise<void>;
  deletePhoto(
    albumId: string,
    photoId: string,
    version?: number,
  ): Promise<void>;
  invite(
    id: string,
    email: string,
    role: "editor" | "viewer",
  ): Promise<InvitationResult | void>;
  removeMember(id: string, memberId: string): Promise<void>;
  createAnniversary(item: Omit<Anniversary, "id">): Promise<void>;
  deleteAnniversary(id: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(): Promise<{ delivery: "file" | "smtp" }>;
  acceptInvitation(token: string): Promise<{ albumId: string }>;
}

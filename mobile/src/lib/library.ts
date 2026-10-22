import type { Album } from "../types";
export function libraryAlbums(
  albums: Album[],
  mode: string,
  category: string,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  return albums
    .filter((a) => mode !== "共享" || a.members.some((m) => m.role !== "owner"))
    .filter(
      (a) =>
        (category === "全部" || a.category === category) &&
        (!search ||
          `${a.title} ${a.description}`.toLocaleLowerCase().includes(search)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function libraryPhotos(albums: Album[], query: string) {
  const search = query.trim().toLocaleLowerCase();
  return albums
    .flatMap((album) => album.photos.map((photo) => ({ album, photo })))
    .filter(
      ({ album, photo }) =>
        !search ||
        `${album.title} ${photo.caption} ${photo.date}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .sort((a, b) => b.photo.date.localeCompare(a.photo.date));
}

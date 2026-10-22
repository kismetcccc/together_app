import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryAlbums, libraryPhotos } from "../src/lib/library";
import type { Album } from "../src/types";
const album: Album = {
  id: "one",
  title: "Trip",
  description: "Lake",
  category: "旅行",
  cover: "",
  updatedAt: "2026-10-22",
  members: [
    { id: "owner", name: "Owner", email: "owner@qq.com", role: "owner" },
  ],
  photos: [
    {
      id: "p1",
      url: "/private/one",
      caption: "Sunset",
      date: "2026-10-21",
      author: "Owner",
      favorite: false,
    },
  ],
};
test("library filters sharing, category and case-insensitive search without mutating albums", () => {
  const shared = {
    ...album,
    id: "two",
    members: [
      ...album.members,
      {
        id: "friend",
        name: "Friend",
        email: "friend@qq.com",
        role: "editor" as const,
      },
    ],
  };
  const input = [album, shared];
  assert.deepEqual(
    libraryAlbums(input, "共享", "全部", "").map((a) => a.id),
    ["two"],
  );
  assert.equal(libraryAlbums(input, "相册", "情侣", "").length, 0);
  assert.equal(libraryAlbums(input, "相册", "全部", " LAKE ").length, 2);
  assert.equal(input[0], album);
});
test("photo search matches caption, album or date and keeps the source album for editing", () => {
  for (const query of ["sunset", " trip ", "2026-10-21"]) {
    const result = libraryPhotos([album], query);
    assert.equal(result.length, 1);
    assert.equal(result[0].album, album);
  }
  assert.equal(libraryPhotos([album], "missing").length, 0);
});

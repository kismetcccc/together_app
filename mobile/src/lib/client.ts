import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { TogetherApi, type TokenStore } from "./api";
// Web is a development preview only: session is kept in memory, never localStorage.
let previewToken: string | null = null;
const storage: TokenStore =
  Platform.OS === "web"
    ? {
        get: async () => previewToken,
        set: async (v) => {
          previewToken = v;
        },
        remove: async () => {
          previewToken = null;
        },
      }
    : {
        get: () => SecureStore.getItemAsync("together.session"),
        set: (v) =>
          SecureStore.setItemAsync("together.session", v, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        remove: () => SecureStore.deleteItemAsync("together.session"),
      };
export const apiBase = process.env.EXPO_PUBLIC_API_URL || "";
export const api = apiBase ? new TogetherApi(apiBase, storage) : null;

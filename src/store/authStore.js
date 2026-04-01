import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: (userData, token) => {
        console.log("🔐 [AuthStore] Login called with:", userData, token);
        set({
          user: userData,
          token,
        });
        console.log("✅ [AuthStore] User logged in:", userData);
      },

      logout: () => {
        console.log("🔐 [AuthStore] Logout");
        set({
          user: null,
          token: null,
        });
      },

      updateUser: (updates) =>
        set((state) => {
          const newUser = { ...state.user, ...updates };
          console.log("🔐 [AuthStore] User updated:", newUser);
          return { user: newUser };
        }),
    }),
    {
      name: "auth-storage",
    },
  ),
);

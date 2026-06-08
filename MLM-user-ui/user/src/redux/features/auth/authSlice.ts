import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { User } from "@/lib/api/types";

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

// Keep SSR and first client render identical; AuthInitializer restores session in useEffect.
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(
      state,
      action: PayloadAction<{ user: User; token?: string }>,
    ) {
      state.user = action.payload.user;
      state.token = action.payload.token ?? state.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      if (typeof window !== 'undefined') {
        if (action.payload.token) {
          localStorage.setItem('auth_token', action.payload.token);
        }
        localStorage.setItem('auth_user', JSON.stringify(action.payload.user));
      }
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, logout, setLoading } = authSlice.actions;
export const authReducer = authSlice.reducer;

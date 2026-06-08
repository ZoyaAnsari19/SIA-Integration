import { configureStore } from "@reduxjs/toolkit";

import { authReducer } from "./features/auth/authSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
    devTools: process.env.NODE_ENV !== "production",
  });

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

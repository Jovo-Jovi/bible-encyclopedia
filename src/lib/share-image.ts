import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

export const shareImage = createIsomorphicFn()
  .server(() => new URL("/og.jpg", getRequestUrl({ xForwardedHost: true })).href)
  .client(() => "/og.jpg");

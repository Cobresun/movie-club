import { auth } from "./utils/auth";

export default async (request: Request) => {
  return auth.handler(request);
};

export const config = {
  path: "/api/auth/*",
};

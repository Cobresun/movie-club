import { ClubType } from "./generated/db";

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface Member extends User {
  role?: string;
}

export interface ClubPreview {
  clubId: string;
  clubName: string;
  slug: string;
  slugUpdatedAt: string | undefined;
  type: ClubType;
}

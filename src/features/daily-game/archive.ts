import { type DailyGameConfig } from "@/common/clubType";

export const archivePath = (game: DailyGameConfig) => `${game.path}/archive`;

export const puzzlePath = (game: DailyGameConfig, date: string) => `${game.path}/${date}`;

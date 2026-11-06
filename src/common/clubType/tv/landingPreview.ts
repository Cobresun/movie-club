import { type LandingPreview } from "../types";
import severanceSvg from "@/assets/images/landing/severance.svg";
import shogunSvg from "@/assets/images/landing/shogun.svg";
import slowHorsesSvg from "@/assets/images/landing/slow-horses.svg";
import theBearSvg from "@/assets/images/landing/the-bear.svg";

export const tvLandingPreview: LandingPreview = {
  clubName: "Episode Night",
  landscape: true,
  works: [
    {
      title: "The Bear",
      subtitle: "Season 3 · Episode 1",
      posterUrl: theBearSvg,
      scores: { Jordan: 6.5, Sam: 8, Priya: 7.5 },
    },
    {
      title: "Slow Horses",
      subtitle: "Season 4 · Episode 1",
      posterUrl: slowHorsesSvg,
      scores: { Maya: 8, Jordan: 7.5, Sam: 8, Priya: 7 },
    },
    {
      title: "Shōgun",
      subtitle: "Season 1 · Episode 10",
      posterUrl: shogunSvg,
      scores: { Maya: 9, Jordan: 8, Sam: 9.5, Priya: 8.5 },
    },
    {
      title: "Severance",
      subtitle: "Season 2 · Episode 10",
      posterUrl: severanceSvg,
      scores: { Maya: 9.5, Jordan: 9, Sam: 8.5, Priya: 9 },
    },
  ],
};

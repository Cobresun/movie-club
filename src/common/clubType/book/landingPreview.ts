import { type LandingPreview } from "../types";
import covenantSvg from "@/assets/images/landing/covenant-of-water.svg";
import demonCopperheadSvg from "@/assets/images/landing/demon-copperhead.svg";
import piranesiSvg from "@/assets/images/landing/piranesi.svg";
import tomorrowSvg from "@/assets/images/landing/tomorrow-and-tomorrow.svg";

export const bookLandingPreview: LandingPreview = {
  clubName: "Second Chapter Book Club",
  landscape: false,
  works: [
    {
      title: "The Covenant of Water",
      subtitle: "Abraham Verghese",
      posterUrl: covenantSvg,
      scores: { Jordan: 7, Sam: 7.5, Priya: 6 },
    },
    {
      title: "Tomorrow, and Tomorrow, and Tomorrow",
      subtitle: "Gabrielle Zevin",
      posterUrl: tomorrowSvg,
      scores: { Maya: 7, Jordan: 9.5, Sam: 6.5, Priya: 8 },
    },
    {
      title: "Demon Copperhead",
      subtitle: "Barbara Kingsolver",
      posterUrl: demonCopperheadSvg,
      scores: { Maya: 8.5, Jordan: 9, Sam: 7, Priya: 8.5 },
    },
    {
      title: "Piranesi",
      subtitle: "Susanna Clarke",
      posterUrl: piranesiSvg,
      scores: { Maya: 9, Jordan: 8.5, Sam: 9.5, Priya: 8 },
    },
  ],
};

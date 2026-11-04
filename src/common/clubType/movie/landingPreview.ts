import { type LandingPreview } from "../types";
import duneSvg from "@/assets/images/landing/dune-part-two.svg";
import pastLivesSvg from "@/assets/images/landing/past-lives.svg";
import perfectDaysSvg from "@/assets/images/landing/perfect-days.svg";
import holdoversSvg from "@/assets/images/landing/the-holdovers.svg";

export const movieLandingPreview: LandingPreview = {
  clubName: "Thursday Night Film Society",
  landscape: false,
  works: [
    {
      title: "Dune: Part Two",
      subtitle: "2024",
      posterUrl: duneSvg,
      scores: { Jordan: 6.5, Sam: 8, Priya: 5.5 },
    },
    {
      title: "The Holdovers",
      subtitle: "2023",
      posterUrl: holdoversSvg,
      scores: { Maya: 7.5, Jordan: 8, Sam: 9, Priya: 7 },
    },
    {
      title: "Perfect Days",
      subtitle: "2023",
      posterUrl: perfectDaysSvg,
      scores: { Maya: 8, Jordan: 9, Sam: 7.5, Priya: 8 },
    },
    {
      title: "Past Lives",
      subtitle: "2023",
      posterUrl: pastLivesSvg,
      scores: { Maya: 9, Jordan: 8.5, Sam: 6, Priya: 9.5 },
    },
  ],
};

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Folio",
    short_name: "Folio",
    description: "국내·해외 주식과 ETF 포트폴리오",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#4F6EF7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

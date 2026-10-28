import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Algo UPSC — UPSC Prelims",
    short_name: "Algo UPSC",
    description: "Algorithmic, spaced study for UPSC Prelims 2027 in English and Hindi.",
    start_url: "/study",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#1c2140",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

// Lets phones add the site to the home screen with the amarAbroad cloud icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "amarAbroad",
    short_name: "amarAbroad",
    description: "Study abroad, with the real cost in taka: programs, universities and scholarships for students from Bangladesh.",
    start_url: "/en/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#2448f0",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

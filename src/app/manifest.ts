import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cachuburguer",
    short_name: "Cachuburguer",
    start_url: "/kiosco",
    display: "standalone",
    theme_color: "#111111",
    background_color: "#111111",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

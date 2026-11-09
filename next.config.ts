import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/certificates/download": [
      "./public/fonts/*.ttf",
      "./public/assets/certificates/*.png",
      "./node_modules/pdfkit/js/data/*.afm",
    ],
  },
  allowedDevOrigins: ["127.0.0.1"],
};
export default config;

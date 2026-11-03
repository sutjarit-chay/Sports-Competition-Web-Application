import "./globals.css";
export const metadata = {
  title: "นครโกสัมพีเกมส์ 2569",
  description: "ระบบบริหารการแข่งขันกีฬาเครือข่ายนครโกสัมพี ปีการศึกษา 2569",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

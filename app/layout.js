export const metadata = {
  title: 'Studio Capacity Planner',
  description: 'Studio project and capacity management tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

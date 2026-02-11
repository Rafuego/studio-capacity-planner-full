export const metadata = {
  title: 'Studio Planner API',
  description: 'API for Studio Capacity Planner',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

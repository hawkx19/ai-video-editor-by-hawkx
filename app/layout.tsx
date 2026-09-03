import './globals.css';

export const metadata = {
  title: 'Free AI Video Editor',
  description: 'Edit your videos with AI, free of cost',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

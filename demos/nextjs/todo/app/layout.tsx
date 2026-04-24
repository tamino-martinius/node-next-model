import type { ReactNode } from 'react';

export const metadata = {
  title: 'NextModel · Next.js Todo',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          maxWidth: 540,
          margin: '2rem auto',
          padding: '1rem',
          colorScheme: 'light dark',
        }}
      >
        {children}
      </body>
    </html>
  );
}

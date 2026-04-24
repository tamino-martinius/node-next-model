import type { ReactNode } from 'react';

export const metadata = {
  title: 'NextModel · Next.js API demo',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          maxWidth: 680,
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

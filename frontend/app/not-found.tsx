'use client';

import dynamic from 'next/dynamic';

const NotFoundClient = dynamic(() => import('./not-found-client'), {
  ssr: false,
});

export default function NotFound() {
  return <NotFoundClient />;
}
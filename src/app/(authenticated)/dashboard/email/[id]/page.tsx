
import EmailPageClient from './EmailPageClient';

export function generateStaticParams() {
  return [
    { id: 'placeholder-initial-1' }
  ];
}

export default function EmailPage() {
  return <EmailPageClient />;
}

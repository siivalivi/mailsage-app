'use client';

import { useParams, useRouter } from 'next/navigation';
import EmailView from '@/components/emails/EmailView';
import { Email } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// This is a placeholder. In a real app, you'd fetch this data based on ID.
const MOCK_EMAIL_DB: Record<string, Email> = {
  'mock-1': {
    id: 'mock-1',
    sender: 'Alice Wonderland',
    subject: 'Project Update: Caterpillar',
    body: 'Hi Team,\n\nJust a quick update on the Caterpillar project. We are slightly behind schedule on phase 2. The main blocker is the psychedelic mushroom supply chain. Bob is looking into alternative suppliers.\n\nNext steps:\n1. Secure mushroom supply by EOW.\n2. Finalize tea party guest list.\n\nBest,\nAlice',
    summary: 'Alice reports a delay in Caterpillar project phase 2 due to mushroom supply issues. Bob is seeking new suppliers. Action items: secure supply and finalize guest list.',
    timestamp: new Date('2024-07-15T10:00:00Z').getTime(),
    isRead: true,
  },
  'mock-2': {
    id: 'mock-2',
    sender: 'Bob The Builder',
    subject: 'Re: Construction Plans',
    body: 'Hey Alice,\n\nCan we fix it? Yes, we can! The construction plans for the new rabbit hole look solid. However, I noticed the material specifications for the looking glass are a bit vague. Could you clarify if we need tempered or enchanted glass?\n\nCheers,\nBob',
    summary: 'Bob confirms construction plans for the rabbit hole are good but needs clarification on looking glass material (tempered or enchanted).',
    timestamp: new Date('2024-07-15T09:30:00Z').getTime(),
    isRead: false,
  },
   'mock-3': {
    id: 'mock-3',
    sender: 'Marketing Team',
    subject: 'Weekly Campaign Performance',
    body: 'Hello everyone,\n\nThis week\'s email campaign, "Wonderful Wonderland Deals," saw a 15% open rate and 3% click-through rate. The Mad Hatter segment performed particularly well.\n\nA detailed report is attached for your review. We are planning A/B testing for next week\'s "Cheshire Cat Specials" campaign.\n\nRegards,\nMarketing',
    summary: 'Marketing Team reports on "Wonderful Wonderland Deals" campaign: 15% open, 3% CTR. Mad Hatter segment was successful. Detailed report attached, A/B testing planned for "Cheshire Cat Specials".',
    timestamp: new Date('2024-07-16T14:00:00Z').getTime(),
    isRead: true,
  },
};

// Add more mock emails by copying the structure from dashboard page's initialMockQueriedEmails
// and creating corresponding entries in MOCK_EMAIL_DB.
// For example, for 'Tech Conference Updates':
MOCK_EMAIL_DB['mock-initial-1'] = {
  id: 'mock-initial-1',
  sender: 'Tech Conference Updates',
  subject: 'Call for Papers Extended!',
  body: 'Dear Esteemed Professionals,\n\nWe are excited to announce that the deadline for paper submissions for the Annual Tech Summit has been extended by two weeks, due to popular demand and to accommodate more high-quality research.\nThe new deadline for submissions is now August 15th, 2024.\n\nWe encourage you to submit your groundbreaking work and be a part of this prestigious event. For submission guidelines and more details, please visit our website.\n\nSincerely,\nThe Annual Tech Summit Organizing Committee',
  summary: 'The deadline for paper submissions for the Annual Tech Summit has been extended by two weeks. New deadline is August 15th.',
  timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
  isRead: false,
};
MOCK_EMAIL_DB['mock-initial-2'] = {
  id: 'mock-initial-2',
  sender: 'Marketing Team',
  subject: 'Weekly Campaign Performance',
  body: 'Hi Team,\n\nThis week\'s email campaign saw a 15% open rate and 3% click-through rate. Detailed report attached for your review. Key highlights include a high engagement from the new subscriber segment. We need to strategize on improving conversions for the European market.\n\nBest,\nJane Doe\nMarketing Lead',
  summary: 'This week\'s email campaign saw a 15% open rate and 3% click-through rate. Detailed report attached.',
  timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
  isRead: true,
};
 MOCK_EMAIL_DB['mock-initial-3'] = {
  id: 'mock-initial-3',
  sender: 'HR Department',
  subject: 'Important: New Company Policy',
  body: 'All Employees,\n\nPlease find attached the updated remote work policy, which will be effective starting September 1st. This policy includes new guidelines on equipment, security, and communication protocols.\n\nIt is mandatory for all employees to review this document thoroughly and acknowledge receipt by the end of this week via the HR portal.\n\nThank you,\nHR Department',
  summary: 'Please review the updated remote work policy, effective September 1st. Acknowledge receipt by end of week.',
  timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
  isRead: false,
};
 MOCK_EMAIL_DB['mock-initial-4'] = {
  id: 'mock-initial-4',
  sender: 'Client Support',
  subject: 'Your inquiry #12345: Resolved',
  body: 'Dear Valued Customer,\n\nWe are pleased to inform you that your recent support ticket #12345 regarding login issues has been successfully resolved. Our technical team has applied a fix, and you should now be able to access your account without any problems.\n\nIf you continue to experience issues, please do not hesitate to contact us again.\n\nThank you for your patience,\nClient Support Team',
  summary: 'We are pleased to inform you that your recent support ticket regarding login issues has been resolved.',
  timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
  isRead: true,
};


// Utility to find an email, trying to match the prefix if full ID is not found
// This helps if IDs from dashboard are slightly different from MOCK_EMAIL_DB keys
const findEmailById = (id: string): Email | undefined => {
  if (MOCK_EMAIL_DB[id]) {
    return MOCK_EMAIL_DB[id];
  }
  // Try to find a match based on the 'mock-X' part of the ID
  const idPrefix = id.match(/mock-\d+/)?.[0] || id.match(/mock-initial-\d+/)?.[0];
  if (idPrefix) {
    const foundKey = Object.keys(MOCK_EMAIL_DB).find(key => key.startsWith(idPrefix));
    if (foundKey) return MOCK_EMAIL_DB[foundKey];
  }
  return undefined;
}


export default function EmailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [email, setEmailData] = useState<Email | null | undefined>(undefined); // undefined for loading state

  useEffect(() => {
    if (id) {
      // Simulate fetching email
      setTimeout(() => {
        const foundEmail = findEmailById(id);
        setEmailData(foundEmail || null); // null if not found after "loading"
      }, 500); // Simulate network delay
    }
  }, [id]);

  if (email === undefined) { // Loading state
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading email content...</p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-semibold mb-4">Email Not Found</h2>
        <p className="text-muted-foreground mb-6">The email you are looking for does not exist or could not be loaded.</p>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
      <EmailView email={email} />
    </div>
  );
}

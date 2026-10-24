import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetForm } from '../../../components/marketing/ResetForm';

export const metadata: Metadata = { title: { absolute: 'Choose a new password · Second Opinion' }, robots: { index: false } };

export default function ResetPage() {
  return (
    <div className="px-4 py-12 sm:py-16">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}

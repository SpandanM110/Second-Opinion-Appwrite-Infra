import Link from 'next/link';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-[22px] font-bold">That {what} isn’t here</h1>
      <p className="mt-2 text-[15px] text-muted">It may have moved, or the link is incomplete.</p>
      <Link href="/" className="btn-primary mt-5">
        Check a price
      </Link>
    </div>
  );
}

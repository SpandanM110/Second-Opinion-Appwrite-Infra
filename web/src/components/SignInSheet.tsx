import { LogIn } from 'lucide-react';
import { Sheet } from './Sheet';

const WHY: Record<string, string> = {
  paid: 'Sign in to share what you paid. It takes under 20 seconds and helps the next person.',
  ask: 'Sign in to ask locals. Your question goes out with this fair price attached.',
  default: 'Sign in to share prices, confirm or flag them, and ask locals.',
};

/** Checking never needs an account; contributing does. */
export function SignInSheet({ open, onClose, reason = 'default' }: { open: boolean; onClose: () => void; reason?: keyof typeof WHY | string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Sign in to contribute">
      <p className="text-[15px] text-muted">{WHY[reason] ?? WHY.default}</p>
      <button type="button" className="btn-primary mt-4 w-full" disabled>
        <LogIn size={18} aria-hidden /> Sign in
      </button>
      <p className="mt-2 pb-2 text-center text-[13px] text-faint">Sign-in with Google or email is being switched on. Checking prices stays open to everyone.</p>
    </Sheet>
  );
}

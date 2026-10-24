import { AppwriteException } from 'appwrite';
import { ApiError } from './api';

export type AuthReason = 'paid' | 'ask' | 'confirm' | 'flag' | 'reply' | 'helpful' | 'default';

/** Appwrite's error types, in plain words. */
export function friendlyAuthError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof AppwriteException && e.code) {
    switch (e.type) {
      case 'user_already_exists':
      case 'user_email_already_exists':
        return 'That email already has an account. Sign in instead.';
      case 'user_invalid_credentials':
        return 'That email and password don’t match.';
      case 'general_rate_limit_exceeded':
        return 'Too many tries. Wait a minute and try again.';
      case 'user_blocked':
        return 'This account is blocked.';
      case 'general_argument_invalid':
      case 'password_recently_used':
      case 'password_personal_data':
        return /password/i.test(e.message) ? 'Use a password with at least 8 characters.' : 'Check your email address and try again.';
      default:
        return e.code >= 500 ? 'Something went wrong on our side. Try again in a moment.' : e.message || 'That didn’t work. Try again.';
    }
  }
  return 'You seem to be offline. Check your connection and try again.';
}

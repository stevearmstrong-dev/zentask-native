import * as AppleAuthentication from 'expo-apple-authentication';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const NONCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateNonce(length = 32): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const randomBytes = cryptoApi.getRandomValues(new Uint8Array(length));
    return Array.from(randomBytes, (byte) => NONCE_ALPHABET[byte % NONCE_ALPHABET.length]).join('');
  }

  let nonce = '';
  for (let index = 0; index < length; index += 1) {
    nonce += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
  }
  return nonce;
}

function getNameMetadata(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  if (!fullName) return null;

  const nameParts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part): part is string => Boolean(part?.trim()));

  if (!nameParts.length) return null;

  const fullNameValue = nameParts.join(' ');

  return {
    name: fullNameValue,
    full_name: fullNameValue,
    ...(fullName.givenName ? { given_name: fullName.givenName } : {}),
    ...(fullName.familyName ? { family_name: fullName.familyName } : {}),
  };
}

export function isAppleAuthCanceledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'code' in error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

export async function signInWithApple(): Promise<User | null> {
  const rawNonce = generateNonce();

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: rawNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    access_token: credential.authorizationCode ?? undefined,
    nonce: rawNonce,
  });

  if (error) throw error;

  const metadata = getNameMetadata(credential.fullName);
  if (metadata) {
    const { error: updateError } = await supabase.auth.updateUser({ data: metadata });
    if (updateError) {
      console.warn('[AppleAuth] Failed to persist Apple profile metadata:', updateError);
    }
  }

  return data.user;
}

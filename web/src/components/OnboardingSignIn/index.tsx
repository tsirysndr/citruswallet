import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { rpc } from '../../api';
import { useRun } from '../../hooks';
import { signInForm } from '../../validation';
import { Typeahead } from '../Typeahead';
import AtmosphereApps from '../AtmosphereApps';
import { Button, FieldError, Label, LinkButton, Panel } from '../ui';

export function OnboardingSignIn() {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const run = useRun();
  const start = (create = false) => {
    const parsed = signInForm.safeParse({ identifier: handle });
    if (!create && !parsed.success) { setError(parsed.error.issues[0]?.message || 'Enter your handle.'); return; }
    setError('');
    void run(async () => {
      const { url } = await rpc.startLogin(create ? { create: true } : parsed.data!);
      window.location.assign(url);
    });
  };
  return <Panel className="font-sans">
    <h1 className="text-center text-3xl font-semibold">Your handle. Your wallet.</h1>
    <p className="mt-3 text-center text-sm leading-6 text-ink-muted">One last step: sign in with your Atmosphere account. Send and receive crypto using an @handle instead of a long wallet address.</p>
    <p className="mt-3 text-center text-sm leading-6 text-ink-muted">We’ll link your wallet to your account so friends can pay you by handle. Your keys stay on your device.</p>
    <AtmosphereApps />
    <form className="mt-5 flex flex-col gap-3" noValidate onSubmit={event => { event.preventDefault(); start(); }}>
      <Label htmlFor="onboarding-handle">Handle</Label>
      <Typeahead id="onboarding-handle" value={handle} onChange={value => { setHandle(value); setError(''); }} onPick={() => {}} placeholder="you.bsky.social" maxLength={253} invalid={!!error} />
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full !bg-black !text-white" disabled={!handle.trim()}>Sign In</Button>
    </form>
    <details className="mt-5 text-sm text-ink-muted"><summary className="cursor-pointer underline underline-offset-4">What is an Atmosphere account?</summary><p className="mt-2 leading-6">An account on the AT Protocol network, such as Bluesky or selfhosted.social. Use the same handle you already have.</p></details>
    <p className="mt-4 text-sm text-ink-muted">Don’t have an account? <LinkButton onClick={() => start(true)}>Create one</LinkButton></p>
    <p className="mt-4 text-xs leading-5 text-ink-muted">By continuing, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>. You’ll sign in securely with your account provider.</p>
  </Panel>;
}

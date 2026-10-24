import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { rpc } from '../../api';
import { useRun } from '../../hooks';
import { signInForm } from '../../validation';
import { Typeahead } from '../Typeahead';
import AtmosphereApps from '../AtmosphereApps';
import { Button, FieldError, Label, LinkButton, Panel } from '../ui';

export function OnboardingSignIn() {
  const form = useForm({ resolver: zodResolver(signInForm), defaultValues: { identifier: '' } });
  const run = useRun();
  const start = (body: { identifier: string } | { create: true }) => run(async () => {
    const { url } = await rpc.startLogin(body);
    window.location.assign(url);
  });
  return <Panel className="font-sans">
    <h1 className="text-center text-3xl font-semibold">Your handle. Your wallet.</h1>
    <AtmosphereApps />
    <form className="mt-5 flex flex-col gap-3" noValidate onSubmit={form.handleSubmit(start)}>
      <Label htmlFor="onboarding-handle">Handle</Label>
      <Controller control={form.control} name="identifier" render={({ field, fieldState }) => <Typeahead id="onboarding-handle" value={field.value} onChange={field.onChange} onBlur={field.onBlur} onPick={() => {}} placeholder="you.bsky.social" maxLength={253} invalid={!!fieldState.error} />} />
      <FieldError>{form.formState.errors.identifier?.message}</FieldError>
      <Button type="submit" className="w-full !bg-black !text-white" disabled={!form.watch('identifier').trim()}>Sign In</Button>
    </form>
    <details className="mt-5 text-sm text-ink-muted"><summary className="cursor-pointer underline underline-offset-4">What is an Atmosphere account?</summary><p className="mt-2 leading-6">An account on the AT Protocol network, such as Bluesky or selfhosted.social. Use the same handle you already have.</p></details>
    <p className="mt-4 text-sm text-ink-muted">Don’t have an account? <LinkButton onClick={() => start({ create: true })}>Create one</LinkButton></p>
    <p className="mt-4 text-xs leading-5 text-ink-muted">By continuing, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>. You’ll sign in securely with your account provider.</p>
  </Panel>;
}

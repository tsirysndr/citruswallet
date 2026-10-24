import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInForm } from "../../validation";
import { Linking, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "../../auth";
import { useAction } from "../../hooks";
import { Text } from "../Typography";
import { HandleInput } from "../HandleInput";
import { AtmosphereApps } from "../AtmosphereApps";
import { Button } from "../ui";

export function OnboardingSignIn({
  returning = false,
}: {
  returning?: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(signInForm),
    defaultValues: { identifier: "" },
  });
  const run = useAction(),
    query = useQueryClient();
  const start = (identifier: string, create = false) =>
    run(async () => {
      if (await signIn(identifier, create)) await query.invalidateQueries();
    });
  const submit = form.handleSubmit(({ identifier }) => start(identifier));
  return (
    <View className="gap-5 rounded-3xl bg-surface p-6">
      <Text className="text-center text-3xl font-semibold">
        {returning ? "Welcome back." : "Your handle. Your wallet."}
      </Text>
      <Text className="my-1 text-left text-base leading-6 text-muted">
        Sign in with your Atmosphere Account
      </Text>
      <AtmosphereApps />
      <Controller
        control={form.control}
        name="identifier"
        render={({ field }) => (
          <HandleInput
            value={field.value}
            onChange={field.onChange}
            onSubmit={submit}
          />
        )}
      />
      {form.formState.errors.identifier && (
        <Text accessibilityRole="alert" className="text-sm text-red-700">
          {form.formState.errors.identifier.message}
        </Text>
      )}
      <Button
        title="Sign In"
        tone="black"
        disabled={!form.watch("identifier").trim()}
        onPress={submit}
      />
      <Text className="text-sm text-muted">
        Don’t have an account?{" "}
        <Text
          accessibilityRole="link"
          className="underline"
          onPress={() => start("", true)}
        >
          Create one
        </Text>
      </Text>
      <Text className="text-sm leading-6 text-muted">
        By continuing, you agree to our{" "}
        <Text
          accessibilityRole="link"
          className="underline"
          onPress={() => void Linking.openURL("https://peachlet.app/terms")}
        >
          Terms
        </Text>{" "}
        and{" "}
        <Text
          accessibilityRole="link"
          className="underline"
          onPress={() => void Linking.openURL("https://peachlet.app/privacy")}
        >
          Privacy Policy
        </Text>
        . You’ll sign in securely with your account provider.
      </Text>
    </View>
  );
}

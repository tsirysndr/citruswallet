import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { Button, FieldError, Checkbox, Input, Label, LinkButton } from "./ui";
import { busyAtom } from "../../atoms";
import { createStore } from "jotai";
import { vi } from "vitest";
it("disables actions during an operation unless explicitly allowed", async () => {
  const store = createStore();
  store.set(busyAtom, true);
  await renderComponent(
    <>
      <Button>Send</Button>
      <Button keepEnabled>Close</Button>
      <LinkButton>Retry</LinkButton>
    </>,
    { store },
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
});
it("associates inputs with labels, reports errors and handles checkbox changes", async () => {
  const change = vi.fn();
  const { user } = await renderComponent(
    <>
      <Label htmlFor="name">Name</Label>
      <Input id="name" />
      <FieldError>Invalid name</FieldError>
      <Checkbox checked={false} onChange={change}>
        Publish
      </Checkbox>
    </>,
  );
  await user.type(screen.getByLabelText("Name"), "Alice");
  expect(screen.getByLabelText("Name")).toHaveValue("Alice");
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid name");
  await user.click(screen.getByRole("checkbox"));
  expect(change).toHaveBeenCalledWith(true);
});

it("masks secret fields, toggles visibility without submitting, and submits with Enter", async () => {
  const submit = vi.fn();
  const { user } = await renderComponent(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="secret">Wallet password</Label>
      <Input id="secret" type="password" />
      <Button type="submit">Continue</Button>
    </form>,
  );
  const field = screen.getByLabelText("Wallet password");
  await user.type(field, "example password");
  expect(field).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(field).toHaveAttribute("type", "text");
  expect(field).toHaveValue("example password");
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Hide password" }));
  expect(field).toHaveAttribute("type", "password");
  await user.type(field, "{Enter}");
  expect(submit).toHaveBeenCalledTimes(1);
});

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

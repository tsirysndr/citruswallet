import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { Typeahead } from "./Typeahead";
import { useState } from "react";
import { vi } from "vitest";
import { alice, bob } from "../../test/mocks/fixtures";
it("debounces suggestions, excludes self, and supports keyboard selection", async () => {
  const pick = vi.fn();
  function Field() {
    const [value, setValue] = useState("");
    return (
      <Typeahead
        id="person"
        aria-label="Person"
        value={value}
        onChange={setValue}
        onPick={pick}
        excludeDid={alice.did}
      />
    );
  }
  const { user } = await renderComponent(<Field />);
  await user.type(screen.getByRole("combobox"), "bo");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(
    await screen.findByRole("option", { name: /Bob/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: /Alice/ }),
  ).not.toBeInTheDocument();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(pick).toHaveBeenCalledWith(bob);
  expect(screen.getByRole("combobox")).toHaveValue("bob.test");
});

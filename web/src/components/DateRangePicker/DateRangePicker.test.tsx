import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { DateRangePicker } from "./DateRangePicker";
import { vi } from "vitest";
it("applies a preset only on confirmation", async () => {
  const change = vi.fn();
  const { user } = await renderComponent(
    <DateRangePicker value={{ from: "", until: "" }} onChange={change} />,
  );
  await user.click(
    screen.getByRole("button", { name: /All dates|All time|Date range/ }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Date range preset" }),
    "Last year",
  );
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Apply dates" }));
  const year = new Date().getFullYear() - 1;
  expect(change).toHaveBeenCalledWith({
    from: `${year}-01-01`,
    until: `${year}-12-31`,
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

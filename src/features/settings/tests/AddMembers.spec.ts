import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AddMembers from "../components/AddMembers.vue";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

describe("AddMembers", () => {
  it("renders the heading and Add email button", () => {
    render(AddMembers, { props: { clubId: "1" } });

    expect(
      screen.getByRole("heading", { name: "Add Members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add email/i }),
    ).toBeInTheDocument();
  });

  it("shows no email inputs and no submit button initially", () => {
    render(AddMembers, { props: { clubId: "1" } });

    expect(
      screen.queryByPlaceholderText("Email address"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add members/i }),
    ).not.toBeInTheDocument();
  });

  it("adds an email input when 'Add email' is clicked", async () => {
    const { user } = render(AddMembers, { props: { clubId: "1" } });

    await user.click(screen.getByRole("button", { name: /Add email/i }));

    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
  });

  it("removes an email input when the minus button is clicked", async () => {
    const { user } = render(AddMembers, { props: { clubId: "1" } });

    await user.click(screen.getByRole("button", { name: /Add email/i }));
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();

    // The minus button is unlabelled (icon only); find by its position after the input
    const minusButtons = screen.getAllByRole("button");
    const minusButton = minusButtons[minusButtons.length - 1];
    await user.click(minusButton);

    expect(
      screen.queryByPlaceholderText("Email address"),
    ).not.toBeInTheDocument();
  });

  it("shows the 'Add members' submit button only when a valid email is entered", async () => {
    const { user } = render(AddMembers, { props: { clubId: "1" } });

    await user.click(screen.getByRole("button", { name: /Add email/i }));
    const input = screen.getByPlaceholderText("Email address");

    expect(
      screen.queryByRole("button", { name: /Add members/i }),
    ).not.toBeInTheDocument();

    await user.type(input, "hello@example.com");

    expect(
      screen.getByRole("button", { name: /Add members/i }),
    ).toBeInTheDocument();
  });

  it("hides 'Add members' when the typed email is invalid", async () => {
    const { user } = render(AddMembers, { props: { clubId: "1" } });

    await user.click(screen.getByRole("button", { name: /Add email/i }));
    const input = screen.getByPlaceholderText("Email address");

    await user.type(input, "not-an-email");

    expect(
      screen.queryByRole("button", { name: /Add members/i }),
    ).not.toBeInTheDocument();
  });

  it("calls the add-members endpoint and clears inputs on success", async () => {
    server.use(
      http.post(
        "/api/club/:id/members",
        () => new HttpResponse(null, { status: 200 }),
      ),
    );

    const { user } = render(AddMembers, { props: { clubId: "1" } });

    await user.click(screen.getByRole("button", { name: /Add email/i }));
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "member@example.com",
    );
    await user.click(screen.getByRole("button", { name: /Add members/i }));

    // After success the inputs should be cleared
    expect(
      await screen.findByRole("button", { name: /Add email/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Email address"),
    ).not.toBeInTheDocument();
  });
});

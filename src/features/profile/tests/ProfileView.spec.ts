import { screen, waitFor } from "@testing-library/vue";
import { config } from "@vue/test-utils";
import { delay, http, HttpResponse } from "msw";

import ProfileView from "../views/ProfileView.vue";
import { mockCanvas } from "@/mocks/canvas";
import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

// vue-toastification renders inside a <transition-group>, whose default VTU
// stub drops the toast text; un-stub it so the error toasts can be read.
config.global.stubs = { transition: false, "transition-group": false };

const renderProfile = () => {
  const { user, pinia } = render(ProfileView);
  logIn(pinia);
  return { user, pinia };
};

describe("ProfileView", () => {
  it("gathers photo, name and password onto one screen", async () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("fills the name field with the name the member already has", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText("Your name")).toHaveValue(memberData.name);
    });
  });

  it("puts the hint back once a rejected name is fixed and saved", async () => {
    server.use(http.put("/api/member/name", () => new HttpResponse(null, { status: 200 })));

    const { user } = renderProfile();
    const field = await screen.findByLabelText("Your name");

    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();

    await user.type(field, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(screen.queryByText("Name cannot be empty")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Shown to everyone in your clubs")).toBeInTheDocument();
  });

  it("rejects an empty name without calling the API", async () => {
    let requested = false;
    server.use(
      http.put("/api/member/name", () => {
        requested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderProfile();

    await user.clear(await screen.findByLabelText("Your name"));
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("reports a name the server refused", async () => {
    server.use(http.put("/api/member/name", () => new HttpResponse(null, { status: 500 })));

    const { user } = renderProfile();
    const field = await screen.findByLabelText("Your name");

    await user.clear(field);
    await user.type(field, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
  });

  it("shows the photo working while it is removed", async () => {
    server.use(
      http.delete("/api/member/avatar", async () => {
        await delay();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderProfile();

    await user.click(await screen.findByRole("button", { name: "Remove photo" }));

    expect(await screen.findByRole("status", { name: "Updating photo" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Updating photo" })).not.toBeInTheDocument();
    });
  });

  it("offers nothing to remove until there is a photo", () => {
    render(ProfileView);

    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });

  describe("choosing a new photo", () => {
    const photo = new File(["pretend-jpeg-bytes"], "holiday.jpg", { type: "image/jpeg" });

    const pickPhoto = async () => {
      const rendered = renderProfile();
      await rendered.user.upload(screen.getByLabelText("Choose a photo"), photo);
      return rendered;
    };

    beforeEach(() => {
      mockCanvas();
    });

    it("opens the photo in a cropper before anything is uploaded", async () => {
      await pickPhoto();

      expect(await screen.findByRole("img", { name: "Crop preview" })).toBeInTheDocument();
      expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Updating photo" })).not.toBeInTheDocument();
    });

    it("uploads the crop once it is saved", async () => {
      server.use(
        http.post("/api/member/avatar", async () => {
          await delay();
          return new HttpResponse(null, { status: 200 });
        }),
      );

      const { user } = await pickPhoto();
      await user.click(await screen.findByRole("button", { name: "Save photo" }));

      expect(await screen.findByRole("status", { name: "Updating photo" })).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: "Crop preview" })).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: "Updating photo" })).not.toBeInTheDocument();
      });
    });

    it("leaves the photo alone when the crop is cancelled", async () => {
      const { user } = await pickPhoto();
      await user.click(await screen.findByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("img", { name: "Crop preview" })).not.toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Updating photo" })).not.toBeInTheDocument();
    });

    it("says so when the browser can't open the photo", async () => {
      mockCanvas({ decodable: false });

      await pickPhoto();

      expect(
        await screen.findAllByText("That photo couldn't be opened. Try a JPEG or PNG."),
      ).not.toHaveLength(0);
      expect(screen.queryByRole("img", { name: "Crop preview" })).not.toBeInTheDocument();
    });

    it("says so when the upload is refused", async () => {
      server.use(http.post("/api/member/avatar", () => new HttpResponse(null, { status: 500 })));

      const { user } = await pickPhoto();
      await user.click(await screen.findByRole("button", { name: "Save photo" }));

      expect(await screen.findAllByText("Couldn't update your photo")).not.toHaveLength(0);
    });
  });
});

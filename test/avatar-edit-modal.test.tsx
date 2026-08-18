import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarEditModal } from "@/components/account/avatar-edit-modal";
import { removeAvatar, uploadAvatar } from "@/lib/profile";

vi.mock("@/lib/profile", () => ({
	AVATAR_ACCEPT: "image/jpeg,image/png,image/webp,image/gif",
	AVATAR_MAX_BYTES: 20 * 1024 * 1024,
	removeAvatar: vi.fn(),
	uploadAvatar: vi.fn(),
}));

const session = { token: "token", userId: "user-1", username: "Alex" };

function renderModal(
	props: Partial<React.ComponentProps<typeof AvatarEditModal>> = {},
) {
	return render(
		<AvatarEditModal
			session={session}
			displayName="Alex"
			userId="user-1"
			onClose={vi.fn()}
			onSaved={vi.fn()}
			{...props}
		/>,
	);
}

describe("AvatarEditModal", () => {
	beforeEach(() => {
		vi.mocked(removeAvatar).mockReset();
		vi.mocked(uploadAvatar).mockReset();
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: vi.fn(() => "blob:avatar"),
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: vi.fn(),
		});
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 400,
			height: 400,
			top: 0,
			left: 0,
			right: 400,
			bottom: 400,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
	});

	it("validates file size and format before creating a preview", () => {
		const { container } = renderModal();
		const input = container.querySelector("input[type=file]") as HTMLInputElement;
		const oversized = new File(["avatar"], "avatar.png", { type: "image/png" });
		Object.defineProperty(oversized, "size", { value: 20 * 1024 * 1024 + 1 });
		fireEvent.change(input, { target: { files: [oversized] } });
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Choose an image smaller than 20 MB.",
		);

		const invalid = new File(["text"], "avatar.txt", { type: "text/plain" });
		fireEvent.change(input, { target: { files: [invalid] } });
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Choose a JPEG, PNG, WebP, or GIF image.",
		);
	});

	it("lets the user rotate the crop and sends the selected pixel crop", async () => {
		vi.mocked(uploadAvatar).mockResolvedValue({ avatarVersion: "version-2" });
		const onSaved = vi.fn();
		const { container } = renderModal({ onSaved });
		const input = container.querySelector("input[type=file]") as HTMLInputElement;
		const file = new File(["avatar"], "avatar.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [file] } });

		const rotate = await screen.findByRole("button", {
			name: "Rotate clockwise",
		});
		fireEvent.click(rotate);
		expect(screen.getByText("90°")).toBeInTheDocument();

		const image = screen.getAllByRole("img")[0];
		Object.defineProperty(image, "naturalWidth", {
			configurable: true,
			value: 800,
		});
		Object.defineProperty(image, "naturalHeight", {
			configurable: true,
			value: 600,
		});
		fireEvent.load(image);
		const save = await screen.findByRole("button", { name: "Save" });
		await waitFor(() => expect(save).toBeEnabled());
		fireEvent.click(save);

		await waitFor(() => expect(uploadAvatar).toHaveBeenCalledOnce());
		expect(vi.mocked(uploadAvatar).mock.calls[0][0]).toBe(session);
		expect(vi.mocked(uploadAvatar).mock.calls[0][1]).toBe(file);
		expect(vi.mocked(uploadAvatar).mock.calls[0][2]).toMatchObject({
			rotation: 90,
			cropSize: expect.any(Number),
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith("version-2"));
	});

	it("removes an existing avatar and propagates the null version", async () => {
		vi.mocked(removeAvatar).mockResolvedValue({ avatarVersion: null });
		const onSaved = vi.fn();
		renderModal({ avatarVersion: "version-1", onSaved });
		fireEvent.click(screen.getByRole("button", { name: "Remove avatar" }));
		await waitFor(() => expect(removeAvatar).toHaveBeenCalledWith(session));
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null));
	});
});

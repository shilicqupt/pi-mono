import { beforeAll, describe, expect, test, vi } from "vitest";
import type { UserMessageSelectorComponent } from "../src/modes/interactive/components/user-message-selector.js";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("InteractiveMode /fork selector", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	test("offers Current state in an empty session", () => {
		let selectorFactory:
			| ((done: () => void) => { component: UserMessageSelectorComponent; focus: unknown })
			| undefined;
		const fakeThis = {
			session: {
				getUserMessagesForForking: () => [] as Array<{ entryId: string; text: string }>,
			},
			sessionManager: {
				getLeafId: () => null as string | null,
			},
			showSelector: vi.fn(
				(create: (done: () => void) => { component: UserMessageSelectorComponent; focus: unknown }) => {
					selectorFactory = create;
				},
			),
			showStatus: vi.fn(),
		};

		const showUserMessageSelector = Reflect.get(InteractiveMode.prototype, "showUserMessageSelector") as (
			this: typeof fakeThis,
		) => void;
		showUserMessageSelector.call(fakeThis);

		expect(fakeThis.showSelector).toHaveBeenCalledTimes(1);
		expect(fakeThis.showStatus).not.toHaveBeenCalledWith("No messages to fork from");
		expect(selectorFactory).toBeDefined();

		const done = vi.fn();
		const { component } = selectorFactory!(done);
		const rendered = component.render(120).join("\n");
		expect(rendered).toContain("Current state");
	});

	test("forks from Current state with position=at in an empty session", async () => {
		let selectorFactory:
			| ((done: () => void) => { component: UserMessageSelectorComponent; focus: unknown })
			| undefined;
		const fakeThis = {
			session: {
				getUserMessagesForForking: () => [] as Array<{ entryId: string; text: string }>,
			},
			sessionManager: {
				getLeafId: () => null as string | null,
			},
			runtimeHost: {
				fork: vi.fn(async () => ({ cancelled: false, selectedText: "forked text" })),
			},
			handleRuntimeSessionChange: vi.fn(async () => {}),
			renderCurrentSessionState: vi.fn(),
			editor: { setText: vi.fn() },
			ui: { requestRender: vi.fn() },
			showSelector: vi.fn(
				(create: (done: () => void) => { component: UserMessageSelectorComponent; focus: unknown }) => {
					selectorFactory = create;
				},
			),
			showStatus: vi.fn(),
		};

		const showUserMessageSelector = Reflect.get(InteractiveMode.prototype, "showUserMessageSelector") as (
			this: typeof fakeThis,
		) => void;
		showUserMessageSelector.call(fakeThis);

		expect(selectorFactory).toBeDefined();
		const done = vi.fn();
		const { component } = selectorFactory!(done);
		const onSelect = component.getMessageList().onSelect as (entryId: string) => Promise<void>;
		await onSelect("__pi_current_state__");

		expect(fakeThis.runtimeHost.fork).toHaveBeenCalledWith(undefined, { position: "at" });
		expect(fakeThis.handleRuntimeSessionChange).toHaveBeenCalledTimes(1);
		expect(fakeThis.renderCurrentSessionState).toHaveBeenCalledTimes(1);
		expect(fakeThis.editor.setText).toHaveBeenCalledWith("forked text");
		expect(done).toHaveBeenCalledTimes(1);
		expect(fakeThis.showStatus).toHaveBeenCalledWith("Branched to new session");
	});
});

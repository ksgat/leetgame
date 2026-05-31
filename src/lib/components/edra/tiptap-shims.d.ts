import type { EditorView } from '@tiptap/pm/view';
import type { Slice } from '@tiptap/pm/model';

declare module '@tiptap/core' {
	interface Storage {
		searchAndReplace: {
			searchTerm: string;
			replaceTerm: string;
			caseSensitive: boolean;
			results: Array<{ from: number; to: number }>;
			resultIndex: number;
			lastSearchTerm: string;
			lastCaseSensitive: boolean;
			lastResultIndex: number;
		};
		slashCommand: {
			rect?: DOMRect;
		};
	}
}

declare module '@tiptap/pm/view' {
	export function __serializeForClipboard(
		view: EditorView,
		slice: Slice
	): { dom: HTMLElement; text: string };
}

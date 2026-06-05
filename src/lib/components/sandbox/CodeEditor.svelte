<script lang="ts">
	import { tick } from 'svelte';

	let { code = $bindable(), onRun }: { code: string; onRun: () => void } = $props();

	let textareaRef = $state<HTMLTextAreaElement>();
	let gutterRef = $state<HTMLPreElement>();
	let lineNumberText = $derived(
		Array.from({ length: Math.max(1, code.split('\n').length) }, (_, index) => index + 1).join('\n')
	);

	const syncEditorScroll = () => {
		if (gutterRef && textareaRef) gutterRef.scrollTop = textareaRef.scrollTop;
	};

	const insertText = async (text: string) => {
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		code = `${code.slice(0, start)}${text}${code.slice(end)}`;

		await tick();
		textareaRef.setSelectionRange(start + text.length, start + text.length);
	};

	const unindentSelection = async () => {
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const lineStart = code.lastIndexOf('\n', start - 1) + 1;
		const lineEndIndex = code.indexOf('\n', end);
		const lineEnd = lineEndIndex === -1 ? code.length : lineEndIndex;
		const before = code.slice(0, lineStart);
		const selected = code.slice(lineStart, lineEnd);
		const after = code.slice(lineEnd);
		let removedBeforeSelection = 0;

		const unindented = selected
			.split('\n')
			.map((line, index) => {
				if (line.startsWith('  ')) {
					if (index === 0) removedBeforeSelection = Math.min(2, start - lineStart);
					return line.slice(2);
				}

				if (line.startsWith('\t')) {
					if (index === 0) removedBeforeSelection = Math.min(1, start - lineStart);
					return line.slice(1);
				}

				return line;
			})
			.join('\n');

		code = `${before}${unindented}${after}`;

		await tick();
		const delta = selected.length - unindented.length;
		textareaRef.setSelectionRange(
			Math.max(lineStart, start - removedBeforeSelection),
			Math.max(lineStart, end - delta)
		);
	};

	const handleEditorKeydown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			onRun();
			return;
		}

		if (event.key !== 'Tab') return;

		event.preventDefault();
		if (event.shiftKey) {
			void unindentSelection();
		} else {
			void insertText('  ');
		}
	};
</script>

<div
	class="grid h-full min-h-0 min-w-0 grid-cols-[54px_minmax(0,1fr)] overflow-hidden bg-[#fffdf4] text-[#242136]"
	aria-label="JavaScript editor"
	role="tabpanel"
>
	<pre
		bind:this={gutterRef}
		class="m-0 block h-full min-h-0 w-full overflow-hidden border-r-2 border-[#242136] bg-[#dff7ff] py-[18px] pr-2.5 text-right [font-family:'Comic_Sans_MS','Comic_Sans','SFMono-Regular',Consolas,cursive] text-[0.92rem] leading-[1.6] break-normal whitespace-pre [tab-size:2] text-[#0072a3] select-none"
		aria-hidden="true">{lineNumberText}</pre>
	<textarea
		bind:this={textareaRef}
		bind:value={code}
		class="m-0 block h-full min-h-0 w-full min-w-0 resize-none overflow-auto border-0 bg-transparent py-[18px] pr-[18px] pl-4 [font-family:'Comic_Sans_MS','Comic_Sans','SFMono-Regular',Consolas,cursive] text-[0.92rem] leading-[1.6] [tab-size:2] text-inherit caret-[#ff5c35] outline-0 selection:bg-[rgba(35,201,255,0.28)]"
		aria-label="JavaScript source"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		wrap="off"
		onkeydown={handleEditorKeydown}
		onscroll={syncEditorScroll}
	></textarea>
</div>

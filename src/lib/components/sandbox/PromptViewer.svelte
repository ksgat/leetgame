<script lang="ts">
	import { markdownBodyClass } from './classes';
	import { renderMarkdown } from '$lib/sandbox/markdown';

	let { markdown }: { markdown: string } = $props();

	let promptHtml = $derived(renderMarkdown(markdown));
</script>

<div
	class="min-h-0 overflow-auto bg-[#fffdf4] p-5 text-[#242136]"
	role="tabpanel"
	aria-label="Challenge prompt"
>
	<article class={markdownBodyClass}>
		{@html promptHtml}
	</article>
</div>

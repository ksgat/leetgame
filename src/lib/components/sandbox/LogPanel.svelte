<script lang="ts">
	import { headerClass, panelClass, statusClass } from './classes';
	import type { LogEntry } from '$lib/sandbox/types';

	let { entries }: { entries: LogEntry[] } = $props();
</script>

<div class={panelClass}>
	<div class={headerClass}>
		<span>Errors + Logs</span>
		<span class={statusClass}>{entries.length}</span>
	</div>
	<div class="overflow-auto bg-[#f7fffb] p-3" aria-live="polite">
		{#if entries.length === 0}
			<p class="m-0 text-[0.86rem] text-[#62717f]">No output yet.</p>
		{:else}
			{#each entries as entry (entry.id)}
				<pre
					class={`m-0 mb-2 grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 [font-family:'Comic_Sans_MS','Comic_Sans','SFMono-Regular',Consolas,cursive] text-[0.82rem] leading-[1.45] break-words whitespace-pre-wrap text-[#242136] ${entry.type === 'runtime' || entry.type === 'error' ? 'text-[#d63230]' : ''}`}><span
						class={`font-extrabold ${entry.type === 'warn' ? 'text-[#b77400]' : entry.type === 'runtime' || entry.type === 'error' ? 'text-[#d63230]' : 'text-[#008a65]'}`}
						>{entry.type}</span
					>{entry.text}</pre>
			{/each}
		{/if}
	</div>
</div>

<script lang="ts">
	import CodeEditor from './CodeEditor.svelte';
	import PromptViewer from './PromptViewer.svelte';
	import { activeTabButtonClass, buttonClass, ghostButtonClass, tabButtonClass } from './classes';
	import type { ActiveSandboxTab, SandboxStatus } from '$lib/sandbox/types';

	let {
		code = $bindable(),
		promptMarkdown,
		status,
		onRun,
		onReset,
		onStop
	}: {
		code: string;
		promptMarkdown: string;
		status: SandboxStatus;
		onRun: () => void;
		onReset: () => void;
		onStop: () => void;
	} = $props();

	let activeTab = $state<ActiveSandboxTab>('code');
</script>

<aside
	class="grid h-[calc(100vh-36px)] min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border-2 border-[#242136] bg-white shadow-[7px_7px_0_#00c2ff] max-[900px]:h-[58vh]"
>
	<header
		class="flex items-center justify-between gap-3 border-b-2 border-[#242136] bg-[#fff8c9] p-3.5 max-[560px]:flex-col max-[560px]:items-stretch"
	>
		<div>
			<p
				class="m-0 mb-[3px] text-[0.72rem] font-extrabold tracking-[0.04em] text-[#007e7a] uppercase"
			>
				LeetGame
			</p>
			<h1 class="m-0 text-[1.1rem] leading-tight text-[#242136]">JS Sandbox</h1>
		</div>
		<div class="flex flex-wrap justify-end gap-2 max-[560px]:w-full">
			<button type="button" class={`${ghostButtonClass} max-[560px]:flex-1`} onclick={onReset}
				>Reset</button
			>
			<button
				type="button"
				class={`${ghostButtonClass} max-[560px]:flex-1`}
				onclick={onStop}
				disabled={status === 'idle' || status === 'stopped'}
			>
				Stop
			</button>
			<button
				type="button"
				class={`${buttonClass} max-[560px]:flex-1`}
				onclick={onRun}
				disabled={status === 'booting'}
			>
				{status === 'booting' ? 'Starting' : 'Run'}
			</button>
		</div>
	</header>

	<div
		class="flex gap-2 border-b-2 border-[#242136] bg-white p-2.5"
		role="tablist"
		aria-label="Sandbox panels"
	>
		<button
			type="button"
			role="tab"
			class={`${tabButtonClass} ${activeTab === 'code' ? activeTabButtonClass : ''}`}
			aria-selected={activeTab === 'code'}
			onclick={() => (activeTab = 'code')}
		>
			Code
		</button>
		<button
			type="button"
			role="tab"
			class={`${tabButtonClass} ${activeTab === 'prompt' ? activeTabButtonClass : ''}`}
			aria-selected={activeTab === 'prompt'}
			onclick={() => (activeTab = 'prompt')}
		>
			Prompt
		</button>
	</div>

	{#if activeTab === 'code'}
		<CodeEditor bind:code {onRun} />
	{:else}
		<PromptViewer markdown={promptMarkdown} />
	{/if}
</aside>

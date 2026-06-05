<script lang="ts">
	import {
		headerClass,
		panelClass,
		statusActiveClass,
		statusClass,
		statusErrorClass
	} from './classes';
	import type { SandboxStatus } from '$lib/sandbox/types';

	let {
		iframeRef = $bindable(),
		status
	}: { iframeRef?: HTMLIFrameElement; status: SandboxStatus } = $props();
</script>

<div class={panelClass}>
	<div class={headerClass}>
		<span>Output</span>
		<span
			class={`${statusClass} ${status === 'booting' || status === 'running' ? statusActiveClass : ''} ${status === 'error' ? statusErrorClass : ''}`}
		>
			{status}
		</span>
	</div>
	<iframe
		bind:this={iframeRef}
		class="h-full w-full border-0 bg-[#fffdf4]"
		title="Sandbox output"
		sandbox="allow-scripts"
	></iframe>
</div>

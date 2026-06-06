<script lang="ts">
	import SandboxWorkspace from '$lib/components/sandbox/SandboxWorkspace.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.problem.title} - LeetGame</title>
</svelte:head>

<SandboxWorkspace
	initialCode={data.problem.starterCode}
	promptMarkdown={data.problem.promptMarkdown}
/>

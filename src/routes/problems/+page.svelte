<script lang="ts">
	import { buttonClass, ghostButtonClass } from '$lib/components/sandbox/classes';

	let { data } = $props();
</script>

<svelte:head>
	<title>Problems - LeetGame</title>
</svelte:head>

<main
	class="min-h-screen bg-[#fffdf4] p-[18px] [font-family:'Comic_Sans_MS','Comic_Sans',ui-rounded,cursive] text-[#242136] max-[900px]:p-2.5"
>
	<section
		class="min-h-[calc(100vh-36px)] rounded-lg border-2 border-[#242136] bg-white p-6 shadow-[7px_7px_0_#00c2ff]"
	>
		<header
			class="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#242136] pb-5"
		>
			<div>
				<p class="m-0 mb-1 text-xs font-extrabold tracking-[0.08em] text-[#007e7a] uppercase">
					Problems
				</p>
				<h1 class="m-0 text-4xl font-extrabold">Choose a challenge</h1>
				<p class="m-0 mt-2 text-sm text-[#62717f]">
					Signed in as {data.user.name ?? data.user.email ?? 'GitHub user'}.
				</p>
			</div>
			<form method="POST" action="/auth/logout">
				<button class={ghostButtonClass} type="submit">Log out</button>
			</form>
		</header>

		{#if data.problems.length === 0}
			<div
				class="mt-6 rounded-lg border-2 border-[#242136] bg-[#fff8c9] p-5 shadow-[4px_4px_0_#ffcc33]"
			>
				<h2 class="m-0 text-2xl font-extrabold">No problems yet</h2>
				<p class="mb-0 leading-7">
					Add rows to the <code>problems</code> table with <code>slug</code>, <code>title</code>,
					and <code>prompt_markdown</code>. The sandbox route will pick them up.
				</p>
			</div>
		{:else}
			<div class="mt-6 grid gap-4">
				{#each data.problems as problem}
					<article
						class="rounded-lg border-2 border-[#242136] bg-[#f7fffb] p-5 shadow-[4px_4px_0_#ffcc33]"
					>
						<h2 class="m-0 text-2xl font-extrabold">{problem.title}</h2>
						<div class="mt-4">
							<a class={buttonClass} href={`/problems/${problem.slug}`}>Open sandbox</a>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>

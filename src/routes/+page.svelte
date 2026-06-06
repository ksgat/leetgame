<script lang="ts">
	import { buttonClass, ghostButtonClass } from '$lib/components/sandbox/classes';
</script>

<svelte:head>
	<title>LeetGame</title>
	<meta
		name="description"
		content="Daily creative coding problems with an in-browser JavaScript sandbox."
	/>
</svelte:head>

<main
	class="min-h-screen bg-[#fffdf4] p-[18px] [font-family:'Comic_Sans_MS','Comic_Sans',ui-rounded,cursive] text-[#242136] max-[900px]:p-2.5"
>
	<section
		class="grid min-h-[calc(100vh-36px)] place-items-center rounded-lg border-2 border-[#242136] bg-white p-8 text-center shadow-[7px_7px_0_#00c2ff]"
	>
		<div class="max-w-[680px]">
			<p class="m-0 mb-2 text-sm font-extrabold tracking-[0.08em] text-[#007e7a] uppercase">
				LeetGame
			</p>
			<h1 class="m-0 text-5xl leading-none font-extrabold max-[640px]:text-4xl">
				Tiny daily coding problems.
			</h1>
			<p class="mx-auto mt-5 mb-0 max-w-[520px] text-lg leading-8">
				Solve bright little JavaScript challenges in a browser sandbox. Auth and daily problem
				loading are wired for the real app shape now.
			</p>
			<div class="mt-8 flex flex-wrap justify-center gap-3">
				<a class={buttonClass} href="/auth">Sign up</a>
				<a class={ghostButtonClass} href="/auth">Log in</a>
			</div>
		</div>
	</section>
</main>

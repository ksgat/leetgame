<script lang="ts">
	import { buttonClass, ghostButtonClass } from '$lib/components/sandbox/classes';
</script>

<svelte:head>
	<title>Sign in - LeetGame</title>
</svelte:head>

<main
	class="min-h-screen bg-[#fffdf4] p-[18px] [font-family:'Comic_Sans_MS','Comic_Sans',ui-rounded,cursive] text-[#242136] max-[900px]:p-2.5"
>
	<section
		class="mx-auto grid min-h-[calc(100vh-36px)] max-w-[760px] place-items-center rounded-lg border-2 border-[#242136] bg-white p-8 text-center shadow-[7px_7px_0_#ffcc33]"
	>
		<div>
			<p class="m-0 mb-2 text-sm font-extrabold tracking-[0.08em] text-[#007e7a] uppercase">
				Account
			</p>
			<h1 class="m-0 text-4xl font-extrabold">Sign up or log in</h1>
			<p class="mx-auto mt-4 mb-0 max-w-[460px] leading-7">
				Use GitHub for now. First sign-in creates your LeetGame account automatically.
			</p>
			<div class="mt-7 flex flex-wrap justify-center gap-3">
				<a class={buttonClass} href="/auth/github">Continue with GitHub</a>
				<a class={ghostButtonClass} href="/">Back</a>
			</div>
		</div>
	</section>
</main>

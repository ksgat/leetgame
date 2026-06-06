<script lang="ts">
	import EditorPanel from './EditorPanel.svelte';
	import LogPanel from './LogPanel.svelte';
	import ViewerPanel from './ViewerPanel.svelte';
	import { appShellClass, workspaceClass } from './classes';
	import {
		promptMarkdown as fallbackPromptMarkdown,
		starterCode as fallbackStarterCode
	} from '$lib/sandbox/content';
	import { buildDocument, stoppedDocument } from '$lib/sandbox/runtime';
	import type { LogEntry, SandboxMessage, SandboxStatus } from '$lib/sandbox/types';

	const maxEntries = 200;

	let {
		initialCode = fallbackStarterCode,
		promptMarkdown = fallbackPromptMarkdown
	}: { initialCode?: string | null; promptMarkdown?: string } = $props();

	let code = $state(fallbackStarterCode);
	let entries = $state<LogEntry[]>([]);
	let iframeRef = $state<HTMLIFrameElement>();
	let status = $state<SandboxStatus>('idle');
	let hasBootedSandbox = $state(false);
	let hasInitializedCode = $state(false);
	let runId = 0;
	let entryId = 0;

	const addEntry = (type: LogEntry['type'], text: string) => {
		const normalized = text.length > 6000 ? `${text.slice(0, 6000)}\n...truncated` : text;
		entries = [...entries, { id: entryId++, type, text: normalized }].slice(-maxEntries);
	};

	const runCode = () => {
		if (!iframeRef) return;

		const currentRun = ++runId;
		status = 'booting';
		entries = [];
		iframeRef.srcdoc = buildDocument(code, currentRun);
	};

	const stopCode = () => {
		if (!iframeRef) return;

		runId++;
		status = 'stopped';
		iframeRef.srcdoc = stoppedDocument();
		addEntry('info', 'Run stopped');
	};

	const resetCode = () => {
		code = initialCode || fallbackStarterCode;
		runCode();
	};

	$effect(() => {
		if (hasInitializedCode) return;
		code = initialCode || fallbackStarterCode;
		hasInitializedCode = true;
	});

	$effect(() => {
		const handleMessage = (event: MessageEvent<SandboxMessage & { sandboxId?: number }>) => {
			if (event.source !== iframeRef?.contentWindow || event.data?.sandboxId !== runId) return;

			if (event.data.type === 'ready') return;

			if (event.data.type === 'started') {
				status = 'running';
				addEntry('info', 'Run started');
				return;
			}

			if (event.data.type === 'console') {
				addEntry(event.data.level, event.data.values.join(' '));
				return;
			}

			if (event.data.type === 'error') {
				status = 'error';
				addEntry('runtime', event.data.stack || event.data.message);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});

	$effect(() => {
		if (iframeRef && !hasBootedSandbox) {
			hasBootedSandbox = true;
			runCode();
		}
	});
</script>

<main class={appShellClass}>
	<section class={workspaceClass} aria-label="JavaScript sandbox">
		<EditorPanel
			bind:code
			{promptMarkdown}
			{status}
			onRun={runCode}
			onReset={resetCode}
			onStop={stopCode}
		/>

		<section
			class="grid min-w-0 grid-rows-[minmax(340px,1fr)_minmax(180px,28vh)] gap-3.5 max-[900px]:grid-rows-[48vh_220px]"
		>
			<ViewerPanel bind:iframeRef {status} />
			<LogPanel {entries} />
		</section>
	</section>
</main>

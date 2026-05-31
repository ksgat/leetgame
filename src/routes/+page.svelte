<script lang="ts">
	import { tick } from 'svelte';

	type LogType = 'log' | 'info' | 'warn' | 'error';
	type SandboxStatus = 'idle' | 'booting' | 'running' | 'error' | 'stopped';

	type SandboxMessage =
		| {
				type: 'ready';
		  }
		| {
				type: 'started';
		  }
		| {
				type: 'console';
				level: LogType;
				values: string[];
		  }
		| {
				type: 'error';
				message: string;
				stack?: string;
		  };

	type Entry = {
		id: number;
		type: LogType | 'runtime';
		text: string;
	};

	const maxEntries = 200;

	const starterCode = `fitCanvas();

let t = 0;

loop(({ dt, width, height }) => {
  t += dt;
  clear('#10151f');

  for (let i = 0; i < 80; i++) {
    const p = i / 80;
    const x = width * p;
    const y = height / 2 + Math.sin(t * 3 + i * 0.28) * 110;
    const r = 12 + Math.sin(t + i) * 8;

    ctx.beginPath();
    ctx.fillStyle = \`hsl(\${190 + p * 130}, 78%, 58%)\`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
});

console.log('creative coding sandbox ready');`;

	let code = $state(starterCode);
	let entries = $state<Entry[]>([]);
	let iframeRef = $state<HTMLIFrameElement>();
	let textareaRef = $state<HTMLTextAreaElement>();
	let gutterRef = $state<HTMLPreElement>();
	let status = $state<SandboxStatus>('idle');
	let hasBootedSandbox = $state(false);
	let runId = 0;
	let entryId = 0;
	let lineNumberText = $derived(
		Array.from({ length: Math.max(1, code.split('\n').length) }, (_, index) => index + 1).join('\n')
	);

	const addEntry = (type: Entry['type'], text: string) => {
		const normalized = text.length > 6000 ? `${text.slice(0, 6000)}\n...truncated` : text;
		entries = [...entries, { id: entryId++, type, text: normalized }].slice(-maxEntries);
	};

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
			runCode();
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

	const stoppedDocument = () => `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<style>
			html, body { width: 100%; height: 100%; margin: 0; }
			body {
				display: grid;
				place-items: center;
				background: #10151f;
				color: #9fb0c6;
				font: 700 13px Inter, ui-sans-serif, system-ui, sans-serif;
				letter-spacing: 0.08em;
				text-transform: uppercase;
			}
		</style>
	</head>
	<body>Stopped</body>
</html>`;

	const buildDocument = (source: string, id: number) => {
		const userSource = `${source}\n\n//# sourceURL=leetgame-user-code.js`;
		const sourceJson = JSON.stringify(userSource).replace(/<\/script/gi, '<\\/script');

		return `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta
			http-equiv="Content-Security-Policy"
			content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; connect-src https:; img-src https: data: blob:; media-src https: data: blob:; style-src 'unsafe-inline'; font-src data:;"
		/>
		<style>
			* { box-sizing: border-box; }
			html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
			body {
				background: #10151f;
				color: #e7edf7;
				font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			}
			#app { width: 100%; height: 100%; overflow: hidden; }
			canvas { display: block; width: 100%; height: 100%; }
		</style>
	</head>
	<body>
		<div id="app"></div>
		<script>
			(() => {
				const sandboxId = ${id};
				const userCode = ${sourceJson};
				const app = document.getElementById('app');
				const send = (message) => parent.postMessage({ sandboxId, ...message }, '*');
				const native = {
					requestAnimationFrame: window.requestAnimationFrame.bind(window),
					cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
					setTimeout: window.setTimeout.bind(window),
					clearTimeout: window.clearTimeout.bind(window),
					setInterval: window.setInterval.bind(window),
					clearInterval: window.clearInterval.bind(window)
				};

				let disposed = false;
				let activeLoop = 0;
				const rafIds = new Set();
				const timeoutIds = new Set();
				const intervalIds = new Set();
				const resizeHandlers = new Set();

				const truncate = (value) => {
					const text = String(value);
					return text.length > 4000 ? text.slice(0, 4000) + '\\n...truncated' : text;
				};

				const serialize = (value, seen = new WeakSet()) => {
					if (typeof value === 'string') return truncate(value);
					if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value);
					if (typeof value === 'bigint') return value.toString() + 'n';
					if (typeof value === 'symbol') return value.toString();
					if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
					if (value instanceof Error) return truncate((value.stack || value.name + ': ' + value.message));
					if (value instanceof Element) return '<' + value.tagName.toLowerCase() + '>';

					try {
						return truncate(
							JSON.stringify(
								value,
								(_, nested) => {
									if (typeof nested === 'bigint') return nested.toString() + 'n';
									if (typeof nested === 'function') return '[Function ' + (nested.name || 'anonymous') + ']';
									if (nested instanceof Element) return '<' + nested.tagName.toLowerCase() + '>';
									if (nested && typeof nested === 'object') {
										if (seen.has(nested)) return '[Circular]';
										seen.add(nested);
									}
									return nested;
								},
								2
							) ?? String(value)
						);
					} catch {
						return truncate(value);
					}
				};

				for (const level of ['log', 'info', 'warn', 'error']) {
					const original = console[level].bind(console);
					console[level] = (...values) => {
						original(...values);
						send({ type: 'console', level, values: values.map((value) => serialize(value)) });
					};
				}

				window.requestAnimationFrame = (callback) => {
					const id = native.requestAnimationFrame((time) => {
						rafIds.delete(id);
						if (!disposed) callback(time);
					});
					rafIds.add(id);
					return id;
				};

				window.cancelAnimationFrame = (id) => {
					rafIds.delete(id);
					native.cancelAnimationFrame(id);
				};

				window.setTimeout = (callback, delay, ...args) => {
					const id = native.setTimeout(() => {
						timeoutIds.delete(id);
						if (!disposed) callback(...args);
					}, delay);
					timeoutIds.add(id);
					return id;
				};

				window.clearTimeout = (id) => {
					timeoutIds.delete(id);
					native.clearTimeout(id);
				};

				window.setInterval = (callback, delay, ...args) => {
					const id = native.setInterval(() => {
						if (!disposed) callback(...args);
					}, delay);
					intervalIds.add(id);
					return id;
				};

				window.clearInterval = (id) => {
					intervalIds.delete(id);
					native.clearInterval(id);
				};

				const cleanup = () => {
					disposed = true;
					activeLoop++;
					for (const id of rafIds) native.cancelAnimationFrame(id);
					for (const id of timeoutIds) native.clearTimeout(id);
					for (const id of intervalIds) native.clearInterval(id);
					rafIds.clear();
					timeoutIds.clear();
					intervalIds.clear();
					resizeHandlers.clear();
				};

				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				app.append(canvas);

				const fitCanvas = (maxDpr = 2) => {
					const dpr = Math.max(1, Math.min(devicePixelRatio || 1, maxDpr));
					const width = innerWidth;
					const height = innerHeight;
					const pixelWidth = Math.max(1, Math.floor(width * dpr));
					const pixelHeight = Math.max(1, Math.floor(height * dpr));

					if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
						canvas.width = pixelWidth;
						canvas.height = pixelHeight;
						canvas.style.width = width + 'px';
						canvas.style.height = height + 'px';
					}

					ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
					return { width, height, dpr };
				};

				const clear = (color = '#10151f') => {
					ctx.save();
					ctx.setTransform(1, 0, 0, 1, 0, 0);
					ctx.fillStyle = color;
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					ctx.restore();
				};

				const loop = (draw) => {
					const token = ++activeLoop;
					let previous = performance.now();

					const frame = (now) => {
						if (disposed || token !== activeLoop) return;

						const size = fitCanvas();
						const dt = Math.min(0.1, (now - previous) / 1000);
						previous = now;
						draw({ time: now / 1000, dt, canvas, ctx, ...size });
						requestAnimationFrame(frame);
					};

					requestAnimationFrame(frame);
					return () => {
						if (activeLoop === token) activeLoop++;
					};
				};

				const onResize = (handler) => {
					resizeHandlers.add(handler);
					return () => resizeHandlers.delete(handler);
				};

				addEventListener('resize', () => {
					const size = fitCanvas();
					for (const handler of resizeHandlers) handler(size);
				});
				addEventListener('pagehide', cleanup);
				addEventListener('error', (event) => {
					send({
						type: 'error',
						message: event.message,
						stack: event.error?.stack
					});
				});
				addEventListener('unhandledrejection', (event) => {
					const reason = event.reason;
					send({
						type: 'error',
						message: reason?.message ?? String(reason),
						stack: reason?.stack
					});
				});

				Object.assign(window, {
					app,
					canvas,
					ctx,
					fitCanvas,
					clear,
					loop,
					onResize,
					stopLoop: () => activeLoop++,
					random: (min = 1, max) => (max === undefined ? Math.random() * min : min + Math.random() * (max - min)),
					clamp: (value, min, max) => Math.min(max, Math.max(min, value))
				});

				fitCanvas();
				send({ type: 'ready' });

				(async () => {
					try {
						const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
						await AsyncFunction(userCode).call(window);
						if (!disposed) send({ type: 'started' });
					} catch (error) {
						send({
							type: 'error',
							message: error?.message ?? String(error),
							stack: error?.stack
						});
					}
				})();
			})();
		</scr${'ipt'}>
	</body>
</html>`;
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
		code = starterCode;
		runCode();
	};

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

<svelte:head>
	<title>LeetGame Sandbox</title>
	<meta
		name="description"
		content="A single-file JavaScript sandbox for creative coding and game dev challenges."
	/>
</svelte:head>

<main class="app-shell">
	<section class="workspace" aria-label="JavaScript sandbox">
		<aside class="editor-pane">
			<header class="pane-header">
				<div>
					<p class="eyebrow">LeetGame</p>
					<h1>JS Sandbox</h1>
				</div>
				<div class="actions">
					<button type="button" class="ghost" onclick={resetCode}>Reset</button>
					<button
						type="button"
						class="ghost"
						onclick={stopCode}
						disabled={status === 'idle' || status === 'stopped'}
					>
						Stop
					</button>
					<button type="button" onclick={runCode} disabled={status === 'booting'}>
						{status === 'booting' ? 'Starting' : 'Run'}
					</button>
				</div>
			</header>

			<div class="code-editor-shell" aria-label="JavaScript editor">
				<pre bind:this={gutterRef} class="line-numbers" aria-hidden="true">{lineNumberText}</pre>
				<textarea
					bind:this={textareaRef}
					bind:value={code}
					aria-label="JavaScript source"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					wrap="off"
					onkeydown={handleEditorKeydown}
					onscroll={syncEditorScroll}
				></textarea>
			</div>
		</aside>

		<section class="result-pane">
			<div class="preview-wrap">
				<div class="preview-bar">
					<span>Output</span>
					<span
						class:active={status === 'booting' || status === 'running'}
						class:error-status={status === 'error'}
					>
						{status}
					</span>
				</div>
				<iframe bind:this={iframeRef} title="Sandbox output" sandbox="allow-scripts"></iframe>
			</div>

			<div class="console-wrap">
				<div class="preview-bar">
					<span>Errors + Logs</span>
					<span>{entries.length}</span>
				</div>
				<div class="console" aria-live="polite">
					{#if entries.length === 0}
						<p class="empty">No output yet.</p>
					{:else}
						{#each entries as entry (entry.id)}
							<pre
								class:error={entry.type === 'runtime' || entry.type === 'error'}
								class:warn={entry.type === 'warn'}><span>{entry.type}</span>{entry.text}</pre>
						{/each}
					{/if}
				</div>
			</div>
		</section>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #eef2f6;
		color: #17202e;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	:global(button),
	:global(textarea) {
		font: inherit;
	}

	.app-shell {
		min-height: 100vh;
		padding: 18px;
		background: #eef2f6;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(360px, 44vw) minmax(0, 1fr);
		gap: 14px;
		min-height: calc(100vh - 36px);
	}

	.editor-pane,
	.result-pane {
		min-width: 0;
	}

	.editor-pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		height: calc(100vh - 36px);
		min-height: 0;
		overflow: hidden;
		border: 1px solid #cfd8e3;
		border-radius: 8px;
		background: #f8fafc;
	}

	.pane-header,
	.preview-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid #d8e0ea;
		background: #ffffff;
	}

	.pane-header {
		padding: 14px;
	}

	.eyebrow {
		margin: 0 0 3px;
		color: #5c6b7d;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.2;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}

	button {
		min-width: 76px;
		border: 1px solid #17202e;
		border-radius: 6px;
		background: #17202e;
		color: #ffffff;
		padding: 8px 12px;
		font-weight: 800;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: #27344a;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.52;
	}

	button.ghost {
		border-color: #b8c4d2;
		background: #ffffff;
		color: #17202e;
	}

	button.ghost:hover:not(:disabled) {
		background: #edf3f8;
	}

	.code-editor-shell {
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: #10151f;
		color: #e7edf7;
	}

	.line-numbers,
	textarea {
		box-sizing: border-box;
		margin: 0;
		padding: 18px 0;
		border: 0;
		font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.92rem;
		line-height: 1.6;
		tab-size: 2;
	}

	.line-numbers {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		border-right: 1px solid #263348;
		background: #0c111a;
		color: #627086;
		padding-right: 10px;
		text-align: right;
		user-select: none;
		white-space: pre;
		word-break: normal;
	}

	textarea {
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		resize: none;
		outline: 0;
		background: transparent;
		color: inherit;
		caret-color: #68e0b7;
		padding-left: 16px;
		padding-right: 18px;
		overflow: auto;
	}

	textarea::selection {
		background: rgba(104, 224, 183, 0.24);
	}

	.result-pane {
		display: grid;
		grid-template-rows: minmax(340px, 1fr) minmax(180px, 28vh);
		gap: 14px;
	}

	.preview-wrap,
	.console-wrap {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		overflow: hidden;
		border: 1px solid #cfd8e3;
		border-radius: 8px;
		background: #ffffff;
	}

	.preview-bar {
		min-height: 42px;
		padding: 0 12px;
		color: #344154;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.preview-bar span:last-child {
		border: 1px solid #cfd8e3;
		border-radius: 999px;
		padding: 3px 8px;
		color: #516174;
		font-size: 0.68rem;
	}

	.preview-bar span:last-child.active {
		border-color: #32bf8f;
		color: #137656;
	}

	.preview-bar span:last-child.error-status {
		border-color: #ef6f6c;
		color: #b42320;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: 0;
		background: #10151f;
	}

	.console {
		overflow: auto;
		background: #17202e;
		padding: 12px;
	}

	.empty {
		margin: 0;
		color: #92a0b3;
		font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.86rem;
	}

	.console pre {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 10px;
		margin: 0 0 8px;
		white-space: pre-wrap;
		word-break: break-word;
		color: #dce7f5;
		font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.console pre span {
		color: #89d7b0;
		font-weight: 800;
	}

	.console pre.warn span {
		color: #ffd166;
	}

	.console pre.error,
	.console pre.error span {
		color: #ff8a8a;
	}

	@media (max-width: 900px) {
		.app-shell {
			padding: 10px;
		}

		.workspace {
			grid-template-columns: 1fr;
			min-height: auto;
		}

		.editor-pane {
			height: 58vh;
			min-height: 0;
		}

		.result-pane {
			grid-template-rows: 48vh 220px;
		}
	}

	@media (max-width: 560px) {
		.pane-header {
			align-items: stretch;
			flex-direction: column;
		}

		.actions {
			width: 100%;
		}

		button {
			flex: 1;
		}
	}
</style>

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

	type ActiveTab = 'code' | 'prompt';

	const maxEntries = 200;

	const starterCode = `fitCanvas();

let t = 0;

loop(({ dt, width, height }) => {
  t += dt;
  clear('#fffdf4');

  for (let i = 0; i < 80; i++) {
    const p = i / 80;
    const x = width * p;
    const y = height / 2 + Math.sin(t * 3 + i * 0.28) * 110;
    const r = 12 + Math.sin(t + i) * 8;

    ctx.beginPath();
    ctx.fillStyle = \`hsl(\${25 + p * 260}, 92%, 62%)\`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
});

console.log('creative coding sandbox ready');`;

	const promptMarkdown = `# Trinket Sorter

Lorem ipsum dolor sit amet, **collect three shiny trinkets**, and keep the shelf from overflowing.

## Goal

- Build something tiny, bright, and interactive.
- Use the canvas helpers already available in the sandbox.
- Make it feel like a busy little shop display.

## Starter Ideas

> Little objects should move, bounce, sparkle, stack, or misbehave.

\`\`\`js
// helpers available in the sandbox
clear('#fffdf4');
loop(({ dt, width, height }) => {
  // draw your trinkets here
});
\`\`\`

## Notes

This is placeholder markdown for now. Later this panel can load today's challenge text.`;

	let code = $state(starterCode);
	let entries = $state<Entry[]>([]);
	let iframeRef = $state<HTMLIFrameElement>();
	let textareaRef = $state<HTMLTextAreaElement>();
	let gutterRef = $state<HTMLPreElement>();
	let status = $state<SandboxStatus>('idle');
	let activeTab = $state<ActiveTab>('code');
	let hasBootedSandbox = $state(false);
	let runId = 0;
	let entryId = 0;
	let lineNumberText = $derived(
		Array.from({ length: Math.max(1, code.split('\n').length) }, (_, index) => index + 1).join('\n')
	);
	let promptHtml = $derived(renderMarkdown(promptMarkdown));

	const addEntry = (type: Entry['type'], text: string) => {
		const normalized = text.length > 6000 ? `${text.slice(0, 6000)}\n...truncated` : text;
		entries = [...entries, { id: entryId++, type, text: normalized }].slice(-maxEntries);
	};

	function escapeHtml(value: string) {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function renderInlineMarkdown(value: string) {
		return escapeHtml(value)
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	}

	function renderMarkdown(source: string) {
		const lines = source.split('\n');
		const html: string[] = [];
		let inList = false;
		let inCode = false;
		let codeLines: string[] = [];

		const closeList = () => {
			if (!inList) return;
			html.push('</ul>');
			inList = false;
		};

		for (const line of lines) {
			if (line.startsWith('```')) {
				if (inCode) {
					html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
					codeLines = [];
					inCode = false;
				} else {
					closeList();
					inCode = true;
				}
				continue;
			}

			if (inCode) {
				codeLines.push(line);
				continue;
			}

			if (!line.trim()) {
				closeList();
				continue;
			}

			if (line.startsWith('### ')) {
				closeList();
				html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
				continue;
			}

			if (line.startsWith('## ')) {
				closeList();
				html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
				continue;
			}

			if (line.startsWith('# ')) {
				closeList();
				html.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
				continue;
			}

			if (line.startsWith('> ')) {
				closeList();
				html.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`);
				continue;
			}

			if (line.startsWith('- ')) {
				if (!inList) {
					html.push('<ul>');
					inList = true;
				}
				html.push(`<li>${renderInlineMarkdown(line.slice(2))}</li>`);
				continue;
			}

			closeList();
			html.push(`<p>${renderInlineMarkdown(line)}</p>`);
		}

		closeList();
		if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);

		return html.join('');
	}

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
				background: #fffdf4;
				color: #21445f;
				font: 800 14px "Comic Sans MS", "Comic Sans", ui-rounded, cursive;
				letter-spacing: 0.03em;
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
				background: #fffdf4;
				color: #242136;
				font-family: "Comic Sans MS", "Comic Sans", ui-rounded, cursive;
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

				const clear = (color = '#fffdf4') => {
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

			<div class="pane-tabs" role="tablist" aria-label="Sandbox panels">
				<button
					type="button"
					role="tab"
					class:active={activeTab === 'code'}
					aria-selected={activeTab === 'code'}
					onclick={() => (activeTab = 'code')}
				>
					Code
				</button>
				<button
					type="button"
					role="tab"
					class:active={activeTab === 'prompt'}
					aria-selected={activeTab === 'prompt'}
					onclick={() => (activeTab = 'prompt')}
				>
					Prompt
				</button>
			</div>

			{#if activeTab === 'code'}
				<div class="code-editor-shell" aria-label="JavaScript editor" role="tabpanel">
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
			{:else}
				<div class="prompt-shell" role="tabpanel" aria-label="Challenge prompt">
					<article class="markdown-body">
						{@html promptHtml}
					</article>
				</div>
			{/if}
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
		background: #fffdf4;
		color: #242136;
		font-family: 'Comic Sans MS', 'Comic Sans', ui-rounded, cursive;
	}

	:global(button),
	:global(textarea) {
		font: inherit;
	}

	.app-shell {
		min-height: 100vh;
		padding: 18px;
		background:
			linear-gradient(90deg, rgba(35, 201, 255, 0.14) 1px, transparent 1px),
			linear-gradient(rgba(255, 204, 51, 0.16) 1px, transparent 1px),
			linear-gradient(135deg, #fffdf4 0%, #f7fffb 48%, #f6fbff 100%);
		background-size:
			28px 28px,
			28px 28px,
			auto;
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
		grid-template-rows: auto auto minmax(0, 1fr);
		height: calc(100vh - 36px);
		min-height: 0;
		overflow: hidden;
		border: 2px solid #242136;
		border-radius: 8px;
		background: #ffffff;
		box-shadow: 7px 7px 0 #00c2ff;
	}

	.pane-header,
	.preview-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 2px solid #242136;
		background: #fff8c9;
	}

	.pane-header {
		padding: 14px;
	}

	.eyebrow {
		margin: 0 0 3px;
		color: #007e7a;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.2;
		color: #242136;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}

	button {
		min-width: 76px;
		border: 2px solid #242136;
		border-radius: 6px;
		background: #ff5c35;
		color: #ffffff;
		padding: 8px 12px;
		font-weight: 800;
		cursor: pointer;
		box-shadow: 3px 3px 0 #242136;
	}

	button:hover:not(:disabled) {
		background: #ff7a4f;
		transform: translate(-1px, -1px);
		box-shadow: 4px 4px 0 #242136;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.52;
	}

	button.ghost {
		border-color: #242136;
		background: #ffffff;
		color: #242136;
		box-shadow: 3px 3px 0 #ffcc33;
	}

	button.ghost:hover:not(:disabled) {
		background: #e7fb55;
	}

	.pane-tabs {
		display: flex;
		gap: 8px;
		padding: 10px;
		border-bottom: 2px solid #242136;
		background: #ffffff;
	}

	.pane-tabs button {
		min-width: 0;
		border-color: #242136;
		background: #ffffff;
		color: #242136;
		padding: 7px 12px;
		box-shadow: 3px 3px 0 #00c2ff;
	}

	.pane-tabs button.active {
		background: #e7fb55;
		box-shadow: 3px 3px 0 #ffcc33;
	}

	.code-editor-shell {
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: #fffdf4;
		color: #242136;
	}

	.line-numbers,
	textarea {
		box-sizing: border-box;
		margin: 0;
		padding: 18px 0;
		border: 0;
		font-family: 'Comic Sans MS', 'Comic Sans', 'SFMono-Regular', Consolas, cursive;
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
		border-right: 2px solid #242136;
		background: #dff7ff;
		color: #0072a3;
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
		caret-color: #ff5c35;
		padding-left: 16px;
		padding-right: 18px;
		overflow: auto;
	}

	textarea::selection {
		background: rgba(35, 201, 255, 0.28);
	}

	.prompt-shell {
		min-height: 0;
		overflow: auto;
		background: #fffdf4;
		color: #242136;
		padding: 20px;
	}

	.markdown-body {
		max-width: 720px;
	}

	:global(.markdown-body h1),
	:global(.markdown-body h2),
	:global(.markdown-body h3),
	:global(.markdown-body p),
	:global(.markdown-body ul),
	:global(.markdown-body blockquote),
	:global(.markdown-body pre) {
		margin-top: 0;
	}

	:global(.markdown-body h1) {
		margin-bottom: 14px;
		font-size: 1.75rem;
		line-height: 1.1;
	}

	:global(.markdown-body h2) {
		margin-bottom: 10px;
		padding-top: 8px;
		color: #007e7a;
		font-size: 1.08rem;
		line-height: 1.2;
	}

	:global(.markdown-body p),
	:global(.markdown-body li),
	:global(.markdown-body blockquote) {
		font-size: 0.95rem;
		line-height: 1.55;
	}

	:global(.markdown-body ul) {
		padding-left: 22px;
	}

	:global(.markdown-body li::marker) {
		color: #ff5c35;
	}

	:global(.markdown-body blockquote) {
		margin: 0 0 16px;
		border: 2px solid #242136;
		border-left-width: 8px;
		border-radius: 8px;
		background: #dff7ff;
		padding: 12px 14px;
		box-shadow: 4px 4px 0 #ffcc33;
	}

	:global(.markdown-body code) {
		border: 1px solid #242136;
		border-radius: 4px;
		background: #ffffff;
		padding: 1px 5px;
		font-family: 'Comic Sans MS', 'Comic Sans', 'SFMono-Regular', Consolas, cursive;
	}

	:global(.markdown-body pre) {
		overflow: auto;
		border: 2px solid #242136;
		border-radius: 8px;
		background: #ffffff;
		padding: 12px;
		box-shadow: 4px 4px 0 #00c2ff;
	}

	:global(.markdown-body pre code) {
		border: 0;
		background: transparent;
		padding: 0;
		white-space: pre;
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
		border: 2px solid #242136;
		border-radius: 8px;
		background: #ffffff;
		box-shadow: 7px 7px 0 #ffcc33;
	}

	.preview-bar {
		min-height: 42px;
		padding: 0 12px;
		color: #242136;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.preview-bar span:last-child {
		border: 2px solid #242136;
		border-radius: 999px;
		padding: 3px 8px;
		background: #ffffff;
		color: #242136;
		font-size: 0.68rem;
	}

	.preview-bar span:last-child.active {
		border-color: #242136;
		background: #e7fb55;
		color: #214600;
	}

	.preview-bar span:last-child.error-status {
		border-color: #242136;
		background: #ff8a8a;
		color: #641b24;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: 0;
		background: #fffdf4;
	}

	.console {
		overflow: auto;
		background: #f7fffb;
		padding: 12px;
	}

	.empty {
		margin: 0;
		color: #62717f;
		font-family: 'Comic Sans MS', 'Comic Sans', ui-rounded, cursive;
		font-size: 0.86rem;
	}

	.console pre {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 10px;
		margin: 0 0 8px;
		white-space: pre-wrap;
		word-break: break-word;
		color: #242136;
		font-family: 'Comic Sans MS', 'Comic Sans', 'SFMono-Regular', Consolas, cursive;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.console pre span {
		color: #008a65;
		font-weight: 800;
	}

	.console pre.warn span {
		color: #b77400;
	}

	.console pre.error,
	.console pre.error span {
		color: #d63230;
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

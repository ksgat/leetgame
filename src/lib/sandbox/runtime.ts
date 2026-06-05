export const stoppedDocument = () => `<!doctype html>
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

export const buildDocument = (source: string, id: number) => {
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

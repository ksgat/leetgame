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

export function renderMarkdown(source: string) {
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

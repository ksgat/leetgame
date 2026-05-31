import { InputRule, textInputRule } from '@tiptap/core';
import { InlineMath } from '@tiptap/extension-mathematics';

export const InlineMathReplacer = InlineMath.extend({
	name: 'inlineMathReplacer',
	addInputRules() {
		return [
			new InputRule({
				find: /\$\$([^$]+)\$\$$/,
				handler: ({ match, commands }) => {
					const latex = match[1];
					commands.insertInlineMath({
						latex
					});
				}
			})
		];
	}
});

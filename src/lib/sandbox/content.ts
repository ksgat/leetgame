export const starterCode = `fitCanvas();

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

export const promptMarkdown = `# Trinket Sorter

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

<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		class: className,
		children,
		...restProps
	}: { class?: string; children?: Snippet; [key: string]: unknown } = $props();
</script>

<DialogPrimitive.Portal>
	<DialogPrimitive.Overlay class="fixed inset-0 z-40 bg-black/60" />
	<DialogPrimitive.Content
		class={cn(
			'fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-md mx-auto bg-card border border-border rounded-xl shadow-xl flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>

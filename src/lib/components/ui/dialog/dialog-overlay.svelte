<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { class: className, ...restProps } = $props();
</script>

<DialogPrimitive.Overlay
	class={cn('fixed inset-0 z-40 bg-black/60', className)}
	{...restProps}
/>

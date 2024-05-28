import { defineConfig } from 'vite';
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const copyOverPyrightWorker = () =>
	viteStaticCopy({
		targets: [
			{
				src: 'node_modules/@typefox/pyright-browser/dist/pyright.worker.js',
				dest: './',
			},
		],
	});

export default defineConfig({
	plugins: [copyOverPyrightWorker()],
	optimizeDeps: {
		esbuildOptions: {
			plugins: [
				importMetaUrlPlugin
			]
		}
	},
});

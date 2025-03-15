import * as client_hooks from '../../../src/hooks.client.js';


export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13')
];

export const server_loads = [3];

export const dictionary = {
		"/": [4],
		"/atomorrow": [5],
		"/explore/console": [6,[2]],
		"/explore/schema": [7,[2]],
		"/historical": [8],
		"/linked-cards": [9],
		"/sales-staff": [10],
		"/settings": [~11,[3]],
		"/studentescape": [12],
		"/tickets": [13]
	};

export const hooks = {
	handleError: client_hooks.handleError || (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';
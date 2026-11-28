import type { McpServerListItem } from '@n8n/api-types';
import { VIEWS } from '@n8n/frontend-constants/views';
import { createComponentRenderer } from '@n8n/frontend-test-utils';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { MCP_SERVER_VIEW } from '../mcp-servers.constants';
import McpServerCard from './McpServerCard.vue';

const api = vi.hoisted(() => ({ getMcpServer: vi.fn() }));
vi.mock('../mcp-servers.api', () => api);

const SERVER_ID = '0190a8d6-4a2e-7000-8000-000000000001';
const LIST_PATH = '/home/mcp-servers';

const server: McpServerListItem = {
	id: SERVER_ID,
	projectId: 'project-1',
	project: { name: 'Marketing', type: 'team' },
	name: 'Sales tools',
	slug: 'sales-tools',
	description: 'Pipeline numbers for the sales team',
	createdAt: '2026-11-24T10:00:00.000Z',
	updatedAt: '2026-11-24T10:00:00.000Z',
	toolCount: 1,
	connectionCount: 0,
};

const blank = { render: () => null };

const renderComponent = createComponentRenderer(McpServerCard);

/** A real router, so a click that reaches the card link really changes the route. */
async function render() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: LIST_PATH, component: blank },
			{
				path: '/projects/:projectId/mcp-servers/:serverId',
				name: MCP_SERVER_VIEW,
				component: blank,
			},
			{ path: '/workflow/:workflowId', name: VIEWS.WORKFLOW, component: blank },
		],
	});
	await router.push(LIST_PATH);
	await router.isReady();
	renderComponent({
		props: {
			server,
			to: { name: MCP_SERVER_VIEW, params: { projectId: 'project-1', serverId: SERVER_ID } },
		},
		// The shared renderer stubs `RouterLink`. This test needs the real link.
		global: { plugins: [router], stubs: { RouterLink: false } },
	});
	return router;
}

describe('McpServerCard', () => {
	let windowOpenSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		api.getMcpServer.mockResolvedValue({
			id: SERVER_ID,
			tools: [
				{
					id: '0190a8d6-4a2e-7000-8000-0000000000a1',
					kind: 'workflow',
					targetId: 'wf-1',
					toolName: 'get_numbers',
				},
			],
		});
	});

	afterEach(() => {
		windowOpenSpy.mockRestore();
	});

	it('opens the server page on a click on the card name', async () => {
		const router = await render();

		await userEvent.click(screen.getByTestId('mcp-server-card-name'));

		await waitFor(() => expect(router.currentRoute.value.name).toBe(MCP_SERVER_VIEW));
	});

	it('keeps the route on a click on the pill and on a workflow item', async () => {
		const router = await render();

		await userEvent.click(screen.getByTestId('mcp-server-card-items-pill'));
		const item = await screen.findByText('get_numbers');
		expect(router.currentRoute.value.path).toBe(LIST_PATH);

		await userEvent.click(item);

		expect(windowOpenSpy).toHaveBeenCalledWith('/workflow/wf-1', '_blank', 'noopener,noreferrer');
		expect(router.currentRoute.value.path).toBe(LIST_PATH);
	});
});

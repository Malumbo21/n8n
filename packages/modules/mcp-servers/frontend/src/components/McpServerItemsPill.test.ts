import { VIEWS } from '@n8n/frontend-constants/views';
import { createComponentRenderer } from '@n8n/frontend-test-utils';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/vue';

import type { McpServerItem } from '../composables/useMcpServerItemsMenu';
import { MCP_SERVER_VIEW } from '../mcp-servers.constants';
import McpServerItemsPill from './McpServerItemsPill.vue';

const api = vi.hoisted(() => ({ getMcpServer: vi.fn() }));
vi.mock('../mcp-servers.api', () => api);

const toast = vi.hoisted(() => ({ showError: vi.fn() }));
vi.mock('@n8n/composables/useToast', () => ({ useToast: () => toast }));

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@n8n/composables/useTelemetry', () => ({ useTelemetry: () => telemetry }));

const SERVER_ID = '0190a8d6-4a2e-7000-8000-000000000001';

/** The detail route answers with these items. */
function serveItems(tools: McpServerItem[]) {
	api.getMcpServer.mockResolvedValue({ id: SERVER_ID, tools });
}

function renderPill(toolCount: number) {
	return renderComponent({
		props: {
			server: { id: SERVER_ID, projectId: 'project-1', toolCount },
			dataTestId: 'items-pill',
		},
	});
}

const push = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn(() => ({ href: '/workflow/wf-1' })));
vi.mock('vue-router', () => ({
	useRouter: () => ({ push, resolve }),
}));

const renderComponent = createComponentRenderer(McpServerItemsPill);

function makeTool(index: number, overrides: Partial<McpServerItem> = {}): McpServerItem {
	return {
		id: `0190a8d6-4a2e-7000-8000-00000000000${index}`,
		kind: 'workflow',
		targetId: `wf-${index}`,
		toolName: `tool_${index}`,
		...overrides,
	};
}

describe('McpServerItemsPill', () => {
	let windowOpenSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => {
		windowOpenSpy.mockRestore();
	});

	it('renders the graph-12 icon and count, and loads the grouped items on open', async () => {
		const tools = [
			makeTool(1, { kind: 'node', targetId: null, toolName: 'search_slack' }),
			makeTool(2, { kind: 'workflow', targetId: 'wf-1', toolName: 'get_campaign_numbers' }),
			makeTool(3, { kind: 'agent', targetId: 'agent-1', toolName: 'support_agent' }),
			makeTool(4, { kind: 'skill', targetId: 'skill-1', toolName: 'brand_guidelines' }),
		];

		serveItems(tools);
		const { container } = renderPill(4);

		const trigger = screen.getByTestId('items-pill');
		expect(trigger).toHaveTextContent('4');
		expect(container.querySelector('[data-icon="graph-12"]')).not.toBeNull();
		expect(api.getMcpServer).not.toHaveBeenCalled();

		await userEvent.click(trigger);
		expect(api.getMcpServer).toHaveBeenCalledWith(expect.anything(), 'project-1', SERVER_ID);

		expect(await screen.findByText('Tools')).toBeInTheDocument();
		expect(screen.getByText('search_slack')).toBeInTheDocument();
		expect(screen.getByText('Workflows')).toBeInTheDocument();
		expect(screen.getByText('get_campaign_numbers')).toBeInTheDocument();
		expect(screen.getByText('Agents')).toBeInTheDocument();
		expect(screen.getByText('support_agent')).toBeInTheDocument();
		expect(screen.getByText('Skills')).toBeInTheDocument();
		expect(screen.getByText('brand_guidelines')).toBeInTheDocument();
		expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
	});

	it('shows search and filters items when the server has 6 or more items', async () => {
		const tools = [
			makeTool(1, { toolName: 'alpha_tool' }),
			makeTool(2, { toolName: 'beta_tool' }),
			makeTool(3, { toolName: 'gamma_tool' }),
			makeTool(4, { toolName: 'delta_tool' }),
			makeTool(5, { toolName: 'epsilon_tool' }),
			makeTool(6, { toolName: 'zeta_tool' }),
		];

		serveItems(tools);
		renderPill(6);

		await userEvent.click(screen.getByTestId('items-pill'));
		const searchInput = await screen.findByPlaceholderText('Search...');
		await userEvent.type(searchInput, 'zeta');

		expect(screen.getByText('zeta_tool')).toBeInTheDocument();
		expect(screen.queryByText('alpha_tool')).not.toBeInTheDocument();
	});

	it('opens workflows in a new tab and node tools on the server page', async () => {
		const wf = makeTool(1, { kind: 'workflow', targetId: 'wf-1', toolName: 'get_numbers' });
		const node = makeTool(2, { kind: 'node', targetId: null, toolName: 'search_slack' });

		serveItems([wf, node]);
		renderPill(2);

		await userEvent.click(screen.getByTestId('items-pill'));
		await userEvent.click(await screen.findByText('get_numbers'));
		expect(resolve).toHaveBeenCalledWith({ name: VIEWS.WORKFLOW, params: { workflowId: 'wf-1' } });
		expect(windowOpenSpy).toHaveBeenCalledWith('/workflow/wf-1', '_blank', 'noopener,noreferrer');

		await userEvent.click(screen.getByTestId('items-pill'));
		await userEvent.click(await screen.findByText('search_slack'));
		expect(push).toHaveBeenCalledWith({
			name: MCP_SERVER_VIEW,
			params: { projectId: 'project-1', serverId: SERVER_ID },
			query: { tool: 'search_slack' },
		});
		// Each open loads the items again, so they are never stale.
		expect(api.getMcpServer).toHaveBeenCalledTimes(2);
	});

	it('sends the dependency pill events on open and on an item click, without the tool name', async () => {
		serveItems([makeTool(1, { kind: 'agent', targetId: 'agent-1', toolName: 'support_agent' })]);
		renderPill(1);

		await userEvent.click(screen.getByTestId('items-pill'));
		expect(telemetry.track).toHaveBeenCalledWith('User opened dependency pill', {
			source: 'mcp_server_card',
			dependency_count: 1,
		});

		await userEvent.click(await screen.findByText('support_agent'));
		expect(telemetry.track).toHaveBeenCalledWith('User clicked dependency pill item', {
			source: 'mcp_server_card',
			dependency_type: 'agent',
			dependency_count: 1,
		});
		expect(telemetry.track).toHaveBeenCalledTimes(2);
	});

	it('shows an error toast when the items do not load', async () => {
		const failure = new Error('Forbidden');
		api.getMcpServer.mockRejectedValue(failure);
		renderPill(3);

		await userEvent.click(screen.getByTestId('items-pill'));

		await vi.waitFor(() =>
			expect(toast.showError).toHaveBeenCalledWith(failure, 'Could not load the MCP server'),
		);
	});
});

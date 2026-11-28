<script setup lang="ts">
import type { McpServerListItem } from '@n8n/api-types';
import { useTelemetry } from '@n8n/composables/useTelemetry';
import { useToast } from '@n8n/composables/useToast';
import { N8nBadge, N8nDropdownMenu, N8nIcon, N8nTooltip } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useRootStore } from '@n8n/stores/useRootStore';
import { computed, ref } from 'vue';

import { useMcpServerItemsMenu, type McpServerItem } from '../composables/useMcpServerItemsMenu';
import { getMcpServer } from '../mcp-servers.api';

const MIN_ITEMS_FOR_SEARCH = 6;
const TELEMETRY_SOURCE = 'mcp_server_card';

const props = defineProps<{
	server: Pick<McpServerListItem, 'id' | 'projectId'> & { toolCount: number };
	dataTestId?: string;
}>();

const i18n = useI18n();
const telemetry = useTelemetry();
const toast = useToast();
const rootStore = useRootStore();
const { buildItemMenuItems, resolveItemMenuId, openServerItem } = useMcpServerItemsMenu();

// The list sends only the count. The items come from the detail route on each open, so a large
// list does not load the items of every server, and the items are never stale.
const items = ref<McpServerItem[]>([]);
const loading = ref(false);
const searchTerm = ref('');

const showSearch = computed(() => items.value.length >= MIN_ITEMS_FOR_SEARCH);

const menuItems = computed(() => buildItemMenuItems(items.value, searchTerm.value));

const tooltipText = computed(() => i18n.baseText('mcpServers.card.items.tooltip'));

function onSelect(value: string) {
	const item = resolveItemMenuId(items.value, value);
	if (!item) return;
	// The same events as `DependencyPill` in the editor, without the tool name.
	telemetry.track('User clicked dependency pill item', {
		source: TELEMETRY_SOURCE,
		dependency_type: item.kind,
		dependency_count: props.server.toolCount,
	});
	openServerItem(props.server, item);
}

function onSearch(term: string) {
	searchTerm.value = term;
}

async function loadItems() {
	if (loading.value) return;
	loading.value = true;
	try {
		const detail = await getMcpServer(
			rootStore.restApiContext,
			props.server.projectId,
			props.server.id,
		);
		items.value = detail.tools;
	} catch (error) {
		toast.showError(error, i18n.baseText('mcpServers.server.load.error'));
	} finally {
		loading.value = false;
	}
}

async function onDropdownToggle(open: boolean) {
	if (!open) {
		searchTerm.value = '';
		return;
	}
	telemetry.track('User opened dependency pill', {
		source: TELEMETRY_SOURCE,
		dependency_count: props.server.toolCount,
	});
	await loadItems();
}
</script>

<template>
	<N8nDropdownMenu
		:items="menuItems"
		placement="bottom-start"
		:loading="loading"
		:loading-item-count="1"
		:searchable="showSearch"
		:search-placeholder="i18n.baseText('mcpServers.card.items.searchPlaceholder')"
		:max-height="280"
		:data-test-id="dataTestId"
		@select="onSelect"
		@search="onSearch"
		@update:model-value="onDropdownToggle"
	>
		<template #trigger>
			<N8nTooltip :content="tooltipText" placement="top" as-child>
				<N8nBadge variant="outline" clickable>
					<template #leading>
						<N8nIcon icon="graph-12" size="small" :class="$style.icon" />
					</template>
					{{ server.toolCount }}
				</N8nBadge>
			</N8nTooltip>
		</template>
	</N8nDropdownMenu>
</template>

<style lang="scss" module>
/* Mirrors N8nBadge's leading icon, which only renders at 14px or larger. */
.icon {
	flex-shrink: 0;
	opacity: 0.9;
}
</style>

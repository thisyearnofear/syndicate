export type {
  AgentToolId,
  AgentToolDefinition,
  AgentToolCall,
  AgentToolResult,
  AgentPlan,
  AgentSessionMemory,
  AgentLoopState,
  XLayerToolId,
  BaseToolId,
} from './types';

export {
  registerAgentTool,
  getAgentTool,
  listAgentTools,
  requireAgentTool,
  __resetAgentToolRegistryForTests,
} from './registry';

export {
  XLAYER_AGENT_TOOLS,
  ensureXLayerToolsRegistered,
  isXLayerToolId,
  actionToToolId,
} from './xlayerTools';

export {
  BASE_AGENT_TOOLS,
  ensureBaseToolsRegistered,
  isBaseToolId,
} from './baseTools';

import { ensureXLayerToolsRegistered } from './xlayerTools';
import { ensureBaseToolsRegistered } from './baseTools';

export function ensureAllAgentToolsRegistered(): void {
  ensureXLayerToolsRegistered();
  ensureBaseToolsRegistered();
}

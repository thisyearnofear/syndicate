import type { AgentToolDefinition, AgentToolId } from './types';

const tools = new Map<AgentToolId, AgentToolDefinition>();

export function registerAgentTool(definition: AgentToolDefinition): void {
  if (tools.has(definition.id)) {
    throw new Error(`Agent tool already registered: ${definition.id}`);
  }
  tools.set(definition.id, definition);
}

export function getAgentTool(id: AgentToolId): AgentToolDefinition | undefined {
  return tools.get(id);
}

export function listAgentTools(): AgentToolDefinition[] {
  return [...tools.values()];
}

export function requireAgentTool(id: AgentToolId): AgentToolDefinition {
  const tool = tools.get(id);
  if (!tool) throw new Error(`Unknown agent tool: ${id}`);
  return tool;
}

/** Reset registry — tests only. */
export function __resetAgentToolRegistryForTests(): void {
  tools.clear();
}

// Catalogo de permissoes granulares (sub-logins). Admin tem todas implicitamente.
// Espelhado no frontend em src/lib/permissions.ts — manter os dois em sincronia.
export const PERMISSIONS = {
  CLIENTES_VIEW: 'clientes.view',
  CLIENTES_EDIT: 'clientes.edit',
  CLIENTES_DELETE: 'clientes.delete',
  CHAT_VIEW: 'chat.view',
  CHAT_SEND: 'chat.send',
  KANBAN_EDIT: 'kanban.edit',
  PLANOS_VIEW: 'planos.view',
  PLANOS_EDIT: 'planos.edit',
  DASHBOARD_VIEW: 'dashboard.view',
  AGENDA_VIEW: 'agenda.view',
  AGENDA_EDIT: 'agenda.edit',
  CONFIG_VIEW: 'config.view',
  CONFIG_EDIT: 'config.edit',
  USERS_MANAGE: 'users.manage',
  HANDOFF_RECEBER: 'handoff.receber',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

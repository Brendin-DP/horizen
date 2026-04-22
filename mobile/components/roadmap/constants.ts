import type { FeatureRequestStatus } from '../../types';

/** Same column order as the admin product portal kanban. */
export const KANBAN_TAB_ORDER: FeatureRequestStatus[] = [
  'Requested',
  'Under Consideration',
  'In Progress',
  'Done',
];

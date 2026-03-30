export type BlipExtensionAction = 'add' | 'compare';

export interface BlipSelectionPayload {
  action: BlipExtensionAction;
  selectionText: string;
  pageUrl: string;
}


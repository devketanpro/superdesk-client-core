import {ISuperdesk} from 'superdesk-api';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const superdesk: ISuperdesk = window['extensionsApiInstances']['auto-tagging-widget'] as ISuperdesk;
